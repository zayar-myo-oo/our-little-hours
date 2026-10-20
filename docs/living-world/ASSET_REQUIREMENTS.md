# Living World: Asset Requirements

All tools are free: VRoid Studio, Blender, Krita, `gltf-transform`. Every asset needs a row in `ASSET_LICENSES.md` (source, author, license, date) before it's committed. Allowed licenses: your own work, CC0, CC-BY (with credit), or permissive model terms verified for public web use. Not allowed: ripped game assets, Mixamo raw files redistributed in a public repo, or anything "free for personal use only".

## 1. What exists today

| Asset | Status | Notes |
|---|---|---|
| Characters | ✅ 5 VRM 1.0 (Mio, Yuki, Rina, Sakura, Shion), 18–22 MB each | Uncompressed. `Shion.vrm` author metadata says "pixiv VRoid Project", so **verify the VRoid sample model terms** |
| Character thumbnails | ✅ 5 JPG, 256 px | From the VRoid project thumbnails |
| Animations | ❌ none | Today the seated pose is procedural |
| Environment | ✅ procedural (code) | Study room, sakura, sky, city, all from `kit.ts` primitives and canvas textures |
| Music | ✅ 9 CC0 tracks (OpenGameArt) | Credits in `public/audio/music/CREDITS.md` |
| Ambience | ✅ procedural rain and room hum (Web Audio) | No files |
| SFX | ❌ none | |

## 2. Required for Milestone 1 (first playable)

### 2.1 Animations (`apps/web/public/animations/*.vrma`, VRM Animation 1.0)
| Clip id | Loop | Length | Used by | Priority |
|---|---|---|---|---|
| `idle` | yes | 4–8 s | standing still | **M1 required** |
| `walk` | yes | 1 s cycle, in place (root motion removed) | moving between anchors | **M1 required** |
| `sit_type` | yes | 3–6 s | desk / study | **M1 required** |
| `sit_read` | yes | 4–8 s | reading nook | M1 nice to have |
| `stand_gaze` | yes | 6–10 s | window | M1 nice to have |
| `drink` | no | 3 s | tea corner | M1 nice to have |
| `sleep` | yes | 6 s breathing | bed | M2 |
| `stretch`, `wave` | no | 2–3 s | idle variety, greeting the user | M2 |

Specs: humanoid VRM bones only, 30 fps, in place with no root translation (the sim moves her), seated clips aligned so the hips sit at seat height 0 (the runtime offsets per model, as today's seat-lift does).
Free sources, in order of preference:
1. Make them yourself in VRoid Studio's pose/animation tools or Blender (with the VRM add-on, free), exported as VRMA.
2. Official pixiv / VRM Consortium sample VRMA motions, after **checking that their terms allow public web redistribution**.
3. CC0 BVH mocap (e.g. CMU-derived CC0 sets), retargeted in Blender to VRMA.

Fallback without any clips: procedural seated pose and breathing (exists) plus a procedural walk (to be written in M1). The world remains playable.

### 2.2 Characters (existing, to optimize)
- Format: VRM 1.0, MToon, with the expressions `blink`, `happy`, `relaxed`, `sad`, `surprised` and lip-sync `aa/ih/ou/ee/oh`.
- Budget after `gltf-transform` (meshopt geometry, KTX2/WebP textures): **≤ 8 MB**, textures ≤ 2048 (1024 for the Low tier), ≤ 40k triangles.
- Naming: `apps/web/public/models/<Name>.vrm`, listed in `manifest.json` with a 256 px thumbnail.

### 2.3 Study location (`content/locations/study.json`)
Can be fully **procedural** (reusing the current environment prefabs). Optional art upgrade:
| Item | Spec |
|---|---|
| Backdrop (window view) | 2048×1024 WebP, painted, separate day/sunset/night variants or one day image tinted by the palette |
| Props (GLB) | desk, chair, bed, bookshelf, kettle corner, rug, plants; each ≤ 3k tris, ≤ 512 px texture or flat vertex colors, toon-friendly (no PBR maps) |

## 3. Later milestones

| Milestone | Assets |
|---|---|
| M2 (memory/diary) | `content/world/diary-lines.json` and `memory-lines.json` (text, written in-house), a diary page texture (512 px, optional) |
| M3 (locations) | Kitchen and balcony: prefabs or GLB props (stove, table, kettle, fridge; railing, potted sakura, laundry line), backdrop art per location, ambience loops (kitchen hum, birds, wind) as CC0 OGG at 96–128 kbps, ≤ 1 MB each |
| M4 (perf) | Compressed variants of all VRMs (`*.vrm` replaced in place, originals kept outside the repo) |
| M5 (art) | Painted backdrops for all locations, more clips (`cook`, `water_plants`, `sit_bed`, `phone`), expression-driven reactions |

### SFX (CC0, OGG/MP3, mono, under 100 KB each)
`footstep_wood` (×3 variants), `page_turn`, `keyboard_typing_loop`, `kettle_click`, `cup_set`, `chair_creak`, `door_open`, `ui_soft_tick`. Sources: OpenGameArt and freesound.org (filter by CC0 license).

## 4. Pipeline and conventions

```
apps/web/public/
  models/       <Name>.vrm, thumbs/<id>.jpg, manifest.json
  animations/   <clip_id>.vrma, manifest.json  ({ id, file, loop, length, license })
  locations/    <id>/backdrop-<variant>.webp, <id>/props/*.glb
  audio/        music/ (existing), ambience/, sfx/
content/
  locations/    <id>.json       world/  activities.json needs.json diary-lines.json memory-lines.json
docs/ASSET_LICENSES.md          single ledger for every binary asset
```

- Optimization script (M4): `npm run assets:optimize` runs `gltf-transform optimize --compress meshopt --texture-compress webp` over `public/models` and `public/locations/**/props`. Run it locally; originals stay outside the repo.
- Validation: a test checks that every `manifest.json` entry exists on disk, has a license row and fits the size budget.
- Total budget for the hosted site: **≤ 120 MB** (Vercel Hobby and GitHub Pages are comfortable at this size).

## 5. What can be generated in code vs. what needs an artist

| In code (no artist needed) | Needs an artist or tool work |
|---|---|
| Location shells, furniture prefabs, sky, city, sakura, rain, petals, lighting, palettes | Painted backdrops (optional) |
| Procedural walk, breathing, blinking, look-at | Quality animation clips (VRMA) |
| Diary and memory text templates | Higher-fidelity GLB props (optional) |
| Ambience (Web Audio) | Characters (done, via VRoid) |
