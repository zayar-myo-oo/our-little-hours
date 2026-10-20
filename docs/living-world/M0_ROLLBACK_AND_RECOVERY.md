# M0: Save Versioning, Rollback and Data Recovery

## What changed in storage

| | Before M0 | After M0 |
|---|---|---|
| Key | `olh-save-v1` (IndexedDB `our-little-hours` / `kv`, falling back to localStorage, then memory) | **same key**, same database |
| Stored shape | `{ "state": {...}, "version": 0 }` (zustand default, no versioning) | `{ "state": {...}, "version": 1 }`, same `state` shape |
| Validation | Only the story node was checked | Every field is validated individually (`src/store/save/schema.ts`); one bad value never discards the rest |
| Backups | none | The raw save is copied before any migration, future-version read or malformed read |
| World data | none | Interface only for `olh-world-v1` (`src/world/store/worldPersistence.ts`). **Nothing is written yet.** |

`state` keeps exactly the same fields (`config, timer, tasks, chat, story, settings`), so v0 → v1 only normalizes values. The `0 → 1` step in `MIGRATIONS` is the identity followed by validation.

## How a save is loaded

1. `createVersionedStorage` (`src/store/save/recovery.ts`) reads the raw string and classifies it with `inspectRaw`:
   - `empty`: the app starts fresh.
   - `current` (v1): passed through with no backup.
   - `legacy` (v0 or missing version): **backed up**, then passed to zustand, which calls `migrate`.
   - `future` (> v1): **backed up**, then known fields are read best-effort.
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

M0 is backward-compatible in one direction only:

- **Rolling back to pre-M0 code is NOT safe as-is.** The old build has `version: 0` and no `migrate`. When it reads a v1 save, zustand logs "couldn't be migrated" and starts with **defaults**, and the old build then **overwrites the v1 save with those defaults** on the first change.
  → Before rolling back, ship this one-line patch to the old build: add `version: 1` to its persist options (no migrate needed; the `state` shape is identical).
  → If an unpatched rollback already happened, run `olhRecovery.restore(...)` with the `legacy` backup (the original v0 data, byte-for-byte). Changes made after the M0 upgrade but before the rollback are only recoverable if a later backup exists. (`olhRecovery` only exists in M0+ builds. On an older build, open DevTools → Application → IndexedDB → `our-little-hours` → `kv`, and copy the backup's value into `olh-save-v1`.)
- Git: M0 lives on `feat/living-world-m0`. Reverting means not merging it, or `git revert` of its commit(s).
- The Living World flag (`livingWorld`) is **off by default** and gates nothing visible in M0, so no flag rollback is needed.

## Feature flag

`src/lib/featureFlags.ts`, `livingWorld` (default `false`). Precedence: URL `?ff=livingWorld` / `?ff=-livingWorld` > localStorage `olh-ff` (JSON) > env `NEXT_PUBLIC_FF_LIVING_WORLD` > default.

## Rendering pause

`src/lib/visibility.ts → pauseWhenHidden` stops the three.js RAF loop and the Pixi ticker while the tab is hidden, and resumes when it's visible again (the three.js clock delta is reset so animations don't jump). The Pomodoro timer stores absolute timestamps (`endsAt`), so its correctness doesn't depend on rendering or on interval throttling.
