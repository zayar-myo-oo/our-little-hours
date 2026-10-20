# Our Little Hours

A cozy, zero-budget, browser-based 2D anime-style companion study room. Focus with a Pomodoro timer, keep a to-do list, listen to rain, chat with **Yuzu** (an original placeholder character) and read a short story, *The Unfinished Page*.

Everything runs locally. No paid APIs, accounts, or hosting.

## Quick start (frontend: the playable game)
```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000  (use `npm run dev -- -p 3100` if 3000 is taken)
```
Other commands: `npm test` (Vitest), `npm run typecheck`, `npm run build && npm start`.
Step-by-step instructions (English + Burmese): [docs/BUILD_STEPS.md](docs/BUILD_STEPS.md).

## Hosting (free, GitHub Pages)
Live site: https://zayar-myo-oo.github.io/our-little-hours/ (served from the `gh-pages` branch).
To update it by hand:
```bash
cd apps/web && STATIC_EXPORT=1 NEXT_PUBLIC_BASE_PATH=/our-little-hours npm run build:static
```
Then push the contents of `apps/web/out` (plus an empty `.nojekyll` file) to the `gh-pages` branch.
For automatic deploys and CI, see [infra/github-workflows](infra/github-workflows/README.md).
The hosted site is frontend-only: saves stay in each visitor's browser. The backend is not hosted (free always-on Java hosting basically doesn't exist).

## Repo layout
```
apps/web     Next.js App Router + TypeScript + Tailwind + Zustand + PixiJS
apps/api     Spring Boot 3 (Java 21, Gradle) + Flyway, optional
content/     Story and character JSON (story is loaded from here)
infra/       docker-compose.yml (PostgreSQL 16, optional API)
docs/        Build steps and architecture notes
```

## Features in this MVP
| Feature | Status |
|---|---|
| **3D room (three.js, cel-shaded)**: painted sky with drifting clouds, sun or moon and stars, a distant city (windows lit at night), sakura trees with branches reaching the window, falling petals, rain when the rain slider is above 0, sheer curtains that sway, twinkling fairy lights, sunbeams with floating dust, a wall clock showing the real time, a corkboard, plants, a rug, and a bloom glow. Preview other times of day with `?hour=13` (or 7, 18 and so on) | Works. Original placeholder made of simple shapes. Falls back to the 2D PixiJS room, then to CSS. Switch between 3D and 2D in Settings |
| Character switcher (Settings → Character) | Lists the characters in `apps/web/public/models/manifest.json` with preview pictures. Pick one and the room reloads with that VRM. Characters without a `.vrm` file show as "Not exported yet". Supports VRM 0.x and 1.0, and the seat height adjusts so hands reach the keyboard |
| Character schedule (AVAILABLE / BUSY / SLEEPING, local time) | Works. Changes the room (away, asleep) and chat replies |
| Pomodoro: start / pause / reset, focus, short and long breaks, custom durations | Works. Timestamp-based, so it survives reloads; optional browser notifications |
| To-do list: add, toggle, edit (double-click), delete, clear completed | Works |
| Rain and room ambience with separate volume sliders | Works. **Synthesized with Web Audio**, so no files are needed |
| Lo-fi music player | Ships with 9 CC0 lofi tracks from OpenGameArt (see `apps/web/public/audio/music/CREDITS.md`). Add your own the same way |
| Chat | Scripted offline replies by default. Optional local [Ollama](https://ollama.com) support with fallback |
| Story "The Unfinished Page" | Works. Branching choices and flags, progress saved |
| Local saves (tasks, timer, preferences, chat, story) | IndexedDB, falling back to localStorage, then memory |
| Reduced motion | Follows the system setting, or force it on/off in Settings |
| Responsive layout for desktop and mobile | Works. The scene crops around the character; panels and nav respect safe areas |

## Adding music
The bundled tracks are CC0. To add more, use only audio you have rights to (your own, or CC0). Put files in `apps/web/public/audio/music/` and list them:
```json
{ "tracks": [ { "title": "Rainy Desk", "artist": "You", "file": "rainy-desk.mp3", "license": "CC0" } ] }
```
Missing or broken files show an error in the Music panel instead of failing silently.

## Optional: Ollama chat (free, local)
Install Ollama, run `ollama pull llama3.2`, and start it with `OLLAMA_ORIGINS=http://localhost:3000 ollama serve`. Then choose "Ollama" under Settings → Chat mode.

## Optional: backend
```bash
cp .env.example infra/.env
cd infra && docker compose up -d postgres                # database only
docker compose --profile api up --build                  # database + API (builds with JDK 21 inside Docker)
# or, with a local JDK 21:  cd apps/api && ./gradlew bootRun
```
Endpoints: `GET /api/health`, `GET|PUT /api/saves/{guestId}` (Flyway migration `V1__guest_save.sql`).
Set `NEXT_PUBLIC_API_URL=http://localhost:8080` in `apps/web/.env.local` so Settings shows the backend status.
The web client does **not** sync saves to the backend yet. The API is a foundation for that.

Backend tests: `cd apps/api && ./gradlew test` (JDK 21; uses in-memory H2, so no database is needed). Verified passing locally and in CI.

## Architecture
- `src/systems/productivity`: pure Pomodoro state machine and task operations (unit tested)
- `src/systems/character`: daily schedule simulation (tested)
- `src/systems/chat`: the `ChatProvider` adapter, with mock and Ollama implementations (tested)
- `src/systems/story`: JSON-driven branching engine, validation and flag text (tested against the real content)
- `src/systems/audio`: procedural ambience engine and music manifest loader
- `src/systems/persistence`: IndexedDB `StateStorage` for Zustand (tested with fake-indexeddb)
- `src/components/room`: Pixi scene. **Live2D would plug in here** as a replacement for `buildCharacter()` behind the same `SceneHandle` interface. It is **not integrated**: no Live2D SDK or model is included.

## Still needed (real assets)
- A real anime character: a VRM model (VRoid Studio is free) or a licensed Live2D model. The current one is a simple placeholder made of shapes
- Optional recorded ambience to replace the synthesized rain
- Backend verification on a machine with JDK 21 or Docker, plus client-side cloud-save sync
