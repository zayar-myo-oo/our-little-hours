# Manual build steps / ကိုယ်တိုင် build လုပ်နည်း

## Requirements / လိုအပ်ချက်များ
- Node.js 20+ (`node -v`)
- (Backend, optional) Java 21 + Docker Desktop

## 1. Frontend (the game) / ဂိမ်း
```bash
cd apps/web
npm install          # install dependencies
npm run test         # run the logic tests
npm run typecheck    # TypeScript check
npm run dev          # http://localhost:3000
npm run build && npm start   # production build
```

## 2. Database (optional)
```bash
cd infra
cp ../.env.example .env
docker compose up -d postgres
```

## 3. Backend API (optional, Java 21 required)
```bash
cd apps/api
./gradlew bootRun    # JDK 21 required
```
http://localhost:8080/api/health should return `{"status":"UP"}`.
The game works fully offline even without the backend.

## 4. Your own music / audio files
- Put lo-fi tracks in `apps/web/public/audio/music/`.
- Add each file name to `apps/web/public/audio/music/manifest.json`.
- Use only audio you have the rights to (CC0 or your own recordings).

## If there are errors
- `rm -rf node_modules .next && npm install`
- Check that the `node -v` version is 20 or newer.
