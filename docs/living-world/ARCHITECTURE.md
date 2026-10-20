# Living World: Architecture

Goal: turn the single fixed room into a **2.5D living anime world**. The character lives on her own (needs, activities, movement, memory) across several small diorama locations. A **hybrid camera** blends an isometric overview with cinematic close-ups. Everything runs offline in the browser for free; the legacy room stays available.

## 1. Layering

```
┌──────────────────────────── UI (React panels, unchanged + World HUD) ────────────────────────────┐
│ Focus · Tasks · Music · Chat · Story · Settings · [new] Diary / "while you were away" card       │
└───────────────▲──────────────────────────────────────────────▲───────────────────────────────────┘
                │ selectors                                    │ intents (tap character, go to location)
┌───────────────┴───────────────┐   snapshot (read-only)  ┌────┴─────────────────────────────────────┐
│  World store (Zustand,        │ ──────────────────────▶ │  Presentation adapters                   │
│  key `olh-world-v1`, IDB)     │                         │  • WorldRenderer (three.js, 2.5D)  [new] │
└───────────────▲───────────────┘                         │  • Legacy3D (scene3d.ts)      [as is]    │
                │ step(state, dt, inputs)                 │  • Pixi2D / CSS               [as is]    │
┌───────────────┴──────────────────────────────────────┐  └──────────────────────────────────────────┘
│  Simulation core (pure TS, no DOM/three, seeded RNG) │
│  clock · needs · activities · planner · nav · memory │
│  catchUp(offline) · diary · derived Availability     │
└──────────────────────────────────────────────────────┘
```

Rules:
- **The sim core is pure and deterministic** (`state + dt + inputs + seed → state + events`). It's unit-testable and never imports React, three or `Date` (time is passed in).
- **Renderers only read snapshots** and send *intents* back. They never mutate sim state.
- **Availability stays the public contract.** Chat, the header and the story keep using `AVAILABLE | BUSY | SLEEPING`, now *derived* from the current activity. Existing consumers don't change.

## 2. Simulation core (`src/world/sim/`)

### 2.1 Clock
- Fixed sim step: **1 tick = 1 sim-second**, advanced in real time at 1 Hz by the runtime (decoupled from the render rate).
- `catchUp(state, fromMs, toMs, seed)` fast-forwards in **5-minute macro steps** (activities resolve whole; no pathing detail), capped at **7 days**. The result is equivalent to stepping (tested on short spans).

### 2.2 Needs (0–100, decay per hour, tuned in `content/world/needs.json`)
`energy`, `hunger`, `focus`, `social`, `fun`, plus `mood` (derived as a weighted average with a small inertia).

### 2.3 Activities (data: `content/world/activities.json`)
```ts
interface ActivityDef {
  id: "study" | "read" | "make_tea" | "eat" | "sleep" | "water_plants" | "gaze_window" | "go_out" | ...;
  anchor: string;              // anchor id inside a location ("desk", "bed", "kettle"...)
  location: string;            // "study" | "kitchen" | ...
  duration: [min: number, max: number];  // sim minutes
  effects: Partial<Record<Need, number>>; // per hour while performing
  window?: [startMin: number, endMin: number]; // allowed time of day
  availability: "AVAILABLE" | "BUSY" | "SLEEPING";
  anim: string;                // animation clip id ("sit_type", "sleep", "drink"...)
  tags?: string[];             // "with_user" etc.
}
```

### 2.4 Planner: utility AI
`score(a) = Σ need_urgency(n) * effect(a, n) + scheduleBias(a, now) + userCoupling(a) − recencyPenalty(a) + noise(seed)`
- **scheduleBias:** the existing `DEFAULT_SCHEDULE` block becomes a prior. For example, 00:00–07:00 strongly favours `sleep`, and "Out for groceries" favours `go_out`. Her familiar rhythm is kept, with variety on top.
- **userCoupling:** when the user's Pomodoro focus phase is running, `study` gets a large bonus (she "body-doubles" with you). During a break she prefers `make_tea` or `gaze_window`.
- Re-plans only on activity end, on an urgent need (<15), or on a user intent. Hysteresis prevents dithering.

### 2.5 Character state machine
`Idle → Walking(path) → Performing(activity) → Idle`, plus `Sleeping` and `Away` (off-screen `go_out`). Walking uses the location's **waypoint graph** (tiny A* in `src/world/nav/`; no navmesh library). Positions live in sim units (meters on the floor plane).

### 2.6 Memory (`src/world/sim/memory.ts`)
- **Episodic log:** `{ at, kind, data, salience }`. Kinds include `focus_done`, `task_done`, `story_choice`, `chat_topic`, `activity`, `away_summary`. Salience decays (half-life of about 3 days); the log is capped at 300 entries, with the lowest salience pruned first.
- **Facts:** `{ key, value, confidence }`, e.g. `user.name`, `user.likes.music`. These come from explicit chat patterns ("call me …", "I like …") and are never guessed.
- **Uses:** a `memories: string[]` (top-k by salience and recency) is added to `ChatContext`. The mock provider uses templated callbacks ("You finished 3 sessions yesterday!"); the Ollama prompt gets them as a bullet list.
- **Privacy:** local only (IndexedDB), with a visible "Forget everything" in Settings. Nothing leaves the device.

### 2.7 Diary / offline summary
`catchUp` emits events, and those become 1–4 short diary lines ("Made tea and watched the rain for a while") from `content/world/diary-lines.json`. They're shown once in the "While you were away" card and kept in the Diary tab.

## 3. Locations (data-driven dioramas)

`content/locations/<id>.json`:
```jsonc
{
  "id": "study", "name": "Study",
  "size": [6, 5],                       // floor meters (x, z)
  "backdrop": { "kind": "procedural", "id": "sakura_window" },   // or { "kind": "image", "src": "..." }
  "props": [ { "prefab": "desk", "pos": [0, 0, 0], "rotY": 0 }, ... ],
  "anchors": { "desk": { "pos": [0, 0, -0.62], "face": 0, "pose": "sit" }, "bed": {...}, "kettle": {...} },
  "waypoints": { "nodes": { "door": [2.4, 0, 1.8], ... }, "edges": [["door", "center"], ...] },
  "shots": { "overview": { "kind": "iso" }, "desk_close": { "kind": "cine", "target": "desk", "offset": [-0.75, 0.4, 2.3], "fov": 34 } },
  "lighting": "room_default",
  "exits": { "kitchen": "door" }
}
```
- **Prefab registry** (`src/components/world/prefabs/registry.ts`) maps a prefab id to a builder using `kit.ts` primitives now, and swaps in GLB models later without data changes.
- **First locations:** `study` (today's room, re-expressed as data), `kitchen`, `balcony` (sakura, rain, night sky). "Away" is off-screen.
- **Transitions:** a fade-through-paper wipe (CSS overlay) while swapping location groups. Only one location's meshes live in the GPU at a time.

## 4. Rendering: 2.5D in three.js (no new engine)

- **Diorama look:** each location is a cut-away room (two back walls plus floor) on a soft painted backdrop plane. It reuses the toon kit, outlines, palette, bloom and petals from today.
- **Layers** (render order or depth): `backdrop` (sky, city, trees; parallax planes) → `shell` (walls and floor) → `props` → `character` → `foreground` (occluders such as a plant or curtain edge, which fade to 30% opacity when they cover the character).
- **Character:** the VRM is loaded once via the extracted `vrmLoader.ts`. Swapping characters swaps only the character node, never the whole scene (fixes R3).
- **Animation:** `@pixiv/three-vrm-animation` plays `.vrma` clips (idle, walk, sit_type, sit_read, sleep, drink, stretch, wave) through an `AnimationMixer`, with crossfades of about 0.3 s. **Fallback:** today's procedural seated pose and breathing, plus a simple procedural walk (leg and arm sine) if a clip is missing, so the world never breaks for lack of assets.

### 4.1 Hybrid camera: one camera, "dolly-zoom" blending
Keep a single `PerspectiveCamera`. Isometric is approximated by a **very narrow FOV from far away** (fov ≈ 10°, distance ≈ 28 m, pitch 35.26°, yaw 45°). Cinematic shots are normal FOV (30–40°) close up. A transition animates `fov`, `distance` and `target` together, keeping the subject's on-screen size constant (dolly zoom). The result is smooth, cheap, needs no second camera or render pass, and keeps bloom and outlines consistent.
- `CameraDirector` (`src/components/world/camera/`) holds the shot stack. Its shot math (`shotPose(shot, subject, aspect) → {pos, target, fov}`, `blend(a, b, t)`) is pure and unit-tested.
- **Modes:**
  - **Overview (iso):** default. Pan by drag within bounds; pinch or wheel zooms within the iso range.
  - **Follow:** iso, gently tracks her.
  - **Cinematic:** tap her, or an activity triggers a shot such as `desk_close` when she sits to study with you. Exit via tap, back, or Esc.
- Respects reduced motion: cuts instead of blends, and no camera sway.
- Mobile portrait uses a wider iso frame and shots get per-aspect offsets (as today's `resize()` does).

## 5. Runtime and state

- **`src/world/store/useWorld.ts`:** a separate Zustand store, persisted under its **own key `olh-world-v1`** with `version: 1` and `migrate`. It's independent of `olh-save-v1`, so a world bug can never touch tasks or timer saves, and "Reset world" is isolated.
  State: `{ simTime, lastRealAt, seed, character: {location, pos, activity, needs, mood, path}, memory, diary, unlockedLocations }`.
- **`src/world/runtime/useSimulation.ts`:** on mount it runs `catchUp(lastRealAt → now)`, then a 1 Hz `setInterval` steps the sim. It pauses on `visibilitychange`, and on resume it catches up again.
- **`useGame.ts`** gets `version: 2` plus a `migrate` (v1 → v2 only adds the `renderMode: "world"` option, a `quality` setting and `memoryEnabled`). The old shape is read as-is and nothing is deleted.
- **`page.tsx`:** availability comes from `useWorld(selectDerivedAvailability)` when the world is enabled, else `currentBlock()` as today. Existing panels are unchanged. Use selectors to fix R2.

## 6. Performance budget (mobile first)

| Item | Low | Medium | High |
|---|---|---|---|
| Pixel ratio | 1 | 1.5 | min(2, dpr) |
| Bloom | off | half-res | on |
| Petals / rain | 40 / 150 | 100 / 300 | 160 / 500 |
| Outlines | props only | all | all |
| Target FPS | 30 (frame cap) | 60 | 60 |
| VRM | compressed (meshopt + KTX2) under 8 MB, textures 1024 | 2048 | 2048 |

- Tier auto-detection: `hardwareConcurrency`, `deviceMemory`, a renderer-string heuristic, and a 2-second FPS probe that downgrades after load. Users can override it in Settings.
- Render on demand while idle in overview (no petals in reduced motion) and pause when the tab is hidden.
- Draw-call budget: under 150 per location, using an instanced canopy and petals as today.

## 7. Deployment (free-first)

- **Vercel Hobby** (current) deploys from `main`. The world is fully client-side, so no server is needed. A **static export** build (`build:static`) is kept working for GitHub Pages as a fallback.
- Large assets (VRM, VRMA, audio) stay in `public/`. Once compressed they total about 40 MB for 5 characters, well within free limits. Moving to Git LFS is not needed.
- The optional Spring backend stays optional. A future "cloud save" would sync `olh-save` and `olh-world` blobs (the existing `/api/saves`).

## 8. Folder structure (new)

```
apps/web/src/
  world/
    sim/        types.ts clock.ts needs.ts activities.ts planner.ts character.ts memory.ts diary.ts catchUp.ts availability.ts  (+ *.test.ts)
    nav/        waypointGraph.ts (+ test)
    locations/  schema.ts loader.ts (+ test)
    store/      useWorld.ts migrations.ts (+ test)
    runtime/    useSimulation.ts
  components/world/
    WorldRenderer.ts        createWorldScene(host, opts) → WorldHandle
    camera/                 CameraDirector.ts shots.ts (+ shots.test.ts)
    character/              vrmLoader.ts (extracted) animator.ts proceduralFallback.ts
    prefabs/                registry.ts study.ts kitchen.ts balcony.ts shared.ts
    quality.ts
    WorldHud.tsx  AwayCard.tsx  DiaryPanel.tsx
  lib/rng.ts               (moved from room3d/kit.ts, re-exported there)
content/
  world/      needs.json activities.json diary-lines.json memory-lines.json
  locations/  study.json kitchen.json balcony.json
apps/web/public/
  animations/ *.vrma
  locations/  <id>/backdrop.webp (optional painted art)
```

## 9. Dependencies

| Package | Why | License / cost |
|---|---|---|
| `@pixiv/three-vrm-animation` | Plays VRMA clips on VRM humanoids | MIT, free |
| `@gltf-transform/cli` (dev, run via npx/script) | Compress VRM/GLB (meshopt, KTX2) | MIT, free |
| `@playwright/test` (dev, optional) | Smoke e2e: loads, switches modes, no console errors | Apache-2.0, free |

No other runtime additions: no physics engine, no navmesh library, no paid APIs.
