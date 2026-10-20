# Living World: Migration Plan

Principles: **additive, behind a flag, never destructive.** The legacy `"3d"` room stays the default until the world mode passes its acceptance criteria. Each milestone is its own feature branch and PR, is green on tests, and is deployable on its own.

## Milestone 0: Foundations (no visible change)

| # | Change | File(s) | Test |
|---|---|---|---|
| 0.1 | Add `version: 2` + `migrate` to the game store. v1 data passes through untouched; new optional settings get defaults (`quality: "auto"`, `memoryEnabled: true`), and the `renderMode` union gains `"world"`. | `apps/web/src/store/useGame.ts` | `store/migrations.test.ts`: a v1 fixture keeps tasks, timer, story and settings exactly |
| 0.2 | Pause the render loop on `visibilitychange` (legacy 3D and 2D) | `components/room3d/scene3d.ts`, `components/room/scene.ts` | manual check + world smoke later |
| 0.3 | Use store selectors in `page.tsx` (stop whole-store re-renders) | `apps/web/src/app/page.tsx` | existing tests, plus a check that the panels still update |
| 0.4 | Move `rng` to `src/lib/rng.ts` (re-export from `kit.ts`) | `components/room3d/kit.ts`, new `lib/rng.ts` | `rng.test.ts` (deterministic sequence) |
| 0.5 | Extract the VRM load, pose and brightness code from `scene3d.ts` into `components/world/character/vrmLoader.ts`, called by `scene3d.ts` with **identical behaviour** | `components/room3d/scene3d.ts`, new `vrmLoader.ts` | pure helpers (seat-lift math, VRM0 flip) unit-tested; visual check of all 5 characters |
| 0.6 | Re-enable CI (`infra/github-workflows/ci.yml` → `.github/workflows/`) once `gh` has the `workflow` scope | `.github/workflows/ci.yml` | CI green |

## Milestone 1: "A day in the study" (FIRST PLAYABLE)

**What the player sees:** Settings → Room style → **"Living world (beta)"**. The study is shown as an isometric diorama. Mio moves between the **desk, reading nook, window and tea corner** on her own, following her needs and schedule. Tapping her gives a cinematic close-up; tapping again (or Esc) returns to the overview. When you start a focus session, she walks to her desk and studies with you. When you come back after being away, a card says what she did. All existing panels work unchanged.

Files to **add**:
```
src/world/sim/{types,clock,needs,activities,planner,character,availability,catchUp,diary}.ts (+ tests)
src/world/nav/waypointGraph.ts (+ test)
src/world/locations/{schema,loader}.ts (+ test)
src/world/store/{useWorld,migrations}.ts (+ test)
src/world/runtime/useSimulation.ts
src/components/world/WorldRenderer.ts
src/components/world/camera/{CameraDirector,shots}.ts (+ shots.test.ts)
src/components/world/character/{animator,proceduralFallback}.ts
src/components/world/prefabs/{registry,study,shared}.ts
src/components/world/{quality.ts,AwayCard.tsx}
content/world/{needs,activities,diary-lines}.json
content/locations/study.json
```
Files to **modify**:
- `src/components/room/Room.tsx`: add a `"world"` branch (dynamic import of `WorldRenderer`). The fallback chain becomes world → 3d → 2d → css.
- `src/app/page.tsx`: when `renderMode === "world"`, mount `useSimulation`, derive availability from the world store, and render `AwayCard`.
- `src/components/panels/SettingsPanel.tsx`: add the "Living world (beta)" option and a quality selector.
- `src/systems/chat/types.ts`: add optional `location?`, `mood?`.

Dependency: `@pixiv/three-vrm-animation` (MIT).

**Acceptance criteria**
1. With `renderMode: "world"`, she performs at least 4 distinct activities over a simulated day, and the paths never clip through the desk or bed (waypoints).
2. A focus session started in Focus makes her go to the desk within 10 s of real time. A break moves her elsewhere.
3. The Iso ↔ cinematic transition is smooth (≥ 50 fps on a mid laptop), cuts under reduced motion, and works with touch and mouse.
4. After closing for ≥ 1 h, reopening shows a correct "While you were away" summary, and her state is plausible (sleeping at night).
5. Switching characters swaps the character only (no environment rebuild) and works for all 5 VRMs.
6. If the VRMA files are missing, the procedural fallback is used with no errors.
7. Switching back to `"3d"` shows the legacy room exactly as before, and `olh-save-v1` data is unchanged (fixture diff).
8. Tests: the sim is deterministic (same seed gives the same 24 h trace), `catchUp` equals stepping on a 2 h window, A* path validity, shot blend math, and world-store migrations.

## Milestone 2: Memory and diary
`memory.ts`, facts extraction, `memories` in `ChatContext`, templated callbacks in `mockProvider.ts`, an Ollama prompt section, a Diary panel (new bottom-nav item, or inside Story), and "Forget everything". Tests cover salience decay, capping and fact extraction patterns.

## Milestone 3: More locations
`kitchen.json` and `balcony.json` with prefabs, exits and the paper-wipe transition, plus activities `make_tea`, `eat` and `water_plants`. Only one location is resident on the GPU. Tests cover location schema validation and cross-location planning.

## Milestone 4: Mobile performance and asset pipeline
Quality tiers with auto-detection and an FPS probe, a frame cap, render-on-demand, an `npm run assets:optimize` script (gltf-transform: meshopt and KTX2) producing VRMs under 8 MB, and an optional Playwright smoke test.

## Milestone 5: Art upgrade
Painted backdrops, GLB props replacing primitive prefabs (data unchanged), more VRMA clips and expressions per activity.

## Save-data strategy

| Key | Owner | Versioning | Reset |
|---|---|---|---|
| `olh-save-v1` (IndexedDB) | `useGame` (existing) | `version: 2` from M0; `migrate` is read-only and additive; key name kept | existing "Reset local save" |
| `olh-world-v1` (IndexedDB) | `useWorld` (new) | `version: 1`; its own migrations | new "Reset world" (does not touch tasks or timer) |

The old data is never deleted or rewritten in place. Each migration has a fixture test. On a migration error, the app falls back to defaults **in memory only** and logs a warning, so the original data stays on disk for a later fixed release.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| VRMA retargeting looks wrong on some VRoid models | Per-clip test on all 5 models; procedural fallback; tune clip offsets in `animator.ts` |
| Mobile GPU/memory with 20 MB VRMs | M4 compression, quality tiers, single resident location, lazy-load the character |
| Save corruption | Separate world key, additive migrations, fixture tests, no destructive writes |
| Sim feels random or repetitive | Schedule prior, recency penalty, user coupling; tuning lives in JSON |
| Determinism broken by `Date` or `Math.random` in sim | Lint rule or test: the sim modules must not reference `Date`/`Math.random` (grep test) |
| Scope creep | M1 is fixed to a single location and 4 anchors |
| Licensing (VRoid sample-based model, animations) | `ASSET_LICENSES.md` ledger; verify each source before committing |
| Async WebGL init race (strict mode) | Keep strict mode off; make `createWorldScene` idempotent with a cancel token like `Room.tsx` |

## Rollback
Each milestone sits behind `renderMode: "world"`. Rolling back means setting the default back to `"3d"` and hiding the option, with no data changes needed.
