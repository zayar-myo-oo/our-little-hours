# M1-B: Hybrid isometric and cinematic camera

One perspective camera (`components/world/camera/director.ts`) with two kinds of preset:
- **Overview:** the isometric-style shot from M1-A (narrow FOV, far away, fitted to the room).
- **Close-ups:** one per anchor (`camera.closeups` in `content/locations/study.json`).

## The model (why it's a true dolly zoom)
The camera is `{ target, yaw, pitch, fov, frameH }`, where `frameH` is the visible height at the subject. The distance is derived: `d = frameH / (2·tan(fov/2))`. Transitions interpolate target (linear), yaw (shortest way round), pitch, fov (linear) and frameH (geometric, for an even zoom speed). Because the distance follows from frameH and fov, a fov change at constant frameH moves the camera so the subject keeps its size. That's a dolly zoom, not a plain zoom. `director.test.ts` proves it with a real three.js projection and shows that a plain zoom would fail the same check.

## Comfort and safety
- Easing is in-out cubic; duration is 0.9–2.4 s, scaled by how far the view turns, zooms and moves (no whip pans, no roll).
- **Reduced motion:** cuts instead of animating.
- **Interruptions:** a new request starts from the current in-between view, with no jump (tested).
- **Clipping:** a spring arm raycasts from the subject to the camera against walls and furniture and pulls the camera in front of any hit (min 0.6 m). This is tested against the real study geometry for every close-up, at desktop and phone aspect ratios, and along every overview → close-up path.
- **Foreground:** in close-ups, foreground props nearer than the subject fade out.
- **Character state** isn't touched by the camera.

## Switching
- **Automatic:** when she settles at an anchor, the matching close-up plays, then returns to the overview after `hold` seconds. Can be turned off ("Auto on/off").
- **Manual:** the camera buttons on the left (Room / Close-up / Auto), tap her for a close-up, Esc for the room. A manual choice pauses automatic switching for 45 s.
- **Demo/dev:** `/?ff=livingWorld&anchor=tea&camera=tea` (camera = `overview|desk|reading|window|tea`).

## Responsive
Portrait close-ups keep at least 1 m visible across (`responsiveFrameH`). The overview uses the M1-A portrait framing.

## Also in this milestone
- **Budgets measured:** `budget.ts` + `budget.test.ts` build the real room. The first measurement was 389 draw calls (over budget). `mergeStatic` brought it to 50 with identical triangles (25,504). The runtime warns if over budget, and `stats()` exposes the live numbers.
- **Faster first load:** dev uses Turbopack (first compile 5.7 s → 3.7 s; world first frame 1.36 s → 0.65 s). The room renders before the character finishes loading, with a "Loading character…" label. Models and audio get a 1-day cache.
- **Bug found by testing:** the window view prefab returned its mesh directly, so the manifest placement moved it below the floor. It's now wrapped, and every prefab is checked by `registry.test.ts`.
