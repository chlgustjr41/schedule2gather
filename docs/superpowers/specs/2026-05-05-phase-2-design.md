# Phase 2 — Real users, real zones — Design

**Status:** Decided autonomously by the assistant on 2026-05-05 while the user was offline (per the user's explicit "continue automatically from here for overnight" instruction). All decisions are documented below for morning review; user can override any of them and I'll re-execute.

**Goal:** Per-participant time-zone rendering of the availability grid, plus host upgrade-to-Google via `linkWithPopup`. After P2, a host in NYC and a participant in Seoul can see the same event with each viewing the grid in their own TZ.

**Reference:** PRODUCTION.md §12 Phase 2.

---

## 1. Design decisions (locked autonomously)

| Question | Decision | Rationale |
|---|---|---|
| Where does TZ conversion happen? | **Display layer only.** The bitmap stays indexed by event-TZ slot position (P1's representation). At render time, the grid computes each slot's absolute UTC moment from `event.timezone` + `event.dates[dateIdx]` + slot offset, then formats it in the viewer's TZ. | Avoids a data-model migration and the security-rule churn that would come with re-keying the bitmap. The original spec called this "canonical UTC slot index" but the practical implementation is the same: storage stays event-TZ indexed; display is viewer-TZ formatted. |
| Viewer TZ source | `Intl.DateTimeFormat().resolvedOptions().timeZone` on first load; user can override via a dropdown in the event page header. | Matches the create-form auto-detect. Override lets a traveler set their TZ manually. |
| Date column labels | Show the viewer-TZ-localized date for each event-TZ slot. If an event-TZ "Monday May 5" lands on the viewer's "Sunday May 4" (e.g., NY host → LA viewer crossing date line backwards), the column header shows "Sun May 4". | Truthful display of when the slot actually occurs in the viewer's wall clock. |
| Time row labels | Show viewer-TZ-localized time. | Same. |
| Slot grouping when TZ shift causes a column to span two viewer-local dates | Keep the original event-defined columns; if a slot at the bottom of one event-day "spills over" midnight in the viewer's TZ, the column header simply shows whichever viewer-date covers most of the column (the "primary" date). | Keeps the grid topology stable — the same column-and-row indexing matches the bitmap. Alternative (re-laying-out by viewer-day) would break the slot-index invariant and explode complexity. |
| DST handling | Use `date-fns-tz`'s `fromZonedTime`/`toZonedTime` which handle DST. P2 ships with unit tests for spring-forward and fall-back boundaries (NYC and Sydney examples). | DST is the canonical correctness test for any TZ-aware app. |
| Days-of-week mode (`weekdays_recurring`) | Per-TZ rendering is **disabled** for this mode (everyone sees event TZ). When the create-form is re-enabled (post-launch), the doc will note this. P1 already removed the client UI for this mode, so it's effectively dead in P2. | Abstract weekdays don't have a UTC anchor, so per-TZ doesn't make sense. |
| Google sign-in entry point | Host-only, in the event-page header. A small "Save your event ownership" pill that opens a popup. After link, the badge changes to "Signed in as `<email>`". | Hosts have a reason to sign in (cross-device ownership). Participants don't, so don't clutter their UI. |
| Anonymous → Google upgrade method | `linkWithPopup(auth.currentUser!, googleProvider)`. UID is preserved. The user's existing event ownership stays intact. | Standard Firebase pattern. |
| If a user has already signed in with Google in another browser session | `linkWithPopup` would fail with `auth/credential-already-in-use`. We catch it, fall back to `signInWithPopup` to switch to the existing Google session, then check if the email matches an existing event-owner UID; if not, the user is now a different identity from the one that owns the event (acceptable trade-off for P2 — proper account-merge is post-launch). | Edge case is rare in solo-launch. The simple fallback gets the user signed in without losing the popup UX. |
| New Firestore field `event.ownerEmail` | Added when the host signs in with Google. Allows the UI to display "Owned by `<email>`" for hosts who return on a different device after sign-in. | Cheap to add; no migration needed for unowned events. |
| Sign-out for hosts | Add a small "Sign out" link in the host's pill UI. Signs out of Firebase entirely; user becomes anonymous again on next visit. | Good hygiene; expected by users. |

---

## 2. P2 in scope

1. **Per-TZ display rendering** in `AvailabilityGrid` and the event-page header
2. **TZ override dropdown** in the event-page header (defaults to detected; participant can change)
3. **Google sign-in for host** via `linkWithPopup` button on event page
4. **Sign-out** (host only)
5. **DST-boundary unit tests** for the new TZ helpers
6. **BACKLOG P2 items** (consolidated into this phase):
   - Refactor `slotCount` duplication between `validate.ts` and `index.ts` (return computed values from validator)
   - Preserve original-cased participant name on auto-join (store original name in localStorage alongside UUID)
   - Surface `joinAs` errors to user (toast or inline error)
7. **Update Firestore rules** to allow `ownerEmail` on event update
8. **Update PRODUCTION.md** to reflect P2 completion

## 3. P2 out of scope (deferred to later phases)

- Mobile/touch drag (P3)
- Undo/redo (P3)
- Best-slot ranking + .ics export (P4)
- 3-state painting (P5)
- Email magic-link return-edit (Beyond launch — magic-link concept already deferred)
- Cross-browser identity recovery without Google sign-in (Beyond launch)
- Edit/rename your participant doc after first creation (Beyond launch — minor, keeps scope tight)

---

## 4. Data-model changes

### Event document additions
- `ownerEmail?: string` — set when the host signs in with Google. Optional, missing for anonymous-owner events.

### Participant document — no changes
- `name` continues to store the trimmed-as-entered name (already correct since P1's `name.trim()` write — original casing preserved on the doc; the bug is only about which name the *client* passes back on auto-join).

### LocalStorage shape — minor change
- New shape: `{ [normalizedName: string]: { id: string; rawName: string } }`
- Old shape: `{ [normalizedName: string]: string }` (the value was just the UUID)
- Migration: on read, if value is a string, treat as `{ id: value, rawName: <unknown — fall back to normalizedName> }`. Lazy-migrate on next write. No version bump needed.

---

## 5. Components & files

### New files
- `src/lib/timezoneSlots.ts` — pure functions: `slotMomentInUTC(event, slotIdx)`, `formatSlotDateLabel(event, slotIdx, viewerTz)`, `formatSlotTimeLabel(event, slotIdx, viewerTz)`. TDD'd.
- `src/components/TimezonePicker.tsx` — small dropdown component used by the event page header to override viewer TZ.
- `src/components/SignInButton.tsx` — Google sign-in pill for hosts (handles `linkWithPopup` + fallback + sign-out).

### Modified files
- `src/components/AvailabilityGrid.tsx` — uses the new `timezoneSlots` helpers for column/row labels
- `src/pages/EventPage.tsx` — adds `<TimezonePicker>` and `<SignInButton>` to header
- `src/services/eventService.ts` — `EventDoc` gains optional `ownerEmail`
- `src/services/participantService.ts` — preserves rawName on auto-join (BACKLOG fix)
- `src/lib/participantId.ts` — handles new value shape `{id, rawName}`
- `src/__tests__/participantId.test.ts` — extended for new shape
- `src/stores/authStore.ts` — adds `signInWithGoogle()` action (link or sign-in fallback)
- `src/pages/EventPage.tsx` — handleJoin error surfacing
- `src/components/NamePrompt.tsx` — accepts an optional `error` prop to display
- `firestore.rules` — allow `ownerEmail` field on event update
- `functions/src/lib/validate.ts` — return `{ slotsPerDay, slotCount }` (BACKLOG fix)
- `functions/src/index.ts` — use returned values instead of recomputing (BACKLOG fix)
- `functions/src/__tests__/validate.test.ts` — assert returned values

---

## 6. Order of execution

Three sub-phases, each cleanly committable:

**P2-A: BACKLOG fixes.** Smallest scope, lowest risk, builds confidence. Five small commits.

**P2-B: Per-TZ display.** Core P2 goal. New `timezoneSlots.ts` lib (TDD), grid label updates, TZ picker. Larger but contained.

**P2-C: Google sign-in for host.** Smallest user-visible UI change. Requires Firebase console step (enable Google provider) — will halt and ask user if not enabled.

If P2-C is blocked at console-step, P2-A + P2-B still ship cleanly as `phase-2-partial` and the rest can land when the user is back.

---

## 7. Acceptance criteria (P2 done-when)

1. Host in TZ-A creates event; participant in TZ-B opens link; both see column dates and row times in their **own** TZ.
2. A slot painted by participant B at "Tuesday 9 AM TZ-B" shows in host A's grid at whatever the equivalent moment is in TZ-A (e.g., "Monday 8 PM TZ-A" if 13 hours behind).
3. DST-boundary slots render correctly across spring-forward and fall-back transitions (verified by unit tests).
4. Host clicks "Sign in" → Google popup → after success, the badge updates; refresh on a different device with the same Google account preserves event ownership.
5. Switching TZ in the dropdown re-renders the grid headers without reloading; bitmap data is unchanged.
6. All existing tests pass plus new TZ tests.
