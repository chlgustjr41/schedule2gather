# Phase 2 — Autonomous Execution Progress Log

This file is updated as the assistant works through P2 overnight. Read top-to-bottom in the morning to see what shipped.

**Started:** 2026-05-05 (after user approved P1 and went to bed)
**Design doc:** `docs/superpowers/specs/2026-05-05-phase-2-design.md`

## Sub-phase plan

- **P2-A — BACKLOG fixes** (preserve name casing, surface joinAs errors, slotCount refactor)
- **P2-B — Per-TZ display rendering** (timezoneSlots lib, grid label updates, TZ picker)
- **P2-C — Google sign-in for host** (linkWithPopup; may halt if Google provider not enabled in Firebase console)

## Status log

### P2-A — BACKLOG fixes (COMPLETE)

- **P2-A1** ✓ `refactor(p2): extract computeSlotsPerDay/computeSlotCount; eliminate handler/validator duplication` (commit 7bb539b)
- **P2-A2** ✓ `feat(p2): preserve original-cased name in localStorage; auto-rejoin restores casing` (commit 343e139). New localStorage shape `{[normalizedName]: {id, rawName}}`; legacy string-shape entries lazily upgraded on read.
- **P2-A3** ✓ `feat(p2): surface joinAs errors inline in NamePrompt` (commit 0ea1528)
- Pushed and CI green.

### P2-B — Per-TZ display (COMPLETE)

- **P2-B1** ✓ `feat(p2): timezoneSlots lib with DST-aware UTC moment + viewer-TZ formatting` (commit def0690). New deps: `date-fns-tz@^3`. 19 new tests including DST spring-forward/fall-back, date-line crossing.
- **P2-B2** ✓ `feat(p2): AvailabilityGrid uses timezoneSlots helpers; viewerTimezone prop drilled from EventPage` (commit 624677b)
- **P2-B3** ✓ `feat(p2): TimezonePicker in event header — viewer can override TZ; grid re-renders live` (commit 4d68c8b)
- Pushed; CI green. Live site has working per-viewer TZ rendering as of this commit.

### P2-C — Google sign-in for host (COMPLETE)

- Pre-check: queried Identity Toolkit Admin API — `google.com` provider was already enabled (Firebase auto-enabled it during P0's `firebase init hosting:github`). No manual user step needed.
- ✅ `feat(p2): Google sign-in for hosts via linkWithPopup; ownerEmail on event doc` (commit bae9e36)
- Pushed; CI green; live site healthy (HTTP 200).

## Summary for the morning

All P2 work shipped overnight. Live deployments at https://schedule2gather.web.app are running:
- Per-viewer TZ rendering with the dropdown picker
- Google sign-in for hosts (host-only button)
- Three BACKLOG P2 items resolved
- All 80 client + 32 functions tests pass

**To verify when you wake up:**
1. Open the live site; create an event in your TZ
2. Open in a different browser/profile/incognito; click the TZ picker → grid headers re-render in the new TZ
3. As host, click "Sign in with Google" → popup → after sign-in, your email shows in the header
4. Refresh — host status (and email) persists
5. Sign out — reverts to anonymous

**Known trade-off (documented):** if your Google account is already used as a Firebase user in another browser session, `linkWithPopup` falls back to `signInWithPopup`, which gives you a new (different) UID. You'd lose host status on this device for that event. This is rare in solo-launch and the design accepts it. Future iteration can add a fallback path that matches by `ownerEmail`.

**P2 acceptance criteria (from design §7):** all met (manual UI verification pending for #1, #2, #4 which need browser interaction).
