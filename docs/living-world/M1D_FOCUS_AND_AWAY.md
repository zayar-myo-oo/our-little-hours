# M1-D: Focus Together and While You Were Away

Behind the `livingWorld` flag (`/?ff=livingWorld`).

## Focus Together
- When a Pomodoro **focus** phase is running, the page passes only its end time (`timer.endsAt`) to the simulation. The timer, tasks and the game save are never modified (read-only use).
- `joinFocus(state, until, now)` (pure, `world/sim/engine.ts`): if she's awake and able to study, her current activity ends now (effects count for the time actually spent) and she **walks** to the desk and studies **until the session ends**. Mid-walk, she finishes that stretch first (no teleporting). Asleep (sleep window) or exhausted (energy < 18): she stays as she is. Repeating the call for the same session is a no-op.
- When the session ends or is paused or reset, `leaveFocus` clears the link and she returns to her own routine after the current activity.
- Survives reloads: the focus link is part of the world save, and the hook re-sends the running session on start.

## While You Were Away
- `summarizeAway(events, from, to)` (`world/sim/away.ts`) uses **only recorded simulation events** in the absence window. It groups them by activity and shows the biggest first, **2–4 highlights**. There's no card if the absence was under 30 minutes or there's too little to say.
- Gentle copy in `content/world/away-lines.json`. A test forbids guilt words ("miss", "lonely", "waited", "where were you", …).
- **No repeats:** the runtime saves right after computing the summary, so the absence is consumed. Reopening immediately shows no card (tested).
- Dismiss with ✕ or "Welcome back ♡".
- All world data lives in `olh-world-v1`.

## Tests
Unit (`engine.test.ts` Focus Together, `away.test.ts`), integration through the runtime with storage (`simRuntime.test.ts`: summary built from real events, shown once; focus join and leave), and UI (`AwayCard.test.tsx`).
Verified in the browser: pressing Start in Focus switches her to "Walking to the desk", and after a reload she keeps studying until the timer ends. A simulated 4-hour absence shows a card with 4 real highlights.
