# M0: Save Versioning, Rollback and Data Recovery

## What changed in storage

| | Before M0 | After M0 |
|---|---|---|
| Key | `olh-save-v1` (IndexedDB `our-little-hours` / `kv`, falling back to localStorage, then memory) | **same key**, same database |
| Stored shape | `{ "state": {...}, "version": 0 }` (zustand default, no versioning) | `{ "state": { "__schema": 1, ... }, "version": 0 }`: the schema version lives **inside** the state; the zustand envelope stays 0 |
| Validation | Only the story node was checked | Every field is validated individually (`src/store/save/schema.ts`); one bad value never discards the rest |
| Backups | none | The raw save is copied before any migration, future-version read or malformed read |
| World data | none | Interface only for `olh-world-v1` (`src/world/store/worldPersistence.ts`). **Nothing is written yet.** |

`state` keeps exactly the same fields (`config, timer, tasks, chat, story, settings`), so v0 → v1 only normalizes values. The `0 → 1` step in `MIGRATIONS` is the identity followed by validation.

## How a save is loaded

1. `createVersionedStorage` (`src/store/save/recovery.ts`) reads the raw string and classifies it with `inspectRaw`:
   - `empty`: the app starts fresh.
   - `current` (v1): passed through with no backup.
   - `legacy` (v0 or missing version): **backed up**, then passed to zustand, which calls `migrate`.
   - `future` (> v1): **backed up**, then known fields are read best-effort. The key becomes **read-only for the session**, so an older build never overwrites a newer save. Settings shows a notice.
   - `malformed` (not JSON, no `state`, bad version): **backed up**, then hidden from zustand, so the app starts with defaults.
2. If the backup itself fails (e.g. a quota error), the storage goes **read-only for that key** for the session. The app runs on defaults and never overwrites the original.
3. `merge` runs `sanitizeSave` on every load and logs repairs as `[save] load repaired: …`.

Backups are stored as `olh-save-v1.backup.<reason>.<timestamp>`, indexed in `olh-save-v1.backups`. Only the 5 most recent are kept.

## Recovering data (users and support)

In the browser console on the site:

```js
await olhRecovery.list()
// → [{ key: "olh-save-v1.backup.legacy.1792...", reason: "legacy", fromVersion: 0, createdAt: ... }]
await olhRecovery.restore("olh-save-v1.backup.legacy.1792...")  // current save is backed up first ("manual")
location.reload()
```

Restoring is reversible, because the save being replaced is itself backed up with reason `manual`.

## Rolling back the M0 code

**Rolling back to a pre-M0 build is safe.** M0 deliberately keeps zustand's envelope `version` at `0`, the value pre-M0 builds expect, and stores the schema version as `state.__schema`. A pre-M0 build reads the save normally and ignores the unknown `__schema` field. This is covered by `src/store/rollbackCompat.test.ts`, which runs the exact pre-M0 persist config against an M0 save. That test also shows why the envelope must stay 0: a version-1 envelope *would* make a pre-M0 build reset to defaults.

- After a rollback and a later re-upgrade, saves written by the old build simply have no `__schema` again. They're treated as legacy v0, backed up and migrated, which is harmless.
- Git: M0 lives on `feat/living-world-m0`. Reverting means not merging it, or `git revert` of its commits.
- The Living World flag (`livingWorld`) is **off by default** and gates nothing visible in M0.
- Builds from M0 development briefly wrote envelope `version: 1`. Those saves are read correctly (the envelope version is used when `__schema` is missing) and rewritten in the compatible format (`src/store/useGame.persist.test.ts`).

## Feature flag

`src/lib/featureFlags.ts`, `livingWorld` (default `false`). Precedence: URL `?ff=livingWorld` / `?ff=-livingWorld` > localStorage `olh-ff` (JSON) > env `NEXT_PUBLIC_FF_LIVING_WORLD` > default.

## Rendering pause

`src/lib/visibility.ts → pauseWhenHidden` stops the three.js RAF loop and the Pixi ticker while the tab is hidden, and resumes when it's visible again (the three.js clock delta is reset so animations don't jump). The Pomodoro timer stores absolute timestamps (`endsAt`), so its correctness doesn't depend on rendering or on interval throttling. Verified in the browser: 0 animation frames while hidden, resumed when visible.
