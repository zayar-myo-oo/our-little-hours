// Living World renderer (M1-A): the study as a 2.5D diorama with an isometric-style overview camera.
// Built entirely from the location manifest + prefab registry. Same handle contract as the legacy room
// (setState / setReducedMotion / setRain / destroy / hasVrm), so Room.tsx can fall back to it transparently.
import * as THREE from "three";
import type { Availability } from "@/systems/character/schedule";
import { makeKit, v, rng } from "@/components/room3d/kit";
import { paletteFor } from "@/components/room3d/timeOfDay";
import { pauseWhenHidden } from "@/lib/visibility";
import studyJson from "@content/locations/study.json";
import { validateLocation, REQUIRED_ANCHORS, type AnchorId, type LocationManifest } from "@/world/locations/schema";
import { PREFAB_IDS, type PrefabId } from "./prefabs/ids";
import { buildPrefab } from "./prefabs/registry";
import { isoCameraPose } from "./camera/iso";
import { CameraDirector, camPosition, closeupState, distanceFor, pullIn, stateFromPose, type CamState, type ShotId } from "./camera/director";
import { findOccluders, makeFadeable, nearerThanSubject, updateFades } from "./occlusion";
import { mergeStatic } from "./mergeStatic";
import { overBudget } from "./budget";
import { detectTier, qualityFor, readDeviceInfo, parseQualityOverride, FrameLimiter, type Quality } from "./quality";
import { applyPose, placeSeated, placeStanding, dimMaterials, type HumanoidLike } from "./character/vrmApply";
import { poseFor, mtoonDimFactor, KEYBOARD_HAND_Y } from "./character/vrmPose";

export interface WorldHandle {
  setState(s: Availability): void;
  setReducedMotion(r: boolean): void;
  setRain(on: boolean): void;
  destroy(): void;
  placeAt(anchor: AnchorId): void;
  /** Manual camera control: "overview" or an anchor close-up. Manual choices pause automatic switching for a while. */
  focusCamera(shot: ShotId): void;
  setAutoCamera(on: boolean): void;
  readonly cameraShot: ShotId;
  readonly anchor: AnchorId;
  readonly hasVrm: boolean;
  /** Resolves when the selected VRM has loaded (true) or failed (false). */
  readonly modelReady: Promise<boolean>;
  readonly quality: Quality;
  /** GPU cost of the last rendered frame (from renderer.info). */
  stats(): { drawCalls: number; triangles: number };
}

export interface WorldOptions {
  reducedMotion: boolean; state: Availability; rain: boolean; modelUrl: string | null;
  location?: LocationManifest; anchor?: AnchorId;
  /** Called when the camera shot changes (manual, automatic or returning to the overview). */
  onCameraShot?: (shot: ShotId) => void;
}

type VRMLike = {
  scene: THREE.Object3D; update(d: number): void; humanoid: HumanoidLike;
  expressionManager?: { setValue(n: string, v: number): void } | null; lookAt?: { target?: THREE.Object3D } | null; meta?: { metaVersion?: string };
};

const urlParam = (k: string) => (typeof location !== "undefined" ? new URLSearchParams(location.search).get(k) : null);

export async function createWorldScene(host: HTMLElement, opts: WorldOptions): Promise<WorldHandle> {
  const loc = opts.location ?? (studyJson as LocationManifest);
  const problems = validateLocation(loc, PREFAB_IDS);
  if (problems.length) throw new Error(`invalid location "${loc.id}": ${problems.join("; ")}`);

  const quality = qualityFor(parseQualityOverride(location.search) ?? detectTier(readDeviceInfo()), window.devicePixelRatio || 1);
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: "low-power" });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
  host.appendChild(renderer.domElement);

  const hp = urlParam("hour");
  const pal = paletteFor(hp !== null && /^\d{1,2}$/.test(hp) && Number(hp) < 24 ? Number(hp) : new Date().getHours());
  const night = pal.phase === "night";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 300);
  const kit = makeKit(scene);
  scene.background = kit.canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, night ? "#2b2645" : "#f7e9dc"); g.addColorStop(1, night ? "#16131f" : "#e6cfc0");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });

  // lighting preset "warm_study"
  scene.add(new THREE.HemisphereLight(night ? 0x9aa0e0 : 0xfff1e4, 0x9a7a6a, pal.ambient * 0.95));
  const sun = new THREE.DirectionalLight(pal.sun, pal.sunIntensity * 0.75); sun.position.set(-1.5, 4, -7); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe6d6, night ? 0.25 : 0.55); fill.position.set(4, 5, 6); scene.add(fill);

  // props by layer
  const layers = { backdrop: new THREE.Group(), shell: new THREE.Group(), props: new THREE.Group(), foreground: new THREE.Group() };
  for (const g of Object.values(layers)) scene.add(g);
  const foreground: THREE.Object3D[] = [];
  const updaters: ((t: number) => void)[] = [];
  for (const p of loc.props) {
    const res = buildPrefab(p.prefab as PrefabId, { kit, pal, lowQuality: quality.tier === "low" });
    res.object.position.set(...p.pos);
    res.object.rotation.y = p.rotY ?? 0;
    layers[p.layer].add(res.object);
    if (res.update) updaters.push(res.update);
    if (p.layer === "foreground") { makeFadeable(res.object); foreground.push(res.object); }
  }

  // Static furniture and walls never move: one mesh per material keeps draw calls low (389 → ~50 for the study).
  mergeStatic(layers.shell); mergeStatic(layers.props);

  // rain outside the window (only visible through the opening)
  const RAIN = quality.tier === "low" ? 60 : 140, rainPos = new Float32Array(RAIN * 6), rr = rng(4);
  // only between the glass and the painted view, inside the opening (x ∈ [-2.4, 0.4], y ∈ [1, 2.4]), so the walls hide it elsewhere
  for (let i = 0; i < RAIN; i++) { const x = -2.35 + rr() * 2.7, y = 1.15 + rr() * 1.2, z = -2.58 - rr() * 0.12; rainPos.set([x, y, z, x - 0.01, y - 0.1, z], i * 6); }
  const rainGeo = kit.track(new THREE.BufferGeometry()); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, kit.track(new THREE.LineBasicMaterial({ color: 0xc8d8f0, transparent: true, opacity: 0.55 })));
  scene.add(rain);

  // character: wrapper sits at the anchor; the model (VRM or placeholder) is posed inside it
  const charRoot = new THREE.Group(); scene.add(charRoot);
  let vrm: VRMLike | null = null;
  // The placeholder shows only when no model is selected; a selected VRM loads in the background so the room
  // appears immediately instead of after a ~20 MB download.
  const placeholder = opts.modelUrl ? null : buildPlaceholder(kit);
  if (placeholder) charRoot.add(placeholder.root);
  let disposed = false;
  const modelReady: Promise<boolean> = !opts.modelUrl ? Promise.resolve(false) : (async () => {
    try {
      const [{ GLTFLoader }, { VRMLoaderPlugin, VRMUtils }] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("@pixiv/three-vrm")]);
      const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p));
      const loaded = (await loader.loadAsync(opts.modelUrl!)).userData.vrm as VRMLike;
      if (disposed) return false;
      VRMUtils.rotateVRM0(loaded as never);
      dimMaterials(loaded.scene, mtoonDimFactor(pal.ambient, pal.sunIntensity));
      charRoot.add(loaded.scene);
      if (loaded.lookAt) loaded.lookAt.target = camera;
      vrm = loaded;
      applyState();
      performance.mark("olh:world-model-ready");
      return true;
    } catch (e) { console.warn("[world] VRM not loaded", e); return false; }
  })();

  let anchorId: AnchorId = opts.anchor ?? (urlParam("anchor") as AnchorId | null) ?? "desk";
  if (!loc.anchors[anchorId]) anchorId = "desk";
  let state = opts.state, reduced = opts.reducedMotion, raining = opts.rain;

  function place(id: AnchorId) {
    const a = loc.anchors[id];
    charRoot.position.set(...a.pos); charRoot.rotation.y = a.faceY;
    if (vrm) {
      vrm.humanoid.resetNormalizedPose?.();
      applyPose(vrm.humanoid, poseFor(a.pose, vrm.meta?.metaVersion));
      if (a.pose === "stand") placeStanding(vrm.scene);
      else placeSeated(vrm.scene, vrm.humanoid, a.seatTop ?? 0.5, a.pose === "sit_type" ? KEYBOARD_HAND_Y : undefined);
    } else placeholder?.setPose(a.pose, a.seatTop ?? 0.5);
  }
  let placedAt: AnchorId | null = null;
  const directorRef: { current?: CameraDirector } = {}; // set below once the camera shots are known
  function applyState() {
    // M1-A has no simulation yet: map today's schedule onto placement (M1-C replaces this).
    charRoot.visible = state !== "BUSY";
    const at = state === "SLEEPING" ? "reading" : anchorId;
    place(at);
    if (at !== placedAt) { const first = placedAt === null; placedAt = at; if (!first && charRoot.visible) directorRef.current?.focus(at, performance.now(), "auto"); }
    rain.visible = raining;
  }
  applyState();

  // optional bloom
  let composer: { render(dt?: number): void; setSize(w: number, h: number): void; setPixelRatio(r: number): void; dispose(): void } | null = null;
  if (quality.bloom) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import("three/examples/jsm/postprocessing/EffectComposer.js"), import("three/examples/jsm/postprocessing/RenderPass.js"),
        import("three/examples/jsm/postprocessing/UnrealBloomPass.js"), import("three/examples/jsm/postprocessing/OutputPass.js")]);
      const c = new EffectComposer(renderer);
      c.addPass(new RenderPass(scene, camera)); c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), pal.bloom * 0.8, 0.45, 0.97)); c.addPass(new OutputPass());
      composer = c;
    } catch (e) { console.warn("[world] bloom unavailable", e); }
  }

  // Hybrid camera: iso overview + per-anchor close-ups (see camera/director.ts for the dolly-zoom model)
  const shotsFor = (aspect: number) => {
    const iso = isoCameraPose(loc.camera.overview, loc.bounds, aspect);
    const overview = stateFromPose(iso.position, iso.target, iso.fov);
    const closeups = Object.fromEntries(REQUIRED_ANCHORS.map((a) => [a, closeupState(loc.anchors[a].pos, loc.camera.closeups[a], aspect)])) as Record<AnchorId, CamState>;
    return { overview, closeups };
  };
  let aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
  let lastShot: ShotId = "overview";
  const cam = new CameraDirector({ ...shotsFor(aspect), holds: Object.fromEntries(REQUIRED_ANCHORS.map((a) => [a, loc.camera.closeups[a].hold])) as Record<AnchorId, number> });
  cam.reducedMotion = reduced;
  directorRef.current = cam;
  const startShot = urlParam("camera") as ShotId | null;
  if (startShot && (startShot === "overview" || loc.anchors[startShot as AnchorId])) cam.focus(startShot, performance.now(), "manual");

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    aspect = w / h;
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(w, h);
    const sh = shotsFor(aspect);
    cam.reframe(sh.overview, sh.closeups, performance.now());
    camera.aspect = aspect; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  // Collision ("spring arm"): never let walls or furniture come between the subject and the camera.
  const statics = [layers.shell, layers.props], camRay = new THREE.Raycaster(), tgt = new THREE.Vector3();
  let maxDist = Infinity, camFrame = 0;
  function applyCamera(now: number) {
    const s = cam.update(now);
    const shot = cam.currentShot;
    if (shot !== lastShot) { lastShot = shot; opts.onCameraShot?.(shot); }
    const desired = distanceFor(s.frameH, s.fov);
    if (shot === "overview" && !cam.transitioning) maxDist = Infinity;
    else if (camFrame++ % 3 === 0) {
      tgt.set(...s.target);
      camRay.set(tgt, camPosition(s).sub(tgt).normalize()); camRay.near = 0.05; camRay.far = desired;
      const hit = camRay.intersectObjects(statics, true)[0];
      maxDist = pullIn(desired, hit ? hit.distance : null);
    }
    const pos = camPosition(s, maxDist), d = pos.distanceTo(tgt.set(...s.target));
    camera.position.copy(pos); camera.lookAt(tgt);
    camera.fov = s.fov; camera.near = Math.max(0.05, d * 0.02); camera.far = d + 25;
    camera.updateProjectionMatrix();
  }

  // Tap the character for a close-up; Esc returns to the room view.
  const pointer = new THREE.Vector2(), pick = new THREE.Raycaster();
  const onPointer = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pick.setFromCamera(pointer, camera);
    if (charRoot.visible && pick.intersectObject(charRoot, true).length) cam.focus(placedAt ?? anchorId, performance.now(), "manual");
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cam.focus("overview", performance.now(), "manual"); };
  renderer.domElement.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKey);

  const clock = new THREE.Clock(), limiter = new FrameLimiter(quality.maxFps);
  const head = new THREE.Vector3(), chest = new THREE.Vector3();
  let budgetChecked = false, raf = 0, t = 0, frame = 0, blinkT = 2, occluding = new Set<THREE.Object3D>();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!limiter.shouldRender(now)) return;
    const dt = Math.min(0.05, clock.getDelta());
    if (!reduced) t += dt;
    // occlusion: check every few frames, ease every frame
    if (frame++ % 6 === 0) {
      if (charRoot.visible) {
        charRoot.getWorldPosition(chest).y += 0.8; head.copy(chest).y += 0.35;
        occluding = findOccluders(camera, [head, chest], foreground);
        if (cam.currentShot !== "overview") for (const f of nearerThanSubject(camera, chest, foreground)) occluding.add(f);
      }
      else occluding = new Set();
    }
    updateFades(foreground, occluding, dt, reduced);
    if (raining && !reduced) {
      for (let i = 0; i < RAIN; i++) { let y = rainPos[i * 6 + 1] - 4 * dt; if (y < 1.12) y += 1.25; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y - 0.1; }
      rainGeo.attributes.position.needsUpdate = true;
    }
    for (const u of updaters) u(t);
    blinkT -= dt;
    const closed = state === "SLEEPING" || (state === "AVAILABLE" && blinkT < 0);
    if (blinkT < -0.12) blinkT = 2 + Math.random() * 3;
    if (vrm) {
      vrm.expressionManager?.setValue("blink", closed ? 1 : 0);
      const hb = vrm.humanoid.getNormalizedBoneNode("head");
      if (hb) hb.rotation.x = (vrm.meta?.metaVersion === "0" ? -1 : 1) * (state === "SLEEPING" ? 0.45 : reduced ? 0 : Math.sin(t * 0.5) * 0.03);
      vrm.update(dt);
    } else placeholder?.animate(t, closed, reduced);
    applyCamera(now);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    if (frame === 1) performance.mark("olh:world-first-frame"); // load-time measurement (see docs)
    if (!budgetChecked && !composer) {
      budgetChecked = true;
      const over = overBudget({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, loc.budgets);
      if (over.length) console.warn(`[world] "${loc.id}" over budget:`, over.join(", "));
    }
  };
  raf = requestAnimationFrame(loop);
  const stopWatching = pauseWhenHidden({
    pause: () => { cancelAnimationFrame(raf); raf = 0; },
    resume: () => { if (!raf) { clock.getDelta(); raf = requestAnimationFrame(loop); } },
  });

  return {
    get hasVrm() { return !!vrm; }, modelReady, quality,
    stats: () => ({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    setState(s) { state = s; applyState(); },
    setReducedMotion(r) { reduced = r; cam.reducedMotion = r; },
    setRain(on) { raining = on; rain.visible = on; },
    placeAt(id) { if (loc.anchors[id]) { anchorId = id; applyState(); } },
    focusCamera(shot) { cam.focus(shot, performance.now(), "manual"); },
    setAutoCamera(on) { cam.auto = on; },
    get cameraShot() { return cam.currentShot; },
    get anchor() { return placedAt ?? anchorId; },
    destroy() {
      disposed = true; stopWatching(); cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey);
      scene.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
      kit.dispose(); composer?.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}

/** Simple original stand-in when no VRM is selected or it fails to load. */
function buildPlaceholder(kit: ReturnType<typeof makeKit>) {
  const root = new THREE.Group(), body = new THREE.Group(), legs = new THREE.Group();
  root.add(body); body.add(legs);
  const skin = 0xffe0cf, hair = 0x3a2d4a, top = 0xf4ece2, accent = 0x5fb3b3, phones = 0xe2577a;
  for (const s of [-1, 1]) kit.limb(v(s * 0.08, 0.05, 0), v(s * 0.08, 0.5, 0), 0.06, 0x3d4560, legs, 1.06);
  const torso = kit.mesh(new THREE.CapsuleGeometry(0.15, 0.22, 4, 12), top, v(0, 0.78, 0), body, 1.05); torso.scale.set(1.1, 1, 0.8);
  for (const s of [-1, 1]) kit.limb(v(s * 0.19, 0.9, 0), v(s * 0.22, 0.6, 0.05), 0.05, accent, body, 1.06);
  const head = new THREE.Group(); head.position.set(0, 1.12, 0); body.add(head);
  kit.mesh(new THREE.SphereGeometry(0.14, 20, 16), skin, v(0, 0, 0), head, 1.04);
  kit.mesh(new THREE.SphereGeometry(0.155, 20, 16), hair, v(0, 0.025, -0.025), head, 1.03).scale.set(1.05, 1.03, 1.02);
  const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(kit.track(new THREE.SphereGeometry(0.022, 10, 8)), kit.track(new THREE.MeshBasicMaterial({ color: 0x3b2a55 }))); e.position.set(s * 0.05, -0.01, 0.128); e.scale.set(0.9, 1.3, 0.4); head.add(e); return e; });
  kit.mesh(new THREE.TorusGeometry(0.168, 0.014, 8, 24, Math.PI), phones, v(0, 0.01, -0.01), head, 1.08);
  let baseY = 0;
  return {
    root,
    setPose(pose: "sit_type" | "sit_relax" | "stand", seatTop: number) {
      const seated = pose !== "stand";
      legs.rotation.x = seated ? Math.PI / 2 : 0; legs.position.set(0, seated ? 0.5 : 0, seated ? 0.02 : 0); // thighs forward (+Z)
      baseY = seated ? seatTop - 0.5 : 0; body.position.y = baseY;
    },
    animate(t: number, closed: boolean, reduced: boolean) {
      body.position.y = baseY + (reduced ? 0 : Math.sin(t * 2) * 0.004);
      for (const e of eyes) e.scale.y = closed ? 0.15 : 1.3;
    },
  };
}
