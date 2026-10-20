# Living World: Audit (Phase 00)

Audit of `main` @ `fe4904f`, made on branch `feat/living-world-audit`. The working tree was clean (no uncommitted changes to preserve).
Scope: the current source, dependencies and extension points, ahead of the 2.5D Living Anime World upgrade. **Nothing is implemented in this phase.**

## 1. Inventory

| Area | Files | LOC | Tests |
|---|---|---|---|
| App shell / orchestration | `src/app/page.tsx`, `layout.tsx`, `globals.css` | 136 | none |
| State + persistence | `src/store/useGame.ts`, `src/systems/persistence/idbStorage.ts` | 132 | idbStorage round-trip |
| Productivity | `src/systems/productivity/{pomodoro,tasks}.ts` | 73 | 6 |
| Character | `src/systems/character/{schedule,models}.ts` | 69 | 6 |
| Chat | `src/systems/chat/{types,mockProvider,ollamaProvider}.ts` | 81 | 3 |
| Story | `src/systems/story/engine.ts`, `content/story/the-unfinished-page.json` | 37 + JSON | 4 |
| Audio | `src/systems/audio/{ambient,music}.ts`, `MusicPanel.tsx` | 150 | none |
| 3D room (current default) | `src/components/room3d/{scene3d,environment,kit,timeOfDay}.ts` | 540 | 3 (palette) |
| 2D room (legacy) | `src/components/room/scene.ts` | 187 | none |
| Renderer switch | `src/components/room/Room.tsx` | 52 | none |
| UI panels | `src/components/panels/*.tsx` | ~305 | none |
| Backend (optional) | `apps/api` (Spring Boot 3.3, Java 21, Flyway, H2 tests) | small | 2 (MockMvc) |

Runtime dependencies: `next@15.5`, `react@19.3`, `zustand@5`, `three@0.186`, `@pixiv/three-vrm@3.5`, `pixi.js@8.22`. All are free and open source. There are no paid services.
Assets: 5 VRoid VRM 1.0 characters (18–22 MB each, uncompressed) and 9 CC0 lofi tracks (≈40 MB). There are no animation clips.

## 2. How it works today

```
page.tsx (React)
 ├─ setInterval 500 ms → setNow → re-render whole page (useGame() subscribes to the entire store)
 ├─ currentBlock(new Date())  ← character "life" = pure lookup of a fixed daily schedule
 ├─ timer tick / notifications / chat push       (effects in page.tsx)
 └─ <Room mode state rain modelUrl/>
      └─ createScene3D | createScene (Pixi) | CSS fallback
           handle: setState(Availability) · setReducedMotion · setRain · destroy
```

- **Character simulation:** `schedule.ts` maps the wall-clock minute to `AVAILABLE | BUSY | SLEEPING` plus an activity label. There is no internal state, needs, position or memory. "Offline progression" is trivially consistent (it's a function of time), but nothing accumulates.
- **Renderer contract:** imperative and narrow, and only knows *availability*. The character is pinned to one chair. The camera is hard-coded in `scene3d.ts → resize()`.
- **Location:** one room, built procedurally in `environment.ts` (243 lines, a single function with layout coordinates baked in).
- **Persistence:** a single Zustand `persist` key `olh-save-v1` in IndexedDB (falling back to localStorage, then memory). `partialize` saves `config, timer, tasks, chat, story, settings`. The `merge` is shallow, with a guard for invalid story nodes. **There's no `version` or `migrate` function.**
- **Chat:** a clean `ChatProvider` adapter with a `ChatContext` (name, availability, activity, task and focus counts, hour). The mock replies with rules and templates; Ollama is optional with a fallback. There's no long-term memory, only the last 100 messages.
- **Story:** a JSON graph engine with flags, and a `@companion` speaker token that resolves to the chosen character.

## 3. Safe extension points

| Extension point | Why it's safe | Use it for |
|---|---|---|
| `Room.tsx` mode switch (`"3d" \| "2d"` + CSS fallback) | Already a fallback chain; adding a `"world"` branch doesn't touch existing branches | New 2.5D renderer behind `renderMode: "world"` |
| Renderer handle (`setState/…/destroy`) | Small interface; the new renderer can implement a superset | `applySnapshot(WorldSnapshot)` instead of `setState` |
| `ChatContext` (`systems/chat/types.ts`) | Every field is read with defaults; adding optional fields is non-breaking | `memories`, `location`, `mood` |
| `schedule.ts` | Pure and tested | Reuse as a *prior* for the life engine, and as the source of the derived Availability |
| `kit.ts` (toon helpers, `rng`) | Pure helpers with no scene assumptions | Shared prefab toolkit for locations |
| `environment.ts` | Self-contained `buildEnvironment(kit, scene, pal)` | Wrap it as the "study" location's prefab set at first, then split it |
| VRM loader block in `scene3d.ts` | Self-contained and handles VRM 0/1 | Extract to `vrmLoader.ts` for the world renderer, unchanged |
| `persist` options in `useGame.ts` | Zustand supports `version` + `migrate` | Versioned saves; the new world state goes under a separate key |
| `content/` (JSON via the `@content` alias) | Content is already data-driven | Locations, activities, memory lines |

## 4. Gaps against the mission

1. **No world model.** No positions, locations, navigation or activities beyond a schedule label.
2. **No autonomy.** Behaviour is a lookup, not decisions. No needs, utility or randomness.
3. **No camera system.** A single fixed perspective shot; no isometric view, no shots, no transitions.
4. **No animation.** VRMs are posed procedurally into one seated pose; there are no VRMA clips. Walking is impossible today.
5. **No memory or offline progression.** No elapsed-time catch-up, diary or remembered facts.
6. **Single location.** Layout is hard-coded in one function.
7. **No simulation loop.** Logic runs inside React effects in `page.tsx`, at 500 ms and coupled to renders.

## 5. Risks and debts found

| # | Finding | Severity | Notes |
|---|---|---|---|
| R1 | Saves have no `version`/`migrate` | **High** | Any change to the persisted shape can silently drop or corrupt user data. Fix this before anything else. |
| R2 | `useGame()` with no selector in `page.tsx` re-renders the whole tree every 500 ms | Medium | Gets worse as the world UI grows. Use selectors or move the clock out of React state. |
| R3 | Renderer is fully destroyed and rebuilt on character or mode switch | Medium | Re-downloads a ~20 MB VRM and rebuilds the environment. The world renderer must hot-swap the character. |
| R4 | The render loop never pauses when the tab is hidden | Medium | Battery drain on mobile. Use `visibilitychange` to pause. |
| R5 | VRMs are 18–22 MB uncompressed | Medium–High (mobile) | Compress them with meshopt + KTX2 (gltf-transform, free). Target under 8 MB. |
| R6 | Bloom plus DPR 2 on every device | Medium | Needs quality tiers. |
| R7 | React strict mode is disabled (async WebGL init race) | Low | Keep it off, or make scene init idempotent. Document it. |
| R8 | `gh-pages` deploy is manual and stale; CI workflows are parked in `infra/github-workflows` (the token lacked `workflow` scope) | Low | Vercel deploys from `main`. Re-enable CI once the scope is granted. |
| R9 | `Shion.vrm` metadata lists the author as "pixiv VRoid Project" (likely a VRoid sample base), and all models are in a public repo | Legal / Medium | Verify the VRoid sample model terms before more public use. Keep a license ledger. |
| R10 | The 2D Pixi room has diverged from 3D (different art, no character models) | Low | Keep as the low-end fallback only. Don't extend it. |
| R11 | No render, integration or e2e tests | Medium | The world renderer needs at least a smoke test. |

## 6. Preserve list (must keep working)

Pomodoro (timestamp-based, survives reloads), tasks, music and ambience, chat (mock and Ollama), story progress, the character picker, the `"3d"` legacy room (stays the default until the world mode is stable), the `"2d"` and CSS fallbacks, reduced motion, the `?hour=` preview, the `olh-save-v1` data, and static export plus the Vercel deploy.

## 7. Recommendation

Build the Living World as a **parallel renderer plus a pure simulation core**, selected by `renderMode: "world"` (beta). Leave the legacy room untouched. Fix R1 (save versioning) and R4 (visibility pause) as Milestone 0 before any world code. See ARCHITECTURE.md and MIGRATION_PLAN.md.
