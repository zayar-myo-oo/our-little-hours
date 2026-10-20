// Cel-shaded 3D study room built from primitives (original placeholder art).
// The character picked in Settings (a VRM, e.g. exported from the free VRoid Studio) replaces the placeholder character.
import * as THREE from "three";
import type { Availability } from "@/systems/character/schedule";
import { paletteFor } from "./timeOfDay";
import { makeKit, v } from "./kit";
import { buildEnvironment } from "./environment";

export interface Scene3DHandle { setState(s: Availability): void; setReducedMotion(r: boolean): void; setRain(on: boolean): void; destroy(): void; hasVrm: boolean }

export async function createScene3D(host: HTMLElement, opts: { reducedMotion: boolean; state: Availability; rain: boolean; modelUrl: string | null }): Promise<Scene3DHandle> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  // `?hour=14` previews another time of day (handy for checking art); defaults to the real local hour.
  const hp = new URLSearchParams(location.search).get("hour");
  const hour = hp !== null && /^\d{1,2}$/.test(hp) && Number(hp) < 24 ? Number(hp) : new Date().getHours();
  const pal = paletteFor(hour);
  const kit = makeKit(scene);
  const { mesh, box, limb } = kit;
  const env = buildEnvironment(kit, scene, pal);
  const { lamp, screen } = env;

  // glow (bloom) post-processing; falls back to a plain render if unavailable
  let composer: { render(dt?: number): void; setSize(w: number, h: number): void; setPixelRatio(r: number): void; dispose(): void } | null = null;
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import("three/examples/jsm/postprocessing/EffectComposer.js"), import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"), import("three/examples/jsm/postprocessing/OutputPass.js")]);
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), pal.bloom, 0.5, 0.92));
    c.addPass(new OutputPass());
    composer = c;
  } catch (e) { console.warn("Bloom unavailable", e); }

  // --- placeholder character -----------------------------------------------
  const ch = new THREE.Group(); ch.position.set(0, 0, -0.78); scene.add(ch);
  const skin = 0xffe0cf, hair = 0x3a2d4a, hoodie = 0xf4ece2, accent = 0x5fb3b3, phones = 0xe2577a;
  box(0.46, 0.06, 0.42, 0x4b5d73, v(0, 0.47, 0), ch);                              // chair seat
  box(0.46, 0.6, 0.06, 0x4b5d73, v(0, 0.82, -0.22), ch);                          // chair back
  const torso = mesh(new THREE.CapsuleGeometry(0.15, 0.22, 4, 12), hoodie, v(0, 0.78, 0), ch, 1.05);
  torso.scale.set(1.15, 1, 0.8);
  limb(v(-0.05, 0.6, 0.02), v(-0.08, 0.6, 0.38), 0.075, 0x3d4560, ch); limb(v(0.05, 0.6, 0.02), v(0.08, 0.6, 0.38), 0.075, 0x3d4560, ch);
  limb(v(-0.08, 0.6, 0.38), v(-0.08, 0.08, 0.42), 0.06, 0x3d4560, ch); limb(v(0.08, 0.6, 0.38), v(0.08, 0.08, 0.42), 0.06, 0x3d4560, ch);
  const arms = new THREE.Group(); ch.add(arms);
  for (const s of [-1, 1]) {
    limb(v(s * 0.2, 0.93, 0), v(s * 0.22, 0.8, 0.28), 0.055, hoodie, arms);
    limb(v(s * 0.22, 0.8, 0.28), v(s * 0.1, 0.81, 0.62), 0.048, accent, arms);
    mesh(new THREE.SphereGeometry(0.04, 10, 8), skin, v(s * 0.09, 0.81, 0.66), arms, 1.06);
  }
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin, v(0, 1.0, 0), ch, 0);
  const head = new THREE.Group(); head.position.set(0, 1.15, 0.01); ch.add(head);
  const face = mesh(new THREE.SphereGeometry(0.14, 24, 18), skin, v(0, 0, 0), head, 1.04); face.scale.set(1, 1.05, 0.95);
  const hairBack = mesh(new THREE.SphereGeometry(0.155, 24, 18), hair, v(0, 0.025, -0.025), head, 1.03); hairBack.scale.set(1.05, 1.03, 1.02);
  const bangs = mesh(new THREE.SphereGeometry(0.15, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), hair, v(0, 0.02, 0.02), head, 0); bangs.rotation.x = 0.35;
  for (const s of [-1, 1]) { const lock = limb(v(s * 0.12, 0.02, 0.06), v(s * 0.1, -0.16, 0.07), 0.03, hair, head); lock.scale.z = 0.6; }
  const eyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshBasicMaterial({ color: 0x3b2a55 }));
    e.position.set(s * 0.05, -0.01, 0.128); e.scale.set(0.9, 1.3, 0.4); head.add(e); eyes.push(e);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(0.008, 0.01, 0.02); e.add(shine);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), new THREE.MeshBasicMaterial({ color: 0xff9fae, transparent: true, opacity: 0.5 }));
    blush.position.set(s * 0.075, -0.045, 0.122); blush.rotation.y = s * 0.5; head.add(blush);
  }
  // headphones
  const band = mesh(new THREE.TorusGeometry(0.168, 0.014, 8, 28, Math.PI), phones, v(0, 0.01, -0.01), head, 1.08);
  band.rotation.z = 0;
  for (const s of [-1, 1]) { const cup = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), phones, v(s * 0.16, 0.0, -0.01), head, 1.08); cup.rotation.z = Math.PI / 2; }

  // --- particles: petals + rain --------------------------------------------
  const PET = 160;
  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.04, 0.028), new THREE.MeshBasicMaterial({ color: 0xffc4d8, side: THREE.DoubleSide }), PET);
  const pd = Array.from({ length: PET }, () => ({ p: v((Math.random() - 0.5) * 7, Math.random() * 4, -1.7 - Math.random() * 5), s: 0.2 + Math.random() * 0.3, ph: Math.random() * 6 }));
  scene.add(petals);
  const RAIN = 500, rainPos = new Float32Array(RAIN * 6);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  for (let i = 0; i < RAIN; i++) { const x = (Math.random() - 0.5) * 8, y = Math.random() * 5, z = -1.8 - Math.random() * 6; rainPos.set([x, y, z, x - 0.02, y - 0.15, z], i * 6); }
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc8d8f0, transparent: true, opacity: 0.55 }));
  scene.add(rain);

  // --- optional VRM model ---------------------------------------------------
  const VRM_Z = -0.62;
  let flip = 1;
  type VRMLike = { scene: THREE.Object3D; update(d: number): void; expressionManager?: { setValue(n: string, v: number): void } | null; humanoid: { getNormalizedBoneNode(n: string): THREE.Object3D | null; update?(): void }; lookAt?: { target?: THREE.Object3D } | null; meta?: { metaVersion?: string } };
  let vrm: VRMLike | null = null;
  try {
    if (opts.modelUrl) {
      const [{ GLTFLoader }, { VRMLoaderPlugin, VRMUtils }] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("@pixiv/three-vrm")]);
      const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p));
      const gltf = await loader.loadAsync(opts.modelUrl);
      const loaded = gltf.userData.vrm;
      VRMUtils.rotateVRM0(loaded);
      const bone = (n: string) => loaded.humanoid.getNormalizedBoneNode(n) as THREE.Object3D | null;
      // Seated typing pose on normalized bones. VRM 0.x models are rotated 180° by rotateVRM0, so mirror X/Z rotations.
      const f = loaded.meta?.metaVersion === "0" ? -1 : 1;
      flip = f;
      const set = (n: string, x: number, y: number, z: number) => bone(n)?.rotation.set(f * x, y, f * z);
      for (const [side, k] of [["left", 1], ["right", -1]] as const) {
        set(`${side}UpperLeg`, -Math.PI / 2, 0, 0);
        set(`${side}LowerLeg`, Math.PI / 2, 0, 0);
        set(`${side}UpperArm`, 0, -k * 0.9, -k * 0.85);
        set(`${side}LowerArm`, 0, -k * 0.9, k * 0.8);
        set(`${side}Hand`, 0, 0, k * 0.15);
      }
      set("spine", 0.12, 0, 0);
      set("neck", 0.1, 0, 0);
      loaded.humanoid.update?.();
      loaded.scene.updateMatrixWorld(true);
      const hipY = bone("hips")?.getWorldPosition(new THREE.Vector3()).y ?? 0.9;
      // Fit seat height to the model so hands reach the keyboard (desk top is 0.775).
      const handY = bone("leftHand")?.getWorldPosition(new THREE.Vector3()).y ?? hipY;
      const seatLift = Math.max(0, 0.8 - (0.56 + handY - hipY));
      loaded.scene.position.set(0, 0.56 + seatLift - hipY, VRM_Z);
      ch.children[0].position.y += seatLift; ch.children[1].position.y += seatLift;
      scene.add(loaded.scene);
      if (loaded.lookAt) loaded.lookAt.target = camera;
      ch.children.forEach((c) => { if (c !== ch.children[0] && c !== ch.children[1]) c.visible = false; }); // keep the chair
      vrm = loaded;
    }
  } catch (e) { console.warn("VRM model not loaded; using placeholder", e); }

  // --- state / animation ----------------------------------------------------
  let state = opts.state, reduced = opts.reducedMotion, raining = opts.rain, raf = 0, t = 0, blinkT = 2;
  const clock = new THREE.Clock();
  const dummy = new THREE.Object3D();
  const applyState = () => {
    const visible = state !== "BUSY";
    ch.visible = visible; if (vrm) vrm.scene.visible = visible;
    head.rotation.x = state === "SLEEPING" ? 0.55 : 0.08;
    const hb = vrm?.humanoid.getNormalizedBoneNode("head"); if (hb) hb.rotation.x = flip * (state === "SLEEPING" ? 0.5 : 0);
    screen.material.color.set(state === "SLEEPING" ? 0x1a1a22 : 0x9fd2ff);
    rain.visible = raining;
  };
  applyState();

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1, a = w / h;
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(renderer.getPixelRatio()); composer?.setSize(w, h);
    camera.aspect = a;
    camera.fov = a < 0.75 ? 58 : a < 1.2 ? 44 : 34;
    const back = a < 0.75 ? 1.15 : 1;
    camera.position.set(-0.75 * back, 1.38, 1.75 * back);
    camera.lookAt(0.1, 1.02, -0.7);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    if (!reduced) {
      t += dt;
      const breath = Math.sin(t * (state === "SLEEPING" ? 1.3 : 2.1));
      torso.scale.y = 1 + breath * 0.012; head.position.y = 1.15 + breath * 0.004;
      arms.position.y = state === "AVAILABLE" ? Math.max(0, Math.sin(t * 14)) * 0.004 : 0;
      head.rotation.y = state === "AVAILABLE" ? Math.sin(t * 0.4) * 0.08 : 0;
      for (let i = 0; i < PET; i++) {
        const d = pd[i];
        d.p.y -= d.s * dt; d.p.x += Math.sin(t * 1.5 + d.ph) * 0.004 + 0.002;
        if (d.p.y < 0) { d.p.y = 4; d.p.x = (Math.random() - 0.5) * 7; }
        dummy.position.copy(d.p); dummy.rotation.set(t * 2 + d.ph, t + d.ph, 0); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
      if (raining) {
        for (let i = 0; i < RAIN; i++) {
          let y = rainPos[i * 6 + 1] - 7 * dt;
          if (y < -0.5) y += 5.5;
          rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y - 0.15;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    } else if (t === 0) {
      for (let i = 0; i < PET; i++) { dummy.position.copy(pd[i].p); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix); }
      petals.instanceMatrix.needsUpdate = true; t = 0.0001;
    }
    // blink
    blinkT -= dt;
    const closed = state === "SLEEPING" || (state === "AVAILABLE" && blinkT < 0);
    if (blinkT < -0.12) blinkT = 2 + Math.random() * 3;
    eyes.forEach((e) => (e.scale.y = closed ? 0.15 : 1.3));
    if (vrm) {
      const em = vrm.expressionManager;
      em?.setValue("blink", closed ? 1 : 0);
      em?.setValue("relaxed", state === "AVAILABLE" ? 0.35 : 0);
      const chest = vrm.humanoid.getNormalizedBoneNode("chest");
      if (chest && !reduced) chest.rotation.x = flip * Math.sin(t * (state === "SLEEPING" ? 1.3 : 2.1)) * 0.02;
      const hb = vrm.humanoid.getNormalizedBoneNode("head");
      if (hb && !reduced) { hb.rotation.x = flip * (state === "SLEEPING" ? 0.5 : 0.05); hb.rotation.y = state === "AVAILABLE" ? Math.sin(t * 0.4) * 0.1 : 0; }
      vrm.update(dt);
    }
    lamp.intensity = pal.lamp * (state === "SLEEPING" ? 0.5 : 1) * (reduced ? 1 : 1 + Math.sin(t * 3) * 0.02);
    env.update(t, dt, reduced);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
  };
  loop();

  return {
    hasVrm: !!vrm,
    setState(s) { state = s; applyState(); },
    setReducedMotion(r) { reduced = r; },
    setRain(on) { raining = on; applyState(); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
      kit.dispose(); composer?.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
