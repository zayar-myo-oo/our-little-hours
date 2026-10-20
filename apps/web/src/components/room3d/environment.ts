// Anime-style environment: painted sky + drifting clouds, distant city, sakura trees, cozy room, desk.
// All art is original and procedural (canvas-painted textures + cel-shaded primitives).
import * as THREE from "three";
import { v, rng, type Kit } from "./kit";
import type { Palette } from "./timeOfDay";

export interface Environment {
  lamp: THREE.PointLight;
  screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  update(t: number, dt: number, reduced: boolean): void;
}

// ---------------------------------------------------------------- painting --
export function paintSky(g: CanvasRenderingContext2D, W: number, H: number, p: Palette) {
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, p.skyTop); lg.addColorStop(0.78, p.skyBottom); lg.addColorStop(1, p.skyBottom);
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const night = p.phase === "night";
  const sx = W * 0.68, sy = H * (night ? 0.22 : p.phase === "sunset" ? 0.72 : 0.28);
  const rg = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.75);
  rg.addColorStop(0, p.glow); rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  if (night) {
    const r = rng(7);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; const s = r() < 0.08 ? 2.2 : 1.1; g.fillRect(r() * W, r() * H * 0.7, s, s); }
    g.fillStyle = "#fff6dc"; g.beginPath(); g.arc(sx, sy, 22, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.arc(sx, sy, p.phase === "sunset" ? 34 : 26, 0, Math.PI * 2); g.fill();
  }
}

export function paintClouds(g: CanvasRenderingContext2D, W: number, H: number, p: Palette) {
  const r = rng(11);
  const puff = (cx: number, cy: number, s: number) => {
    const blobs = Array.from({ length: 7 }, (_, i) => ({ x: (i - 3) * 22 * s + (r() - 0.5) * 14 * s, y: -Math.sin((i / 6) * Math.PI) * 26 * s + (r() - 0.5) * 8 * s, rad: (20 + r() * 18) * s }));
    for (const off of [-W, 0, W]) {
      g.fillStyle = p.cloudShade;
      for (const b of blobs) { g.beginPath(); g.arc(cx + off + b.x, cy + b.y + 7 * s, b.rad, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = p.cloud;
      for (const b of blobs) { g.beginPath(); g.arc(cx + off + b.x - 3 * s, cy + b.y - 2 * s, b.rad * 0.92, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = p.cloudShade; g.fillRect(cx + off - 75 * s, cy + 14 * s, 150 * s, 16 * s);
    }
  };
  for (let i = 0; i < 9; i++) puff(r() * W, 70 + r() * (H - 130), 0.6 + r() * 0.8);
}

export function paintCity(g: CanvasRenderingContext2D, W: number, H: number, p: Palette) {
  const r = rng(23);
  for (const [layer, alpha] of [[0, 0.55], [1, 1]] as const) {
    let x = 0;
    while (x < W) {
      const w = 28 + r() * 46, h = (layer ? 50 : 90) + r() * (layer ? 120 : 110);
      g.globalAlpha = alpha; g.fillStyle = p.city; g.fillRect(x, H - h, w, h);
      if (layer) for (let wy = H - h + 10; wy < H - 8; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 11)
        if (r() < (p.phase === "night" ? 0.35 : 0.6)) { g.fillStyle = p.cityWindow; g.fillRect(wx, wy, 5, 7); }
      x += w + r() * 6;
    }
  }
  g.globalAlpha = 1;
}

export function paintFloor(g: CanvasRenderingContext2D, W: number, H: number) {
  const r = rng(5), cols = ["#c99a72", "#c3926a", "#cfa37c", "#be8d66"];
  const plank = H / 8;
  for (let i = 0; i < 8; i++) {
    let x = -r() * 200;
    while (x < W) { const len = 180 + r() * 160; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, i * plank, len, plank); g.fillStyle = "rgba(90,55,35,0.35)"; g.fillRect(x, i * plank, 2, plank); x += len; }
    g.fillStyle = "rgba(90,55,35,0.4)"; g.fillRect(0, i * plank, W, 2);
  }
}

// ------------------------------------------------------------- environment --
export function buildEnvironment(kit: Kit, scene: THREE.Scene, pal: Palette): Environment {
  const { box, mesh, limb, canvasTex, toon, toonMat, track } = kit;
  const updaters: ((t: number, dt: number) => void)[] = [];
  const always: (() => void)[] = [];
  const night = pal.phase === "night";

  // lights
  scene.add(new THREE.HemisphereLight(night ? 0x8090d0 : 0xfff4ec, 0x9a7a6a, pal.ambient));
  const sun = new THREE.DirectionalLight(pal.sun, pal.sunIntensity); sun.position.set(1.5, 4, -6); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffe8dc, night ? 0.3 : 0.6); fill.position.set(-2, 2, 4); scene.add(fill);
  const lamp = new THREE.PointLight(0xffc27a, pal.lamp, 4, 1.5); lamp.position.set(-0.85, 1.05, 0.02); scene.add(lamp);
  const fairyGlow = new THREE.PointLight(0xffb8c8, night ? 0.8 : 0.15, 3.5, 1.8); fairyGlow.position.set(0, 2.55, -1.0); scene.add(fairyGlow);
  scene.fog = new THREE.Fog(pal.fog, 10, 34);

  // sky, clouds, city
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(46, 19), new THREE.MeshBasicMaterial({ map: canvasTex(1024, 512, (g, w, h) => paintSky(g, w, h, pal)), fog: false }));
  sky.position.set(0, 4, -16); scene.add(sky);
  const cloudTex = canvasTex(1024, 320, (g, w, h) => paintClouds(g, w, h, pal)); cloudTex.wrapS = THREE.RepeatWrapping;
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(44, 9), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, fog: false, depthWrite: false }));
  clouds.position.set(0, 6, -15.5); scene.add(clouds);
  updaters.push((_, dt) => { cloudTex.offset.x += dt * 0.004; });
  const city = new THREE.Mesh(new THREE.PlaneGeometry(34, 4), new THREE.MeshBasicMaterial({ map: canvasTex(1024, 220, (g, w, h) => paintCity(g, w, h, pal)), transparent: true, depthWrite: false }));
  city.position.set(0, 0.9, -13); scene.add(city);
  // ground + hill
  box(40, 0.1, 24, night ? 0x3d5a4a : 0xa9cf8f, v(0, -0.35, -12), scene, 0);
  const hill = mesh(new THREE.SphereGeometry(1, 32, 16), night ? 0x34503f : 0x9cc684, v(-3, -1.4, -10.5), scene, 0); hill.scale.set(9, 2.2, 3);

  // sakura trees (one instanced canopy for everything)
  const blossomCols = ["#ffd3e2", "#f9b6cd", "#f5a3c0", "#ffe6ef", "#fbc4d6"].map((c) => new THREE.Color(c));
  const blooms: { p: THREE.Vector3; s: number }[] = [];
  const r = rng(42), trunkC = 0x6d4a48;
  for (const t of [{ x: -4.6, z: -8, s: 1.0 }, { x: -2.7, z: -10.5, s: 1.05 }, { x: 2.9, z: -8.6, s: 1.0 }, { x: 5.0, z: -10.2, s: 1.2 }, { x: -7.2, z: -11, s: 1.2 }, { x: 7.4, z: -11.5, s: 1.2 }, { x: 0.4, z: -12.2, s: 0.85 }]) {
    const base = v(t.x, -0.3, t.z), top = v(t.x + 0.1, 1.6 * t.s, t.z);
    limb(base, top, 0.11 * t.s, trunkC, scene, 0);
    for (const a of [-0.9, 0.2, 1.1]) limb(v(t.x, 1.2 * t.s, t.z), v(t.x + Math.cos(a) * 0.9 * t.s, 1.95 * t.s, t.z + Math.sin(a) * 0.4), 0.05 * t.s, trunkC, scene, 0);
    for (let i = 0; i < 110; i++) {
      const u = r() * Math.PI * 2, w = Math.acos(2 * r() - 1), k = Math.cbrt(r());
      blooms.push({ p: v(t.x + Math.sin(w) * Math.cos(u) * 1.45 * t.s * k, 2.1 * t.s + Math.cos(w) * 0.8 * t.s * k, t.z + Math.sin(w) * Math.sin(u) * 0.9 * t.s * k), s: (0.16 + r() * 0.17) * t.s });
    }
  }
  // foreground branches reaching into the top corners of the window
  for (const br of [[v(2.7, 2.75, -1.95), v(1.5, 2.4, -1.9), v(0.75, 2.33, -1.88), v(0.1, 2.44, -1.85)], [v(-2.7, 2.85, -2.05), v(-1.4, 2.5, -2.0), v(-0.8, 2.48, -1.98)]]) {
    for (let i = 0; i < br.length - 1; i++) limb(br[i], br[i + 1], 0.045 - i * 0.01, trunkC, scene, 1.08);
    for (let i = 0; i < 90; i++) {
      const j = Math.floor(r() * (br.length - 1)), f = r();
      blooms.push({ p: br[j].clone().lerp(br[j + 1], f).add(v((r() - 0.5) * 0.3, (r() - 0.45) * 0.24, (r() - 0.5) * 0.2)), s: 0.035 + r() * 0.045 });
    }
  }
  const canopy = new THREE.InstancedMesh(track(new THREE.IcosahedronGeometry(1, 2)), toonMat({ color: 0xffffff }), blooms.length);
  const dm = new THREE.Object3D();
  blooms.forEach((b, i) => { dm.position.copy(b.p); dm.scale.setScalar(b.s); dm.updateMatrix(); canopy.setMatrixAt(i, dm.matrix); canopy.setColorAt(i, blossomCols[i % blossomCols.length]); });
  scene.add(canopy);

  // room shell
  const wallC = 0xf8ecdf, wainC = 0xe8cfb4, trimC = 0xfffaf2, woodC = 0xb07a52, darkWood = 0x6e4630;
  box(1.4, 3.2, 0.12, wallC, v(-2.3, 1.6, -1.5), scene, 0);
  box(1.4, 3.2, 0.12, wallC, v(2.3, 1.6, -1.5), scene, 0);
  box(3.2, 1.0, 0.12, wallC, v(0, 0.5, -1.5), scene, 0);
  box(3.2, 0.6, 0.12, wallC, v(0, 2.9, -1.5), scene, 0);
  box(6, 0.85, 0.03, wainC, v(0, 0.425, -1.43), scene, 0);
  box(6, 0.05, 0.05, trimC, v(0, 0.86, -1.42), scene, 0);
  box(0.12, 3.2, 5, 0xf1e2d2, v(-3, 1.6, 1), scene, 0);
  const floorTex = canvasTex(1024, 512, paintFloor); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), toonMat({ map: floorTex })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.026, 1); scene.add(floor);
  const rug = mesh(new THREE.CircleGeometry(1.15, 40), 0xf0c4c0, v(0, 0.03, 0.55), scene, 0); rug.rotation.x = -Math.PI / 2;
  const rug2 = mesh(new THREE.RingGeometry(0.8, 0.88, 40), 0xfbe4dc, v(0, 0.032, 0.55), scene, 0); rug2.rotation.x = -Math.PI / 2;

  // window frame + sill + sill decor
  for (const [w, h, x, y] of [[3.3, 0.08, 0, 2.6], [3.3, 0.08, 0, 1.0], [0.08, 1.6, -1.6, 1.8], [0.08, 1.6, 1.6, 1.8], [0.05, 1.6, 0, 1.8]] as const)
    box(w, h, 0.14, trimC, v(x, y, -1.48), scene, 1.02);
  box(3.4, 0.05, 0.35, trimC, v(0, 1.0, -1.32), scene, 1.02);
  mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 14), 0xe39a74, v(-1.2, 1.1, -1.3));
  for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.07, 12, 10), 0x74b36f, v(-1.2 + Math.cos(i) * 0.07, 1.24 + (i % 3) * 0.05, -1.3 + Math.sin(i) * 0.06), scene, 1.05);
  mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 12), 0xb7d7e8, v(1.05, 1.07, -1.3));
  mesh(new THREE.SphereGeometry(0.06, 12, 10), 0x8cc48a, v(1.05, 1.15, -1.3), scene, 1.05);
  box(0.12, 0.16, 0.02, 0xfff0f4, v(0.6, 1.11, -1.36), scene, 1.04).rotation.x = -0.15; // photo frame

  // sheer curtains (vertex-animated folds) + rod
  limb(v(-2.3, 2.9, -1.3), v(2.3, 2.9, -1.3), 0.018, 0xd9c2a8, scene, 0);
  const curtainMat = toonMat({ color: 0xfff1f3, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const geo = track(new THREE.PlaneGeometry(0.8, 2.05, 28, 6));
    const base = Float32Array.from(geo.attributes.position.array as Float32Array);
    const c = new THREE.Mesh(geo, curtainMat); c.position.set(side * 1.72, 1.86, -1.28); scene.add(c);
    updaters.push((t) => {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], low = (1.025 - y) / 2.05; // 0 at top → 1 at bottom
        pos.setX(i, x + side * low * low * 0.18);
        pos.setZ(i, Math.sin(x * 26 + side) * 0.035 + Math.sin(t * 0.9 + x * 3) * 0.02 * low);
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    });
  }

  // fairy lights along the top of the window
  const bulbCols = [0xfff1c9, 0xffd0dc, 0xffe2a8, 0xffc4e0].map((c) => new THREE.Color(c));
  const wire: THREE.Vector3[] = [], bulbs: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
  for (let i = 0; i <= 40; i++) { const x = -1.75 + (3.5 * i) / 40; wire.push(v(x, 2.82 - 0.16 * (1 - (x / 1.75) ** 2), -1.27)); }
  scene.add(new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(wire)), track(new THREE.LineBasicMaterial({ color: 0x5a4a44 }))));
  const bulbGeo = track(new THREE.SphereGeometry(0.024, 10, 8));
  for (let i = 1; i < 40; i += 2) {
    const b = new THREE.Mesh(bulbGeo, track(new THREE.MeshBasicMaterial({ color: bulbCols[i % 4].clone() })));
    b.position.copy(wire[i]).add(v(0, -0.03, 0)); scene.add(b); bulbs.push(b);
  }
  const bulbBoost = night ? 1.6 : 1.0;
  updaters.push((t) => bulbs.forEach((b, i) => b.material.color.copy(bulbCols[(i * 2 + 1) % 4]).multiplyScalar(bulbBoost * (0.75 + 0.35 * Math.sin(t * 1.7 + i * 1.3)))));

  // sun rays + dust motes (daytime only)
  if (pal.rays) {
    const rayTex = canvasTex(64, 256, (g, w, h) => { const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, "rgba(255,248,225,0.9)"); lg.addColorStop(1, "rgba(255,248,225,0)"); g.fillStyle = lg; g.fillRect(0, 0, w, h); });
    const rayMats: THREE.MeshBasicMaterial[] = [];
    for (const [x, w] of [[-0.9, 0.55], [-0.15, 0.4], [0.7, 0.6]] as const) {
      const m = track(new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const ray = new THREE.Mesh(track(new THREE.PlaneGeometry(w, 2.6)), m);
      ray.position.set(x - 0.3, 1.55, -0.65); ray.rotation.set(-0.85, 0.25, 0.32); scene.add(ray); rayMats.push(m);
    }
    updaters.push((t) => rayMats.forEach((m, i) => (m.opacity = 0.13 + Math.sin(t * 0.5 + i * 2) * 0.04)));
    const N = 70, dust = new Float32Array(N * 3), dr = rng(3);
    for (let i = 0; i < N; i++) dust.set([-1.2 + dr() * 2.2, 0.8 + dr() * 1.6, -1.2 + dr() * 1.2], i * 3);
    const dustGeo = track(new THREE.BufferGeometry()); dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
    scene.add(new THREE.Points(dustGeo, track(new THREE.PointsMaterial({ color: 0xfff4d6, size: 0.012, transparent: true, opacity: 0.8 }))));
    updaters.push((t) => { for (let i = 0; i < N; i++) dust[i * 3 + 1] = 0.8 + ((dust[i * 3 + 1] - 0.8 + 0.0006 + Math.sin(t + i) * 0.0004 + 1.6) % 1.6); dustGeo.attributes.position.needsUpdate = true; });
  }

  // corkboard with notes (left wall)
  box(0.85, 0.6, 0.03, 0xc79f78, v(-2.25, 1.85, -1.42), scene, 1.02);
  const nr = rng(9), noteCols = [0xfff2a8, 0xffd1dc, 0xc8e8ff, 0xd8f5c8];
  for (let i = 0; i < 6; i++) { const n = box(0.15, 0.15, 0.005, noteCols[i % 4], v(-2.55 + (i % 3) * 0.28 + nr() * 0.04, 1.97 - Math.floor(i / 3) * 0.24, -1.4), scene, 0); n.rotation.z = (nr() - 0.5) * 0.3; }

  // wall clock showing the real time (above shelf)
  const clockFace = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 32), 0xfffaf2, v(2.35, 2.4, -1.42), scene, 1.06); clockFace.rotation.x = Math.PI / 2;
  const hand = (len: number, w: number) => { const g = new THREE.Group(); g.position.set(2.35, 2.4, -1.4); const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, len, 0.01)), toon(0x3a2d3a)); m.position.y = len / 2; g.add(m); scene.add(g); return g; };
  const hourHand = hand(0.08, 0.016), minHand = hand(0.13, 0.01);
  always.push(() => { const d = new Date(); const m = d.getMinutes() + d.getSeconds() / 60; minHand.rotation.z = -(m / 60) * Math.PI * 2; hourHand.rotation.z = -(((d.getHours() % 12) + m / 60) / 12) * Math.PI * 2; });

  // shelf with books + trailing plant
  box(0.9, 1.8, 0.35, darkWood, v(2.4, 0.9, -1.2));
  const bookC = [0xe48a8a, 0x8cc3e0, 0xf0cf7c, 0xa594d6, 0x8fd1a8, 0xf5b8cf];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) box(0.1, 0.32 + ((i + row) % 3) * 0.04, 0.24, bookC[(i + row) % 6], v(2.05 + i * 0.13, 0.35 + row * 0.55, -1.12), scene, 1.02);
  mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.14, 14), 0xf3e2cf, v(2.4, 1.87, -1.2));
  for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.045, 10, 8), 0x6fb06c, v(2.3 + (i % 3) * 0.08, 1.92 - i * 0.07, -1.05 + (i % 2) * 0.03), scene, 1.06);

  // desk + props
  box(2.4, 0.05, 0.85, woodC, v(0, 0.75, 0));
  for (const x of [-1.1, 1.1]) for (const z of [-0.35, 0.35]) box(0.06, 0.75, 0.06, darkWood, v(x, 0.375, z), scene, 0);
  box(2.2, 0.5, 0.03, darkWood, v(0, 0.48, 0.38), scene, 0);
  box(0.55, 0.025, 0.18, 0xf4f1ec, v(0, 0.79, -0.24));
  for (let i = 0; i < 4; i++) box(0.5, 0.012, 0.025, 0xd5d0c8, v(0, 0.805, -0.31 + i * 0.045), scene, 0);
  box(0.07, 0.02, 0.1, 0xf4f1ec, v(0.45, 0.785, -0.22));
  const mon = new THREE.Group(); mon.position.set(0.75, 0.78, -0.1); mon.rotation.y = -2.3; scene.add(mon);
  box(0.62, 0.38, 0.03, 0x3a3a46, v(0, 0.33, 0), mon);
  box(0.05, 0.16, 0.05, 0x3a3a46, v(0, 0.08, -0.02), mon); box(0.2, 0.015, 0.14, 0x3a3a46, v(0, 0.007, 0), mon);
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.58, 0.34)), track(new THREE.MeshBasicMaterial({ color: 0x9fd2ff }))); screen.position.set(0, 0.33, 0.017); mon.add(screen);
  mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 16), 0xfbe3ea, v(-0.45, 0.82, 0.15));
  for (let i = 0; i < 3; i++) box(0.3, 0.05, 0.22, bookC[i], v(-0.7, 0.8 + i * 0.05, 0.2), scene, 1.02);
  box(0.25, 0.008, 0.33, 0xfffaf0, v(0.2, 0.778, 0.2), scene, 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 12), 0xb7d7e8, v(0.95, 0.81, 0.25));
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.035, 10, 8), 0x7cc285, v(0.95 + Math.cos(i * 1.6) * 0.03, 0.87, 0.25 + Math.sin(i * 1.6) * 0.03), scene, 1.06);
  // desk lamp
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 16), 0x3b3b44, v(-0.85, 0.79, -0.15));
  limb(v(-0.85, 0.8, -0.15), v(-0.85, 1.2, -0.1), 0.015, 0x3b3b44);
  mesh(new THREE.ConeGeometry(0.12, 0.14, 16, 1, true), 0xf2c46b, v(-0.85, 1.22, -0.03)).rotation.x = 0.5;
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.035, 10, 8)), track(new THREE.MeshBasicMaterial({ color: 0xfff2c8 }))); bulb.position.set(-0.85, 1.17, -0.01); scene.add(bulb);

  for (const u of updaters) u(0, 0); // settle the first frame (also the static look under reduced motion)
  return {
    lamp, screen,
    update(t, dt, reduced) { for (const a of always) a(); if (reduced) return; for (const u of updaters) u(t, dt); },
  };
}
