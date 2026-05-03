# Backlog

Out-of-scope items captured during phase work. Each phase reviews this at start and pulls in items still relevant.

## Phase 1 — Core loop

- Remove the `console.log('Anonymous UID:', user.uid)` debug line in `src/App.tsx` (was tagged `// TODO(p1): remove` during P0 — it was needed for the P0 acceptance criterion but should not ship in P1).

## Phase 2 — Real users, real zones

_(empty)_

## Phase 3 — Make it usable

_(empty)_

## Phase 4 — Make it shareable

_(empty)_

## Phase 5 — Make it polished

- Re-verify the Firebase emulator suite boots and write security-rules tests against it (suite was installed in P0 but blocked locally on JDK version; now requires JDK 21+).
- Audit the 6 npm vulnerabilities reported during P0 install (5 moderate, 1 critical — likely transitive in dev deps; revisit with `npm audit` and triage).

## Beyond launch

- Magic-link return-edit for participants/hosts.
- Live editor avatars (showing who's currently painting).
- Optional Google Calendar one-way overlay ("show my busy times").
- Per-slot comments.
- Saved templates ("recurring poker night").
- Two-way calendar sync (would require Cloud Run + Pub/Sub).
- Smart suggestions from historical group data (Vertex AI).

## Implementation prerequisites (developer environment)

- **JDK 21+** required to run `npm run emulators` (the Firestore emulator JAR is compiled to Java 21 bytecode). Install via `winget install Microsoft.OpenJDK.21` on Windows.
