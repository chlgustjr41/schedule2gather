# schedule2gather

A modern When2Meet successor — group availability scheduling with per-participant time zones, mobile-friendly painting, and live updates. Fully serverless on Firebase.

See [`PRODUCTION.md`](./PRODUCTION.md) for the full spec, architecture, and phased roadmap.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in Firebase config
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript noEmit check
- `npm test` — Vitest run
- `npm run emulators` — Start Firebase emulator suite (Firestore + Auth) — requires JDK 21+
- `npm run deploy` — Deploy hosting + Firestore rules to the `schedule2gather` Firebase project

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`), logged in via `firebase login`
- JDK 21+ (only needed if you run the emulator suite via `npm run emulators`)

## Status

Currently in **Phase 0 — Foundation**. See `PRODUCTION.md` §12 for the phase plan.
