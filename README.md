# schedule2gather

A modern When2Meet successor — group availability scheduling with per-participant time zones, mobile-friendly painting, and live updates. Fully serverless on Firebase.

See [`PRODUCTION.md`](./PRODUCTION.md) for the full spec, architecture, and phased roadmap.

## Quick start

```bash
npm install
cp .env.example .env   # then fill in Firebase config
npm run dev
```

`.env` needs the full Firebase config, **including `VITE_FIREBASE_DATABASE_URL`** (the Realtime
Database instance URL). Everything else works without it, but live presence dots silently disable
if it's missing — see `docs/architecture.md` for the fallback behavior.

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

Phases 0–3 shipped, followed by a **2026-07 design-system redesign**: a warm light/dark visual
overhaul, a best-times panel with calendar export (.ics / Google Calendar / copy), and live
presence avatars backed by Firebase Realtime Database. See `PRODUCTION.md` §12 for the full phase
history and:

- [`docs/architecture.md`](./docs/architecture.md) — system context, data model, security model, CI/CD
- [`docs/design-system.md`](./docs/design-system.md) — tokens, typography, UI primitives
- [`docs/ux-flows.md`](./docs/ux-flows.md) — host/invitee journeys, screen inventory, accessibility
