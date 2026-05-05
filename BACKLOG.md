# Backlog

Out-of-scope items captured during phase work. Each phase reviews this at start and pulls in items still relevant.

## Phase 1 — Core loop

_(empty — P1 shipped)_

## Phase 2 — Real users, real zones

- Refactor `slotCount` computation duplicated between `functions/src/lib/validate.ts` and `functions/src/index.ts` — either return computed values from `validateCreateEventInput` or move the cap check into the handler with shared variables. P1 review flagged latent divergence risk.
- `EventPage` auto-join uses the lowercased localStorage key as the participant's display name. P2 should preserve the user's original-cased name (store it in localStorage alongside the UUID, or look it up from the existing Firestore participant doc).
- `EventPage` `handleJoin` swallows `joinAs` errors silently (network failure, rule rejection). Add user-visible error feedback (toast or inline error in NamePrompt).

## Phase 3 — Make it usable

_(empty)_

## Phase 4 — Make it shareable

_(empty)_

## Phase 5 — Make it polished

- Write Firestore security-rules tests against the emulator suite (the deny-by-default baseline lands in P0; per-document rules + emulator-backed tests land here).
- Bump Cloud Functions Node runtime from 20 to 22 (Node 20 is decommissioned 2026-10-30).
- Bump `firebase-functions` to latest (currently `^6.1.0`; warning on every deploy).
- ~~`cleanupExpiredEvents` scheduled function~~ — promoted out of P5; landed early. Runs daily at 03:00 UTC and deletes events past their 90-day expiresAt along with all participants + comments via recursiveDelete.

## Beyond launch

- Days-of-week event mode (recurring or within range) — deprioritized from P1 per UX simplification. The Cloud Function already validates all three modes; re-adding the client UI is straightforward when the recurring-meeting use case becomes a priority.
- Magic-link return-edit for participants/hosts.
- Live editor avatars (showing who's currently painting).
- Optional Google Calendar one-way overlay ("show my busy times").
- Per-slot comments.
- Saved templates ("recurring poker night").
- Two-way calendar sync (would require Cloud Run + Pub/Sub).
- Smart suggestions from historical group data (Vertex AI).

## Implementation prerequisites (developer environment)

- **JDK 21+** required to run `npm run emulators` (the Firestore emulator JAR is compiled to Java 21 bytecode). Install via `winget install Microsoft.OpenJDK.21` on Windows.
