# M1-A: A Day in the Study (2.5D environment)

**Status:** implemented behind the `livingWorld` feature flag (default **off**). With the flag off, the app is unchanged.

## Try it
| URL | Shows |
|---|---|
| `/?ff=livingWorld` | Study diorama, character at the desk |
| `/?ff=livingWorld&anchor=reading` | …in the reading corner (also `window`, `tea`) |
| `/?ff=livingWorld&hour=21` | Night lighting (any hour 0–23) |
| `/?ff=livingWorld&quality=low` | Force a quality tier (`low`, `medium`, `high`) |

Persist the flag for this browser: `localStorage.setItem("olh-ff", JSON.stringify({ livingWorld: true }))`.

## What's in the room
Desk + chair, reading corner (armchair, side table, floor lamp), window (painted view, curtains, sill plant), tea corner (cart with kettle, cups and jar), tall and low bookshelves, floor, sill, monstera and hanging plants, rug, framed art and corkboard, and warm lighting (hemisphere, sun through the window, desk and floor lamps). Four activity anchors: **desk** (sit and type), **reading** (sit and relax), **window** (stand), **tea** (stand).

## How it's built

| Piece | File |
|---|---|
| Scene + asset manifest (anchors, props, camera, assets, budgets) | `content/locations/study.json` |
| Manifest schema and validation | `apps/web/src/world/locations/schema.ts` |
| Prefab builders (original procedural art) | `apps/web/src/components/world/prefabs/registry.ts`, `ids.ts` |
| Isometric overview camera (fit to bounds, responsive) | `apps/web/src/components/world/camera/iso.ts` |
| Foreground occlusion (fade plants that hide the character) | `apps/web/src/components/world/occlusion.ts` |
| Quality tiers, frame limiter | `apps/web/src/components/world/quality.ts` |
| Anchor poses and seat placement | `components/world/character/vrmPose.ts`, `vrmApply.ts` |
| Renderer | `apps/web/src/components/world/WorldRenderer.ts` |
| Flag and fallback chain (world → 3D → 2D → CSS) | `apps/web/src/components/room/Room.tsx` |

- **Layers:** `backdrop` (window view) → `shell` (floor, walls) → `props` → character → `foreground` (monstera, hanging plant). Foreground props get private transparent materials and fade to 25% while they cover the character, using raycasts from the camera to the head and chest every 6 frames, eased each frame (instant under reduced motion).
- **Camera:** narrow-FOV perspective (20°) from the front-right diagonal (yaw 45°, pitch ≈ 31°). The distance is solved so the room bounds fit the viewport; portrait screens widen the FOV ×1.45 and crop the sides to 62%.
- **Character:** the selected VRM loads in the background (the room appears first) and is posed per anchor. With no model selected, an original placeholder figure is used. M1-A has no simulation: AVAILABLE uses the chosen anchor (default desk), SLEEPING uses the reading chair with eyes closed, and BUSY hides her. M1-C replaces this.
- **Performance:** tiers are auto-detected (`detectTier`). Low means pixel ratio 1, no antialias, no bloom and 30 fps; medium means DPR ≤ 1.5 and no bloom; high means DPR ≤ 2 and bloom. Rendering pauses when the tab is hidden. Rain is limited to the window opening.

## Asset requirements (study)

| Asset | Now | Final (optional) | Budget |
|---|---|---|---|
| Furniture and props | ✅ procedural placeholders (original) | GLB per prefab, swapped in the registry with no manifest changes | ≤ 3k tris each, flat colors or ≤ 512 px texture, toon-friendly |
| Window view | ✅ canvas-painted (original) | Painted 1024×512 WebP per time of day | ≤ 300 KB each |
| Wall art | ✅ canvas-painted (original) | Own artwork | ≤ 256 px |
| Character | ✅ the user's VRoid VRMs (existing) | Compressed VRM ≤ 8 MB (M4) | see ASSET_REQUIREMENTS.md |
| Location budgets | declared in `study.json` | draw calls ≤ 220, triangles ≤ 150k, textures ≤ 8 MB | |

Every asset must be listed in the manifest's `assets` with a `license`; validation fails otherwise.

## Known limitations
- No walking or transitions yet (M1-C); no camera close-ups (M1-B).
- ~~Budgets not measured~~ **Fixed in M1-B:** measuring showed **389 draw calls (over the 220 budget)**. Static meshes are now merged per material: **50 draw calls, 25,504 triangles**. This is enforced by `budget.test.ts` and checked at runtime.
- The armchair seat height (0.45) and relaxed pose are tuned for VRoid proportions; other rigs may float or sink slightly.
- ~~Slow first dev load~~ **Fixed in M1-B:** dev now uses Turbopack (first compile 5.7 s → 3.7 s; world first frame 1.36 s → 0.65 s, measured). The room renders before the character finishes loading. Models and audio get a 1-day cache plus background revalidation in production.
