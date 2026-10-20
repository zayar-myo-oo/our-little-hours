// Prefab builders for the Living World study (original placeholder art: cel-shaded primitives + canvas paint).
// Each builder returns a group at its local origin (floor level); the location manifest places it.
// Final art can replace a builder later (e.g. load a GLB) without changing any manifest.
import * as THREE from "three";
import { v, rng, type Kit } from "@/components/room3d/kit";
import { paintSky, paintClouds, paintCity, paintFloor } from "@/components/room3d/environment";
import type { Palette } from "@/components/room3d/timeOfDay";
import type { PrefabId } from "./ids";

export interface PrefabContext { kit: Kit; pal: Palette; lowQuality: boolean }
export interface PrefabResult { object: THREE.Object3D; lights?: THREE.Light[]; update?: (t: number) => void }
type Builder = (ctx: PrefabContext) => PrefabResult;

const C = {
  wall: 0xf8ecdf, wain: 0xe8cfb4, trim: 0xfffaf2, wood: 0xb07a52, darkWood: 0x6e4630, metal: 0x3b3b44,
  fabric: 0xd98f7a, cushion: 0xf3d3c6, leaf: 0x6fae6a, leafDark: 0x4f8f5a, pot: 0xe39a74, potBlue: 0xb7d7e8,
};
const BOOKS = [0xe48a8a, 0x8cc3e0, 0xf0cf7c, 0xa594d6, 0x8fd1a8, 0xf5b8cf];

function group(...children: THREE.Object3D[]) { const g = new THREE.Group(); g.add(...children); return g; }

function books(kit: Kit, g: THREE.Object3D, x0: number, width: number, y: number, z: number, seed: number) {
  const r = rng(seed);
  let x = x0;
  for (let i = 0; x < x0 + width - 0.08; i++) {
    const w = 0.06 + r() * 0.05, h = 0.22 + r() * 0.1;
    kit.box(w, h, 0.2, BOOKS[i % BOOKS.length], v(x + w / 2, y + h / 2, z), g, 1.02);
    x += w + 0.01;
  }
}

function leaves(kit: Kit, g: THREE.Object3D, center: THREE.Vector3, n: number, spread: number, size: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const m = kit.mesh(new THREE.SphereGeometry(size * (0.7 + r() * 0.6), 10, 8), i % 3 ? C.leaf : C.leafDark,
      center.clone().add(v((r() - 0.5) * spread, (r() - 0.3) * spread, (r() - 0.5) * spread)), g, 1.05);
    m.scale.set(1, 0.7, 1.2);
  }
}

const builders: Record<PrefabId, Builder> = {
  floor_wood: ({ kit }) => {
    const tex = kit.canvasTex(1024, 512, paintFloor); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 1.6);
    const floor = new THREE.Mesh(kit.track(new THREE.PlaneGeometry(6, 5)), kit.toonMat({ map: tex }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001;
    const g = group(floor);
    kit.box(6.1, 0.12, 5.1, C.darkWood, v(0, -0.06, 0), g, 0); // diorama base edge
    return { object: g };
  },

  wall_back_window: ({ kit }) => {
    // Opening: x ∈ [-2.4, 0.4], y ∈ [1.0, 2.4] (local x matches world x; group sits at z = -2.5)
    const g = new THREE.Group(), t = 0.1, z = -t / 2;
    kit.box(0.6, 2.8, t, C.wall, v(-2.7, 1.4, z), g, 0);
    kit.box(2.6, 2.8, t, C.wall, v(1.7, 1.4, z), g, 0);
    kit.box(2.8, 1.0, t, C.wall, v(-1.0, 0.5, z), g, 0);
    kit.box(2.8, 0.4, t, C.wall, v(-1.0, 2.6, z), g, 0);
    kit.box(6, 0.85, 0.03, C.wain, v(0, 0.425, 0.015), g, 0);
    kit.box(6, 0.05, 0.05, C.trim, v(0, 0.86, 0.03), g, 0);
    for (const [w, h, x, y] of [[2.9, 0.08, -1.0, 2.4], [2.9, 0.08, -1.0, 1.0], [0.08, 1.4, -2.4, 1.7], [0.08, 1.4, 0.4, 1.7], [0.05, 1.4, -1.0, 1.7]] as const)
      kit.box(w, h, 0.14, C.trim, v(x, y, 0), g, 1.02);
    kit.box(3.0, 0.05, 0.3, C.trim, v(-1.0, 1.0, 0.15), g, 1.02);
    // curtains (static folds) either side of the window
    for (const x of [-2.6, 0.6]) {
      const geo = kit.track(new THREE.PlaneGeometry(0.45, 1.75, 12, 1));
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 30) * 0.03);
      geo.computeVertexNormals();
      const c = new THREE.Mesh(geo, kit.toonMat({ color: 0xfff1f3, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      c.position.set(x, 1.62, 0.12); g.add(c);
    }
    kit.limb(v(-2.9, 2.5, 0.12), v(0.9, 2.5, 0.12), 0.015, 0xd9c2a8, g, 0);
    return { object: g };
  },

  wall_left: ({ kit }) => {
    const g = new THREE.Group(), t = 0.1;
    kit.box(t, 2.8, 5, 0xf1e2d2, v(-t / 2, 1.4, 0), g, 0);
    kit.box(0.03, 0.85, 5, C.wain, v(0.015, 0.425, 0), g, 0);
    kit.box(0.05, 0.05, 5, C.trim, v(0.03, 0.86, 0), g, 0);
    // framed original art (pastel shapes) and a small corkboard
    kit.box(0.04, 0.6, 0.8, C.trim, v(0.03, 1.85, 0.9), g, 1.03);
    const art = kit.canvasTex(256, 192, (c, w, h) => {
      c.fillStyle = "#fde7ea"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#f7b6cf"; c.beginPath(); c.arc(w * 0.35, h * 0.55, 46, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#a9d5e8"; c.fillRect(w * 0.5, h * 0.25, 80, 90);
      c.fillStyle = "#f0cf7c"; c.beginPath(); c.arc(w * 0.75, h * 0.3, 18, 0, Math.PI * 2); c.fill();
    });
    const pic = new THREE.Mesh(kit.track(new THREE.PlaneGeometry(0.72, 0.52)), kit.toonMat({ map: art }));
    pic.position.set(0.055, 1.85, 0.9); pic.rotation.y = Math.PI / 2; g.add(pic);
    kit.box(0.03, 0.5, 0.7, 0xc79f78, v(0.03, 1.8, -1.2), g, 1.02);
    const r = rng(9), notes = [0xfff2a8, 0xffd1dc, 0xc8e8ff, 0xd8f5c8];
    for (let i = 0; i < 4; i++) kit.box(0.005, 0.13, 0.13, notes[i], v(0.05, 1.88 - Math.floor(i / 2) * 0.2, -1.4 + (i % 2) * 0.3 + r() * 0.04), g, 0).rotation.x = (r() - 0.5) * 0.3;
    return { object: g };
  },

  window_view: ({ kit, pal, lowQuality }) => {
    // A painted view filling exactly the window opening (2.8 × 1.4 m), so nothing outside leaks past the
    // diorama walls in the overview. Local origin = opening centre on the floor line; group sits at z = -2.5.
    const r = rng(42);
    const tex = kit.canvasTex(1024, 512, (c, w, h) => {
      // the legacy sky's sun glow is sized for a huge backdrop; through a small window it washes everything out
      paintSky(c, w, h, { ...pal, glow: "rgba(255,250,235,0.25)" }); paintClouds(c, w, h * 0.7, pal);
      c.save(); c.translate(0, h * 0.42); paintCity(c, w, h * 0.45, pal); c.restore();
      c.fillStyle = pal.phase === "night" ? "#2f4a3c" : "#a9cf8f"; c.fillRect(0, h * 0.86, w, h * 0.14);
      const pinks = ["#ffd3e2", "#f9b6cd", "#f5a3c0", "#ffe6ef"];
      const trees: [number, number, number][] = [[0.12, 0.72, 1], [0.55, 0.78, 0.8], [0.9, 0.66, 1.15]];
      for (const [tx, ty, s] of trees) {
        c.fillStyle = "#6d4a48"; c.fillRect(w * tx - 6 * s, h * ty, 12 * s, h * 0.3);
        for (let i = 0; i < (lowQuality ? 18 : 40); i++) {
          c.fillStyle = pinks[i % 4]; c.beginPath();
          c.arc(w * tx + (r() - 0.5) * 230 * s, h * ty - 20 * s + (r() - 0.5) * 120 * s, (22 + r() * 22) * s, 0, Math.PI * 2); c.fill();
        }
      }
    });
    const view = new THREE.Mesh(kit.track(new THREE.PlaneGeometry(2.8, 1.4)), kit.track(new THREE.MeshBasicMaterial({ map: tex, fog: false, color: 0xc9c4c8 })));  // seen through glass: slightly dimmer, avoids bloom wash-out
    view.position.set(0, 1.7, -0.25);
    return { object: group(view) }; // wrap: the renderer sets the returned object's position from the manifest
  },

  rug_round: ({ kit }) => {
    const g = new THREE.Group();
    const a = kit.mesh(new THREE.CircleGeometry(1.25, 40), 0xf0c4c0, v(0, 0.006, 0), g, 0); a.rotation.x = -Math.PI / 2;
    const b = kit.mesh(new THREE.RingGeometry(0.85, 0.93, 40), 0xfbe4dc, v(0, 0.008, 0), g, 0); b.rotation.x = -Math.PI / 2;
    return { object: g };
  },

  desk: ({ kit }) => {
    const g = new THREE.Group();
    kit.box(1.5, 0.05, 0.7, C.wood, v(0, 0.75, 0), g);
    for (const x of [-0.7, 0.7]) for (const z of [-0.3, 0.3]) kit.box(0.05, 0.75, 0.05, C.darkWood, v(x, 0.375, z), g, 0);
    kit.box(1.4, 0.45, 0.03, C.darkWood, v(0, 0.5, 0.33), g, 0); // modesty panel (camera side)
    kit.box(0.55, 0.025, 0.18, 0xf4f1ec, v(0, 0.79, -0.24), g);  // keyboard, at the sitter's edge
    for (let i = 0; i < 4; i++) kit.box(0.5, 0.012, 0.025, 0xd5d0c8, v(0, 0.805, -0.31 + i * 0.045), g, 0);
    kit.box(0.07, 0.02, 0.1, 0xf4f1ec, v(0.42, 0.785, -0.22), g);
    const mon = new THREE.Group(); mon.position.set(-0.45, 0.775, 0.05); mon.rotation.y = Math.PI + 0.45; g.add(mon); // left side: keeps her visible from the camera
    kit.box(0.58, 0.36, 0.03, 0x3a3a46, v(0, 0.33, 0), mon); kit.box(0.05, 0.16, 0.05, 0x3a3a46, v(0, 0.08, -0.02), mon);
    const screen = new THREE.Mesh(kit.track(new THREE.PlaneGeometry(0.54, 0.32)), kit.track(new THREE.MeshBasicMaterial({ color: 0x9fd2ff })));
    screen.position.set(0, 0.33, 0.017); mon.add(screen);
    kit.mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 14), 0xfbe3ea, v(0.55, 0.82, 0.05), g);
    for (let i = 0; i < 2; i++) kit.box(0.26, 0.045, 0.2, BOOKS[i + 2], v(0.25, 0.8 + i * 0.045, 0.18), g, 1.02);
    return { object: g };
  },

  desk_chair: ({ kit }) => {
    const g = new THREE.Group();
    kit.box(0.46, 0.06, 0.42, 0x4b5d73, v(0, 0.47, 0), g);
    kit.box(0.46, 0.6, 0.06, 0x4b5d73, v(0, 0.82, -0.22), g);
    kit.limb(v(0, 0.06, 0), v(0, 0.44, 0), 0.03, C.metal, g, 0);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; kit.limb(v(0, 0.05, 0), v(Math.cos(a) * 0.25, 0.03, Math.sin(a) * 0.25), 0.018, C.metal, g, 0); }
    return { object: g };
  },

  desk_lamp: ({ kit, pal }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.03, 16), C.metal, v(0, 0.015, 0), g);
    kit.limb(v(0, 0.02, 0), v(0.02, 0.42, 0.05), 0.013, C.metal, g, 0);
    kit.mesh(new THREE.ConeGeometry(0.11, 0.13, 16, 1, true), 0xf2c46b, v(0.03, 0.44, 0.1), g).rotation.x = 0.5;
    const bulb = new THREE.Mesh(kit.track(new THREE.SphereGeometry(0.03, 10, 8)), kit.track(new THREE.MeshBasicMaterial({ color: 0xfff2c8 })));
    bulb.position.set(0.03, 0.4, 0.12); g.add(bulb);
    const light = new THREE.PointLight(0xffc27a, pal.lamp * 0.9, 3.2, 1.6); light.position.set(0.03, 0.3, 0.16); g.add(light);
    return { object: g, lights: [light] };
  },

  armchair: ({ kit }) => {
    const g = new THREE.Group();
    kit.box(0.8, 0.3, 0.75, C.fabric, v(0, 0.2, 0), g);                 // base
    kit.box(0.62, 0.1, 0.6, C.cushion, v(0, 0.4, 0.04), g);              // seat cushion (top ≈ 0.45)
    kit.box(0.8, 0.6, 0.18, C.fabric, v(0, 0.62, -0.3), g);              // back
    for (const x of [-0.36, 0.36]) kit.box(0.12, 0.25, 0.7, C.fabric, v(x, 0.47, 0.02), g); // arms
    kit.box(0.34, 0.26, 0.08, 0xfaf0e6, v(0.12, 0.6, -0.17), g).rotation.z = 0.15; // pillow
    for (const x of [-0.33, 0.33]) for (const z of [-0.3, 0.3]) kit.limb(v(x, 0, z), v(x, 0.06, z), 0.02, C.darkWood, g, 0);
    return { object: g };
  },

  floor_lamp: ({ kit, pal }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 18), C.metal, v(0, 0.015, 0), g);
    kit.limb(v(0, 0.02, 0), v(0, 1.45, 0), 0.015, C.metal, g, 0);
    kit.mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 20, 1, true), 0xf6e3c4, v(0, 1.5, 0), g);
    const light = new THREE.PointLight(0xffd29a, pal.lamp * 0.8, 3.5, 1.5); light.position.set(0, 1.4, 0); g.add(light);
    return { object: g, lights: [light] };
  },

  side_table_books: ({ kit }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), C.wood, v(0, 0.5, 0), g);
    kit.limb(v(0, 0, 0), v(0, 0.48, 0), 0.03, C.darkWood, g, 0);
    for (let i = 0; i < 3; i++) kit.box(0.22, 0.045, 0.16, BOOKS[i], v(-0.04, 0.545 + i * 0.045, 0), g, 1.02).rotation.y = i * 0.2;
    kit.mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 12), 0xf6e7da, v(0.13, 0.56, 0.08), g);
    return { object: g };
  },

  bookshelf_tall: ({ kit }) => {
    const g = new THREE.Group();
    kit.box(0.9, 2.0, 0.35, C.darkWood, v(0, 1.0, 0), g);
    for (let row = 0; row < 4; row++) {
      const y = 0.12 + row * 0.47;
      kit.box(0.82, 0.03, 0.3, 0x5a3626, v(0, y, 0.03), g, 0);
      books(kit, g, -0.38, 0.76, y + 0.015, 0.06, 17 + row);
    }
    return { object: g };
  },

  bookshelf_low: ({ kit }) => {
    const g = new THREE.Group();
    kit.box(1.0, 0.9, 0.35, C.darkWood, v(0, 0.45, 0), g);
    for (let row = 0; row < 2; row++) { const y = 0.1 + row * 0.4; kit.box(0.92, 0.03, 0.3, 0x5a3626, v(0, y, 0.03), g, 0); books(kit, g, -0.43, 0.86, y + 0.015, 0.06, 31 + row); }
    kit.mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.13, 14), C.potBlue, v(0.3, 0.97, 0), g);
    leaves(kit, g, v(0.3, 1.08, 0), 7, 0.22, 0.06, 5);
    return { object: g };
  },

  tea_cart: ({ kit }) => {
    const g = new THREE.Group();
    kit.box(0.9, 0.85, 0.45, C.wood, v(0, 0.425, 0), g);
    kit.box(0.94, 0.04, 0.5, 0xfaf3ea, v(0, 0.87, 0), g);
    for (const x of [-0.22, 0.22]) kit.box(0.38, 0.32, 0.02, 0x9c6a45, v(x, 0.42, 0.23), g, 0); // cabinet doors
    kit.mesh(new THREE.SphereGeometry(0.11, 16, 12), 0xf7f2ea, v(-0.2, 0.98, 0), g).scale.set(1, 0.85, 1); // kettle body
    kit.limb(v(-0.31, 0.98, 0), v(-0.38, 1.03, 0), 0.015, 0xf7f2ea, g, 1.1);                              // spout
    kit.mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), C.metal, v(-0.2, 1.07, 0), g, 0);       // handle
    for (const x of [0.08, 0.22]) {
      kit.mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.06, 14), 0xf9d7e2, v(x, 0.92, 0.06), g);
      kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 16), 0xf9d7e2, v(x, 0.893, 0.06), g, 0);
    }
    kit.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 14), 0xc8e8ff, v(0.33, 0.96, -0.12), g); // tea jar
    return { object: g };
  },

  plant_floor: ({ kit }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 16), C.pot, v(0, 0.16, 0), g);
    leaves(kit, g, v(0, 0.55, 0), 12, 0.45, 0.09, 11);
    return { object: g };
  },

  plant_sill: ({ kit }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.11, 14), C.potBlue, v(0, 0.055, 0), g);
    leaves(kit, g, v(0, 0.15, 0), 5, 0.14, 0.045, 3);
    return { object: g };
  },

  plant_monstera: ({ kit }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.42, 18), 0xf3e2cf, v(0, 0.21, 0), g);
    const r = rng(77);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, h = 0.7 + r() * 0.7;
      kit.limb(v(0, 0.4, 0), v(Math.cos(a) * 0.35, h, Math.sin(a) * 0.35), 0.012, C.leafDark, g, 0);
      const leaf = kit.mesh(new THREE.SphereGeometry(0.2, 12, 8), i % 2 ? C.leaf : C.leafDark, v(Math.cos(a) * 0.42, h + 0.05, Math.sin(a) * 0.42), g, 1.04);
      leaf.scale.set(1.2, 0.25, 0.8); leaf.rotation.set((r() - 0.5) * 0.8, a, (r() - 0.5) * 0.6);
    }
    return { object: g };
  },

  plant_hanging: ({ kit }) => {
    const g = new THREE.Group();
    for (const a of [0, 2.1, 4.2]) kit.limb(v(0, 0.45, 0), v(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), 0.004, 0xd9c2a8, g, 0);
    kit.mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.pot, v(0, 0.02, 0), g);
    const r = rng(19);
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      for (let k = 0; k < 5; k++) kit.mesh(new THREE.SphereGeometry(0.035, 8, 6), C.leaf, v(Math.cos(a) * (0.13 + k * 0.01), -0.04 - k * 0.09 - r() * 0.03, Math.sin(a) * (0.13 + k * 0.01)), g, 1.05);
    }
    return { object: g };
  },

  // ---- enclosing walls (layer "cutaway": hidden whenever the camera is outside the room) ----------------
  wall_right: ({ kit }) => {
    // at x = 3, inner face towards -x
    const g = new THREE.Group(), t = 0.1;
    kit.box(t, 2.8, 5, 0xf3e4d5, v(t / 2, 1.4, 0), g, 0);
    kit.box(0.03, 0.85, 5, C.wain, v(-0.015, 0.425, 0), g, 0);
    kit.box(0.05, 0.05, 5, C.trim, v(-0.03, 0.86, 0), g, 0);
    const poster = (w: number, h: number, z: number, y: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
      kit.box(0.03, h + 0.06, w + 0.06, C.trim, v(-0.02, y, z), g, 1.03);
      const m = new THREE.Mesh(kit.track(new THREE.PlaneGeometry(w, h)), kit.toonMat({ map: kit.canvasTex(256, Math.round((256 * h) / w), paint) }));
      m.position.set(-0.04, y, z); m.rotation.y = -Math.PI / 2; g.add(m);
    };
    poster(0.55, 0.75, 1.0, 1.65, (c, w, h) => { // sunset over hills (original)
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#f7a07c"); gr.addColorStop(0.6, "#fbd3a6"); gr.addColorStop(1, "#f6e2c4");
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = "#fff3d6"; c.beginPath(); c.arc(w * 0.62, h * 0.48, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#8a6aa8"; c.beginPath(); c.moveTo(0, h * 0.7); c.quadraticCurveTo(w * 0.4, h * 0.45, w, h * 0.68); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = "#5d4a7a"; c.beginPath(); c.moveTo(0, h * 0.82); c.quadraticCurveTo(w * 0.6, h * 0.62, w, h * 0.85); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    });
    poster(0.45, 0.45, 1.75, 1.95, (c, w, h) => { // music note badge (original)
      c.fillStyle = "#cfe3ee"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#e48a8a"; c.beginPath(); c.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fffaf2"; c.fillRect(w * 0.52, h * 0.28, 10, h * 0.36); c.beginPath(); c.arc(w * 0.47, h * 0.64, 16, 0, Math.PI * 2); c.fill();
    });
    poster(0.4, 0.3, -1.0, 1.75, (c, w, h) => { // polaroid-style snapshot (original)
      c.fillStyle = "#fffaf2"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#a9cfe0"; c.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.6);
      c.fillStyle = "#f7b6cf"; c.beginPath(); c.arc(w * 0.35, h * 0.5, 22, 0, Math.PI * 2); c.fill();
    });
    return { object: g };
  },

  wall_front: ({ kit }) => {
    // at z = 2.5, inner face towards -z
    const g = new THREE.Group(), t = 0.1;
    kit.box(6, 2.8, t, 0xf3e4d5, v(0, 1.4, t / 2), g, 0);
    kit.box(6, 0.85, 0.03, C.wain, v(0, 0.425, -0.015), g, 0);
    kit.box(6, 0.05, 0.05, C.trim, v(0, 0.86, -0.03), g, 0);
    kit.box(0.08, 0.12, 0.02, C.trim, v(1.9, 1.2, -0.02), g, 1.04); // light switch
    return { object: g };
  },

  // ---- cozy decor --------------------------------------------------------------------------------------
  fairy_lights: ({ kit, pal, lowQuality }) => {
    // Warm string lights swagging along the top of the back and left walls. One instanced mesh = one draw call.
    const g = new THREE.Group(), pts: THREE.Vector3[] = [];
    const swag = (a: THREE.Vector3, b: THREE.Vector3, swags: number, sag: number, n: number) => {
      const line: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n, local = (f * swags) % 1;
        const p = a.clone().lerp(b, f); p.y -= Math.sin(local * Math.PI) * sag;
        line.push(p); if (i % 2 === 1) pts.push(p.clone().add(v(0, -0.035, 0)));
      }
      g.add(new THREE.Line(kit.track(new THREE.BufferGeometry().setFromPoints(line)), kit.track(new THREE.LineBasicMaterial({ color: 0x4a3a34 }))));
    };
    swag(v(-2.9, 2.68, -2.42), v(2.9, 2.68, -2.42), 3, 0.16, lowQuality ? 36 : 60);
    swag(v(-2.92, 2.68, -2.4), v(-2.92, 2.68, 2.4), 2, 0.14, lowQuality ? 30 : 48);
    const bulbs = new THREE.InstancedMesh(kit.track(new THREE.SphereGeometry(0.022, 8, 6)), kit.track(new THREE.MeshBasicMaterial({ color: 0xffffff })), pts.length);
    bulbs.userData.noMerge = true;
    const base = [0xfff1c9, 0xffd7a8, 0xffc4d8].map((c) => new THREE.Color(c)), tmp = new THREE.Color(), m = new THREE.Matrix4();
    pts.forEach((p, i) => { bulbs.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)); bulbs.setColorAt(i, base[i % 3]); });
    g.add(bulbs);
    const glow = pal.phase === "night" ? 1.4 : pal.phase === "sunset" ? 1.1 : 0.85;
    const lights = [new THREE.PointLight(0xffc89a, 0.5 * glow, 4, 1.8), new THREE.PointLight(0xffc89a, 0.4 * glow, 4, 1.8)];
    lights[0].position.set(0.5, 2.4, -2.1); lights[1].position.set(-2.6, 2.4, 0.4); g.add(...lights);
    return {
      object: g, lights,
      update: (t) => {
        pts.forEach((_, i) => bulbs.setColorAt(i, tmp.copy(base[i % 3]).multiplyScalar(glow * (0.8 + 0.25 * Math.sin(t * 1.6 + i * 1.7)))));
        if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
      },
    };
  },

  wall_shelf: ({ kit }) => {
    // floating shelf: jars, mugs, a small plant (front faces +z locally)
    const g = new THREE.Group();
    kit.box(0.9, 0.04, 0.24, C.wood, v(0, 0, 0), g);
    for (const x of [-0.35, 0.35]) kit.box(0.03, 0.12, 0.2, C.darkWood, v(x, -0.07, -0.02), g, 0);
    kit.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 12), 0xc8e8ff, v(-0.32, 0.09, 0), g);
    kit.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12), 0xf0cf7c, v(-0.2, 0.07, 0.02), g);
    for (const x of [0.0, 0.1]) kit.mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 12), 0xf9d7e2, v(x, 0.055, 0.03), g);
    kit.mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 12), C.pot, v(0.3, 0.06, 0), g);
    leaves(kit, g, v(0.3, 0.13, 0), 6, 0.16, 0.04, 23);
    for (let i = 0; i < 6; i++) kit.mesh(new THREE.SphereGeometry(0.03, 8, 6), C.leaf, v(0.33 + (i % 2) * 0.03, 0.02 - i * 0.07, 0.08), g, 1.05);
    return { object: g };
  },

  ivy_window: ({ kit }) => {
    // trailing ivy along the curtain rod, hanging down at both sides of the window
    const g = new THREE.Group(), r = rng(61);
    for (let x = -2.9; x <= 0.9; x += 0.09) kit.mesh(new THREE.SphereGeometry(0.035 + r() * 0.015, 8, 6), r() > 0.5 ? C.leaf : C.leafDark, v(x, 2.52 + (r() - 0.5) * 0.06, 0.14 + r() * 0.05), g, 1.05);
    for (const x of [-2.85, 0.85]) for (let i = 0; i < 9; i++) kit.mesh(new THREE.SphereGeometry(0.032, 8, 6), C.leaf, v(x + (r() - 0.5) * 0.06, 2.46 - i * 0.09, 0.16), g, 1.05);
    return { object: g };
  },

  candle: ({ kit, pal }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), 0xfaf3e6, v(0, 0.045, 0), g);
    const flame = new THREE.Mesh(kit.track(new THREE.ConeGeometry(0.012, 0.04, 8)), kit.track(new THREE.MeshBasicMaterial({ color: 0xffd27a })));
    flame.position.set(0, 0.115, 0); g.add(flame);
    const light = new THREE.PointLight(0xffb066, pal.phase === "day" ? 0.08 : 0.35, 1.6, 2); light.position.set(0, 0.2, 0); g.add(light);
    return { object: g, lights: [light], update: (t) => { light.intensity = (pal.phase === "day" ? 0.08 : 0.35) * (0.9 + 0.1 * Math.sin(t * 9) * Math.sin(t * 3.7)); } };
  },

  pouf: ({ kit }) => {
    const g = new THREE.Group();
    kit.mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.3, 20), 0x8fb9a8, v(0, 0.15, 0), g);
    kit.mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 24), 0x7aa898, v(0, 0.3, 0), g, 0).rotation.x = Math.PI / 2;
    return { object: g };
  },

  backpack: ({ kit }) => {
    const g = new THREE.Group();
    const body = kit.mesh(new THREE.CapsuleGeometry(0.13, 0.2, 4, 10), 0x6a9aa0, v(0, 0.24, 0), g, 1.05); body.scale.set(1.1, 1, 0.65);
    kit.box(0.2, 0.12, 0.06, 0x5b878d, v(0, 0.17, 0.09), g, 1.04);
    kit.mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), 0x3e5a5e, v(0, 0.44, 0), g, 0);
    return { object: g };
  },

  floor_books: ({ kit }) => {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) kit.box(0.24 - i * 0.015, 0.05, 0.17, BOOKS[(i + 3) % 6], v(0, 0.025 + i * 0.05, 0), g, 1.02).rotation.y = (i % 2 ? 0.25 : -0.15);
    kit.box(0.22, 0.04, 0.16, BOOKS[1], v(0.3, 0.02, 0.08), g, 1.02).rotation.y = 0.6; // one lying open-ish beside
    return { object: g };
  },
};

export function buildPrefab(id: PrefabId, ctx: PrefabContext): PrefabResult { return builders[id](ctx); }
export const REGISTERED_PREFABS = Object.keys(builders) as PrefabId[];
