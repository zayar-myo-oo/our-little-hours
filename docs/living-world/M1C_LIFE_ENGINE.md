# M1-C: Mio's autonomous life engine

**Enable:** `/?ff=livingWorld` (feature flag, default off). **Fast-forward demo:** `&simSpeed=60` (1 min per second; demo mode **never saves**).

## Architecture
| Layer | File | Notes |
|---|---|---|
| Data | `content/world/activities.json` | activities, needs effects, sleep windows, weekday/weekend routines, personality |
| Walk graph | `content/locations/study.json → waypoints` | nodes + edges; every anchor must be reachable (validated) |
| Simulation (pure) | `apps/web/src/world/sim/{engine,nav,time,rng}.ts` | no React, three.js, `Date` or `Math.random` (enforced by a test) |
| Runtime | `apps/web/src/world/runtime/simRuntime.ts` | load → bounded catch-up → tick → save, using `olh-world-v1` only |
| React | `apps/web/src/world/runtime/useLivingWorld.ts` | 1 s tick, autosave every 30 s and when hidden or closing |
| Rendering | `components/world/WorldRenderer.ts → applySim()` | walking along the path, procedural walk cycle, poses per activity |

## State (persisted in `olh-world-v1`)
Location, current anchor, current segment (activity, start/end, walking path), needs (energy, mood, creativity, focus, social), recent history (20), events (200, for M1-D), seed, RNG state, last simulated timestamp.

## Behaviour
- **Activities:** studying (desk), reading and relaxing (armchair), tea (tea corner), window, sleeping (armchair: the study has no bed, so a bedroom comes in M3), and walking between them.
- **Choosing:** utility score = need urgency × activity effect + routine bias (weekday/weekend, time of day) + personality − repetition penalty (−60 for the same activity as last time, −12 per recent repeat) + small seeded noise.
- **Impossible transitions are prevented:** an activity only happens at its anchor and is always preceded by a walk; no studying when energy < 18; sleeping only inside the sleep window (and always then); segments are back to back with no gaps or overlaps (tested over a full week).
- **Offline:** on return the simulation advances to now. Absences over 7 days skip ahead and simulate only the last 7 days (bounded, < 2 s). Advancing in one jump equals advancing minute by minute (tested), so catch-up is exact.
- **Character:** uses the selected VRM. The walk is procedural (alternating legs and arms, slight bob), since no VRMA clips exist yet. Falls back to the placeholder figure.
- **Camera:** arriving somewhere triggers the M1-B auto close-up.

## Safety
- Never reads or writes `olh-save-v1` (tested with a key-tracking storage).
- A corrupted world save is backed up and a fresh life starts. A world save from a newer version runs **read-only**.
- `simSpeed` ≠ 1 never persists.

## Known limitations
- The procedural walk is basic; real animation clips (VRMA) would look much better (see ASSET_REQUIREMENTS.md).
- On the last 0.35–0.6 m into a seat she glides into the sitting pose (no sit-down animation yet).
- Pomodoro "focus together" and the "While you were away" card are M1-D.
