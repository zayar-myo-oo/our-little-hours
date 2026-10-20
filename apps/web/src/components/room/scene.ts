// Original procedural placeholder art drawn with PixiJS Graphics. Scene space: 1600x1000.
import { Application, Container, Graphics, Text } from "pixi.js";
import type { Availability } from "@/systems/character/schedule";

export const W = 1600, H = 1000;
export interface SceneHandle { setState(s: Availability): void; setReducedMotion(r: boolean): void; destroy(): void }

const WIN = { x: 220, y: 140, w: 440, h: 420 };

function drawStatic(root: Container, night: boolean) {
  const g = new Graphics();
  // wall + floor
  g.rect(0, 0, W, H).fill(night ? 0x3b2e3f : 0x6b4b45);
  for (let x = 0; x < W; x += 80) g.rect(x, 0, 2, 720).fill({ color: 0x000000, alpha: 0.06 });
  g.rect(0, 720, W, 280).fill(0x4a3024);
  for (let y = 740; y < H; y += 46) g.rect(0, y, W, 3).fill({ color: 0x000000, alpha: 0.15 });
  // window sky
  g.rect(WIN.x, WIN.y, WIN.w, WIN.h).fill(night ? 0x1d2440 : 0x7d8fa8);
  for (let i = 0; i < 7; i++) g.rect(WIN.x + i * 70, WIN.y + 260 + (i % 3) * 30, 60, 200).fill({ color: 0x0e1224, alpha: 0.55 });
  for (let i = 0; i < 18; i++) g.rect(WIN.x + 20 + (i * 53) % 400, WIN.y + 290 + (i * 37) % 110, 6, 8).fill({ color: 0xffd98a, alpha: 0.7 });
  root.addChild(g);
  return g;
}

function drawFront(root: Container) {
  const g = new Graphics();
  // window frame
  g.rect(WIN.x - 18, WIN.y - 18, WIN.w + 36, 18).fill(0x2a1a14);
  g.rect(WIN.x - 18, WIN.y + WIN.h, WIN.w + 36, 26).fill(0x2a1a14);
  g.rect(WIN.x - 18, WIN.y, 18, WIN.h).fill(0x2a1a14);
  g.rect(WIN.x + WIN.w, WIN.y, 18, WIN.h).fill(0x2a1a14);
  g.rect(WIN.x + WIN.w / 2 - 6, WIN.y, 12, WIN.h).fill(0x2a1a14);
  g.rect(WIN.x, WIN.y + WIN.h / 2 - 6, WIN.w, 12).fill(0x2a1a14);
  // curtains
  g.poly([WIN.x - 60, WIN.y - 40, WIN.x + 40, WIN.y - 40, WIN.x - 10, WIN.y + WIN.h + 60, WIN.x - 70, WIN.y + WIN.h + 60]).fill(0xb45f5a);
  g.poly([WIN.x + WIN.w - 40, WIN.y - 40, WIN.x + WIN.w + 60, WIN.y - 40, WIN.x + WIN.w + 70, WIN.y + WIN.h + 60, WIN.x + WIN.w + 10, WIN.y + WIN.h + 60]).fill(0xb45f5a);
  // plant on sill
  g.rect(WIN.x + 40, WIN.y + WIN.h - 40, 50, 46).fill(0xc9774c);
  g.ellipse(WIN.x + 65, WIN.y + WIN.h - 60, 40, 28).fill(0x5b8a5a);
  // bookshelf
  const bx = 1140, by = 120;
  g.rect(bx, by, 340, 600).fill(0x3a2318);
  const palette = [0xc96f5b, 0xe1b26b, 0x6c8f8a, 0x8a6ca8, 0xd9cbb0, 0x5b6f9a];
  for (let row = 0; row < 4; row++) {
    const y = by + 20 + row * 145;
    g.rect(bx + 14, y + 125, 312, 10).fill(0x24150f);
    let x = bx + 20;
    for (let i = 0; x < bx + 300; i++) {
      const w = 18 + ((i * 7 + row * 3) % 14), h = 80 + ((i * 13 + row * 5) % 40);
      g.rect(x, y + 125 - h, w, h).fill(palette[(i + row) % palette.length]);
      x += w + 3;
    }
  }
  root.addChild(g);
}

function drawDesk(root: Container) {
  const g = new Graphics();
  g.rect(470, 640, 760, 40).fill(0x7a4a2c);
  g.rect(470, 680, 760, 14).fill(0x5a341f);
  g.rect(500, 694, 30, 240).fill(0x5a341f);
  g.rect(1170, 694, 30, 240).fill(0x5a341f);
  // notebook + mug + lamp
  g.poly([700, 640, 880, 640, 900, 622, 720, 622]).fill(0xf6ecd8);
  g.rect(790, 620, 4, 20).fill(0xb0a080);
  g.roundRect(960, 590, 50, 50, 8).fill(0xe7d6c3);
  g.rect(1080, 520, 10, 120).fill(0x2b2b2b);
  g.poly([1040, 530, 1130, 530, 1110, 480, 1060, 480]).fill(0xe9b45a);
  root.addChild(g);
}

function buildCharacter() {
  const c = new Container();
  const body = new Graphics();
  // chair back
  body.roundRect(-110, -40, 220, 280, 30).fill(0x3d2a22);
  // torso (cardigan)
  body.roundRect(-95, 0, 190, 200, 70).fill(0xd98f7a);
  body.rect(-10, 10, 20, 180).fill(0xf3e6d6);
  c.addChild(body);
  const head = new Container();
  const h = new Graphics();
  h.roundRect(-95, -150, 190, 170, 80).fill(0x3b2a3a); // hair back
  h.ellipse(0, -60, 72, 80).fill(0xf7dcc8); // face
  h.poly([-85, -100, -20, -160, 60, -150, 90, -90, 30, -115, -20, -95, -60, -70]).fill(0x4a3348); // bangs
  h.ellipse(-40, -30, 14, 7).fill({ color: 0xf29b9b, alpha: 0.5 });
  h.ellipse(40, -30, 14, 7).fill({ color: 0xf29b9b, alpha: 0.5 });
  h.arc(0, -22, 10, 0.2, Math.PI - 0.2).stroke({ width: 3, color: 0x8a4a4a });
  head.addChild(h);
  const eyesOpen = new Graphics();
  eyesOpen.ellipse(-28, -55, 9, 13).fill(0x3a2840).ellipse(28, -55, 9, 13).fill(0x3a2840);
  eyesOpen.circle(-25, -60, 3).fill(0xffffff).circle(31, -60, 3).fill(0xffffff);
  const eyesClosed = new Graphics();
  eyesClosed.arc(-28, -55, 10, 0.1, Math.PI - 0.1).stroke({ width: 3, color: 0x3a2840 });
  eyesClosed.arc(28, -55, 10, 0.1, Math.PI - 0.1).stroke({ width: 3, color: 0x3a2840 });
  head.addChild(eyesOpen, eyesClosed);
  c.addChild(head);
  const arms = new Graphics();
  arms.roundRect(-150, 150, 130, 50, 25).fill(0xd98f7a).roundRect(20, 150, 130, 50, 25).fill(0xd98f7a);
  arms.circle(-20, 175, 20).fill(0xf7dcc8).circle(20, 175, 20).fill(0xf7dcc8);
  c.addChild(arms);
  return { c, head, eyesOpen, eyesClosed };
}

export async function createScene(host: HTMLElement, opts: { reducedMotion: boolean; state: Availability; night: boolean }): Promise<SceneHandle> {
  const app = new Application();
  await app.init({ resizeTo: host, antialias: true, backgroundColor: 0x1a1218, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1) });
  host.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);

  drawStatic(world, opts.night);
  const rain = new Graphics();
  const mask = new Graphics().rect(WIN.x, WIN.y, WIN.w, WIN.h).fill(0xffffff);
  rain.mask = mask;
  world.addChild(rain, mask);
  drawFront(world);

  // lamp glow
  const glow = new Graphics();
  for (let i = 6; i > 0; i--) glow.circle(1085, 560, 60 * i).fill({ color: 0xffc77a, alpha: 0.035 });
  const ch = buildCharacter();
  ch.c.position.set(820, 470);
  world.addChild(ch.c);
  drawDesk(world);
  world.addChild(glow);
  const zzz = new Text({ text: "z z z", style: { fill: 0xf3e6d6, fontSize: 34, fontFamily: "Georgia" } });
  zzz.position.set(900, 300);
  const away = new Text({ text: "(stepped out — back soon)", style: { fill: 0xf3e6d6, fontSize: 28, fontFamily: "Georgia", fontStyle: "italic" } });
  away.anchor.set(0.5); away.position.set(850, 560);
  world.addChild(zzz, away);

  let state = opts.state, reduced = opts.reducedMotion, t = 0, blink = 0;
  const drops = Array.from({ length: 90 }, () => ({ x: WIN.x + Math.random() * WIN.w, y: WIN.y + Math.random() * WIN.h, v: 9 + Math.random() * 7 }));

  const layout = () => {
    const s = Math.max(app.screen.width / W, app.screen.height / H);
    world.scale.set(s);
    // keep the character centered horizontally when cropping on narrow screens
    world.position.set(app.screen.width / 2 - 850 * s, (app.screen.height - H * s) / 2);
  };
  layout();
  app.renderer.on("resize", layout);

  const applyState = () => {
    ch.c.visible = state !== "BUSY";
    away.visible = state === "BUSY";
    zzz.visible = state === "SLEEPING";
    ch.head.rotation = state === "SLEEPING" ? 0.35 : 0;
    ch.head.y = state === "SLEEPING" ? 40 : 0;
    ch.eyesClosed.visible = state === "SLEEPING";
    ch.eyesOpen.visible = state !== "SLEEPING";
    glow.alpha = state === "SLEEPING" ? 0.3 : 1;
  };
  applyState();

  app.ticker.add((tk) => {
    const dt = tk.deltaTime;
    rain.clear();
    for (const d of drops) {
      if (!reduced) { d.y += d.v * dt; d.x -= 1.2 * dt; if (d.y > WIN.y + WIN.h) { d.y = WIN.y - 20; d.x = WIN.x + Math.random() * (WIN.w + 40); } }
      rain.moveTo(d.x, d.y).lineTo(d.x - 3, d.y + 18);
    }
    rain.stroke({ width: 2, color: 0xc8d6ef, alpha: 0.45 });
    if (reduced) return;
    t += dt / 60;
    const breath = Math.sin(t * (state === "SLEEPING" ? 1.2 : 2)) * 4;
    ch.c.y = 470 + breath * 0.5;
    ch.head.y = (state === "SLEEPING" ? 40 : 0) + breath * 0.6;
    zzz.alpha = 0.5 + 0.5 * Math.sin(t * 1.5); zzz.y = 300 - ((t * 10) % 30);
    glow.scale.set(1 + Math.sin(t * 3) * 0.004);
    if (state === "AVAILABLE") {
      blink -= dt / 60;
      if (blink < 0) { ch.eyesOpen.visible = false; ch.eyesClosed.visible = true; if (blink < -0.12) { blink = 2 + Math.random() * 3; ch.eyesOpen.visible = true; ch.eyesClosed.visible = false; } }
    }
  });

  return {
    setState(s) { state = s; applyState(); },
    setReducedMotion(r) { reduced = r; },
    destroy() { app.renderer.off("resize", layout); app.destroy(true, { children: true }); },
  };
}

export function webglAvailable() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
