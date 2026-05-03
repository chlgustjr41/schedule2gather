# Phase 1 — Core Loop Design

**Status:** Approved 2026-05-03 via brainstorming session.

**Goal:** Single-TZ, 2-state, desktop-only end-to-end working app. After P1, two desktop browsers can each create + join an event and see each other's painted availability live.

**Reference:** PRODUCTION.md §12 Phase 1. This document fleshes out the implementation details left ambiguous in the high-level spec.

---

## 1. Decisions locked during brainstorming

| Question | Decision | Rationale |
|---|---|---|
| Event modes in P1 | Both: specific-dates AND days-of-week | Spec-faithful; days-of-week is core When2Meet UX |
| Days-of-week semantics | Two sub-variants: "Recurring (no dates)" and "Within date range" | Recurring matches When2Meet's classic behavior; Within range gives concrete dates that survive P2 cross-TZ |
| Participant identity | Client UUID per (event, name); anon Firebase UID for security | Multi-person-per-device works; UID still authorizes writes |
| Cloud Functions setup | Node 20, TypeScript, gen 2, region `us-central1` (matches Firestore region) | Co-located with Firestore (avoids 50–150 ms cross-region overhead) |
| Drag-paint mechanics | Rect fill, single-click toggles, paint-by-example (start cell determines on/off), commit on pointer-up | Matches When2Meet behavior; one Firestore write per stroke |
| Slug minting | 6 chars from `abcdefghijkmnpqrstuvwxyz23456789` (32 look-alike-free chars), retry ≤5× on collision | ~1B combos; readable aloud |
| Bitmap encoding | 1 bit per slot, MSB-first within byte, base64 wire format | Tight; 168-slot event = 21 bytes payload |

---

## 2. Data model

### Event document — `events/{slug}`
```ts
{
  name: string,
  createdAt: Timestamp,
  expiresAt: Timestamp,           // createdAt + 90 days; cleanup function lands in P5
  ownerUid: string,               // anon Firebase UID of host
  mode: "specific_dates" | "weekdays_in_range" | "weekdays_recurring",
  dates: string[],                // ISO dates ("2026-05-05") for specific_dates and weekdays_in_range; weekday names ("mon","tue","wed","thu","fri","sat","sun") for weekdays_recurring
  timeRange: { start: number, end: number },  // hours, 0–24, end exclusive
  slotMinutes: 15 | 30 | 60,
  timezone: string,               // event TZ, IANA (e.g., "America/New_York")
  slotCount: number               // computed at create time: dates.length * slotsPerDay; stored for sanity-checking later writes
}
```

The `eventId` is the slug (6 chars). No separate `slug` field needed.

### Participant document — `events/{slug}/participants/{participantId}`
```ts
{
  participantId: string,          // client-generated UUID (also the doc ID)
  name: string,                   // raw display name (preserves casing/whitespace as entered)
  uid: string,                    // anon Firebase UID — used by security rules to authorize updates
  availability: string,           // base64-encoded bitmap, length-prefixed-implicit (caller knows slotCount from parent event)
  lastUpdated: Timestamp
}
```

The `participantId` (doc ID) is the UUID, not the UID. The `uid` field is the security context.

### Bitmap layout
- 1 bit per slot in P1 (expands to 2 bits per slot in P5; P5 lazy-migrates).
- **Flat row-major:** `slotIndex = dateIndex * slotsPerDay + timeIndex`.
- **Bit ordering within byte:** MSB-first. Bit `i` is at `byte[Math.floor(i/8)]`, position `7 - (i % 8)`.
- **Wire format:** `base64(Uint8Array)`. The number of bytes is `Math.ceil(slotCount / 8)`. Trailing pad bits are 0.
- **Pure functions** (in `src/lib/bitmap.ts`):
  - `pack(bits: boolean[]): string`
  - `unpack(encoded: string, length: number): boolean[]`
  - `getBit(encoded: string, idx: number): boolean`
  - `setBit(encoded: string, idx: number, value: boolean, length: number): string`
  - `setRectangle(bits: boolean[], fromIdx: number, toIdx: number, value: boolean, slotsPerDay: number): boolean[]`
- All TDD'd with edge cases: length 1, 8, 9, 63, 64, 8000; setRectangle for single cell, horizontal line, vertical line, full grid, off-by-one wraparound prevention.

### LocalStorage shape
- Key: `mg:event:{slug}:participants`
- Value (JSON): `{ [normalizedName: string]: participantId }`
- `normalizedName = name.trim().toLowerCase()` (so "Alice" and "alice " return the same UUID; safe-guards against accidental separate identities)

---

## 3. URL routing & user flows

### Routes
- `/` — landing + create-event form
- `/e/{slug}` — event page (host and participants share the same component; host gets a small "you are the host" indicator if `auth.uid === event.ownerUid`)
- `*` (any unknown path) — redirect to `/`

### Host create flow
1. Visit `/`, see `<CreateEventForm>` with two tabs: **Specific dates** | **Days of week**
2. Common fields: event name, time range (start hour 0–23, end hour 1–24, end > start), slot size (15/30/60 min), event timezone (defaults to browser's IANA TZ via `Intl.DateTimeFormat().resolvedOptions().timeZone`; host can override)
3. **Specific dates** tab: calendar multi-pick (uses `react-day-picker`)
4. **Days of week** tab: weekday checkboxes + sub-toggle:
   - **Recurring** (default) → `mode: "weekdays_recurring"`, `dates: ["mon","wed",...]`
   - **Within date range** → date-range picker → expand to concrete dates client-side → `mode: "weekdays_in_range"`, `dates: ["2026-05-05",...]`
5. Submit → calls `createEvent` Cloud Function (HTTPS callable)
6. On success → redirect to `/e/{slug}`; name prompt overlay appears (host is also a participant)

### Anyone joins flow
1. Open `/e/{slug}`; P0's auth listener has already signed them in anonymously
2. Fetch event doc; if 404 or `expiresAt < now` → render `<EventNotFound>`
3. Read localStorage `mg:event:{slug}:participants`:
   - **Single entry** (one prior name on this browser for this event) → auto-load that participant doc, no prompt
   - **Multiple entries** (multi-identity case) → render `<NamePrompt>` with a hint listing the prior names; on submit, if the entered (normalized) name matches an existing entry, load that participant; otherwise create a new one
   - **No entries** → render `<NamePrompt>`; on submit, generate UUID via `nanoid`, write to localStorage, create participant doc with empty availability
4. Subscribe to `events/{slug}/participants` collection via `onSnapshot` (real-time)
5. Render `<AvailabilityGrid>` in event TZ; user paints; pointer-up → encode bitmap → `setDoc` to own participant doc with `merge: true` on `{availability, lastUpdated}`
6. All viewers (including the painter) see the aggregate update via the same `onSnapshot` subscription

### Empty states
- Event has no participants yet (host hasn't painted): heatmap renders fully empty with "Be the first to paint!" overlay, dismisses on first user paint
- Participant joined but hasn't painted: their entry shows in the participants legend with 0 painted slots

---

## 4. Cloud Function: `createEvent`

- **Trigger:** HTTPS callable, gen 2, Node 20, TS, region `us-central1`
- **Auth requirement:** caller must be authenticated (anonymous is fine); reject otherwise

**Input shape** (validated server-side):
```ts
{
  name: string,                                           // 1–80 chars after trim
  mode: "specific_dates" | "weekdays_in_range" | "weekdays_recurring",
  dates: string[],                                        // 1–60 entries; format depends on mode
  timeRange: { start: number, end: number },              // integers, 0 ≤ start < end ≤ 24
  slotMinutes: 15 | 30 | 60,
  timezone: string                                        // valid IANA — validated by attempting `new Intl.DateTimeFormat(undefined, { timeZone })`
}
```

**Server-side logic:**
1. Validate input (throw `HttpsError("invalid-argument")` on failure)
2. Compute `slotsPerDay = (end - start) * (60 / slotMinutes)` and `slotCount = dates.length * slotsPerDay`
3. Reject if `slotCount > 5000` (sanity cap; P5's 100-participant cap times this stays well within Firestore doc-size limits)
4. Mint slug: try `nanoid(6)` from custom alphabet; check `events/{slug}` existence via `getDoc`; retry up to 5×; throw `HttpsError("internal")` if all collide (essentially impossible)
5. Compute `expiresAt = now + 90d`
6. Write event doc with `ownerUid = context.auth.uid`
7. Return `{ slug }`

**Why a Function:**
- Slug uniqueness check + retry can't be raced safely from clients
- `expiresAt` and `ownerUid` should not be client-controlled
- Defense-in-depth validation (security rules block create entirely; only the Function writes events)

**Why no Function for participant writes:**
- Single doc write; no cross-doc consistency needed
- Security rules enforce `uid` match on update
- Keeps the paint loop snappy (no Function cold-start)

---

## 5. Security rules update

Replace P0's permissive baseline (`allow read, write: if request.auth != null`) with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /events/{eventId} {
      allow read: if true;                                  // public-by-link
      allow create: if false;                               // only `createEvent` Function writes events (uses Admin SDK, bypasses rules)
      allow update, delete: if request.auth.uid == resource.data.ownerUid;

      match /participants/{participantId} {
        allow read: if true;
        allow create: if request.auth != null
                      && request.resource.data.uid == request.auth.uid
                      && request.resource.data.name is string
                      && request.resource.data.name.size() > 0
                      && request.resource.data.name.size() < 80;
        allow update: if request.auth.uid == resource.data.uid;
        allow delete: if request.auth.uid == resource.data.uid;
      }
    }
  }
}
```

P5 will replace this entirely with emulator-tested rules. P1's rules are not formally tested; they ship with manual smoke-testing only (per the PRODUCTION.md §13 testing trade-off).

---

## 6. State management

Two Zustand stores. Separation: server-backed state vs ephemeral UI state.

### `eventStore` (`src/stores/eventStore.ts`)
- State: `{ event, myParticipant, participants, loading, error }`
- Actions:
  - `loadEvent(slug)` — subscribes to event doc and participants collection; sets unsubscribe handles for cleanup
  - `joinAs(name)` — generates UUID via `participantId.getOrCreateParticipantId`, creates participant doc, sets `myParticipant`
  - `updateMyAvailability(bitmap: string)` — writes `{ availability, lastUpdated }` to own participant doc
  - `unsubscribe()` — tears down all listeners (called on route exit)

### `paintStore` (`src/stores/paintStore.ts`)
- State: `{ origin: number | null, current: number | null, draftBits: boolean[] | null, mode: "on" | "off" | null }`
- Actions:
  - `startPaint(slotIdx, currentBits)` — captures origin, derives `mode` (opposite of current cell's state), sets `draftBits = currentBits`
  - `dragTo(slotIdx, slotsPerDay)` — recomputes `draftBits` by applying `setRectangle(currentCommittedBits, origin, slotIdx, mode === "on", slotsPerDay)`
  - `commitPaint()` — returns final `draftBits`; clears state

### Store interaction pattern
- `<AvailabilityGrid>` reads committed `myParticipant.availability` from `eventStore` and `draftBits` from `paintStore`
- Renders `draftBits` if present (drag in progress), else committed bits
- On `pointerup`: calls `paintStore.commitPaint()` → encodes via `bitmap.pack` → calls `eventStore.updateMyAvailability(encoded)`

---

## 7. Component map & file layout

### New files in `src/`
```
src/
├── App.tsx                          (modify: add React Router; routes for /, /e/:slug, fallback)
├── pages/
│   ├── LandingPage.tsx              (hosts <CreateEventForm>)
│   └── EventPage.tsx                (orchestrates <NamePrompt> + <AvailabilityGrid> + <EventNotFound>)
├── components/
│   ├── CreateEventForm.tsx          (tabs, fields, calls eventService.createEvent)
│   ├── NamePrompt.tsx               (modal for first-visit name entry)
│   ├── AvailabilityGrid.tsx         (grid + drag-paint pointer events + heatmap render)
│   ├── CellTooltip.tsx              (hover-only tooltip listing names)
│   ├── EventNotFound.tsx            (404 view)
│   └── HostBadge.tsx                (small "you are the host" indicator)
├── stores/
│   ├── eventStore.ts                (server state)
│   └── paintStore.ts                (paint UI state)
├── services/
│   ├── eventService.ts              (createEvent callable, subscribeToEvent)
│   └── participantService.ts        (subscribeToParticipants, upsertParticipant, getOrCreateParticipant)
└── lib/
    ├── bitmap.ts                    (pack/unpack/getBit/setBit/setRectangle — TDD'd)
    ├── slots.ts                     (slot index math — TDD'd)
    ├── participantId.ts             (localStorage UUID management — TDD'd)
    └── nameNormalize.ts             (TDD'd)
```

### New `functions/` directory
```
functions/
├── package.json                     (Node 20, TS, firebase-functions v6+, firebase-admin v12+, nanoid)
├── tsconfig.json
├── .gitignore
└── src/
    ├── index.ts                     (exports createEvent HTTPS callable)
    ├── lib/
    │   ├── slug.ts                  (mint + retry; TDD'd)
    │   └── validate.ts              (input validation; TDD'd)
    └── __tests__/
        ├── slug.test.ts
        └── validate.test.ts
```

### New tests in `src/__tests__/`
- `bitmap.test.ts`
- `slots.test.ts`
- `participantId.test.ts` (mocks `localStorage`)
- `nameNormalize.test.ts`

### New deps (root `package.json`)
- `react-router-dom@^7`
- `nanoid@^5`
- `react-day-picker@^9`
- `date-fns@^4`

(`functions/` has its own deps.)

---

## 8. Testing strategy

Per the locked P0 decision (PRODUCTION.md §13):

| Surface | Approach |
|---|---|
| Pure logic (`bitmap`, `slots`, `participantId`, `nameNormalize`, `slug`, `validate`) | TDD with Vitest. Write failing test, implement, verify pass. Cover edges (length 1, 8, 9, 63, 64, 8000 for bitmap; 15/30/60 min and all 3 modes for slots). |
| UI components | Manual browser verification per the P1 done-criterion. No Playwright in P1. |
| Cloud Function | Unit tests for `slug` and `validate` lib modules. The Function handler itself is integration-tested manually via deployed callable. |
| Security rules | Manual smoke testing only in P1. Emulator-backed tests land in P5. |

---

## 9. Functions deployment & CI extension

- Root `package.json` `deploy` script updates: `firebase deploy --only hosting,firestore:rules,functions`
- `firebase-hosting-merge.yml` adds a `Functions build` step (`cd functions && npm ci && npm run build`) before the existing `Build` step
- The `FirebaseExtended/action-hosting-deploy@v0` step deploys hosting only. We add a **separate `Deploy Functions` step** after it, gated to push-to-main only:
  ```yaml
  - name: Deploy Functions
    if: github.ref_name == 'main'
    env:
      GOOGLE_APPLICATION_CREDENTIALS: ${{ runner.temp }}/sa.json
    run: |
      echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SCHEDULE2GATHER }}' > "$GOOGLE_APPLICATION_CREDENTIALS"
      npx firebase-tools deploy --only functions --project schedule2gather --non-interactive
  ```
- `firebase-hosting-pull-request.yml` stays as-is (PRs don't deploy functions — preview channels don't separate Function instances)

### **Manual one-time IAM setup** (the user must do this once before P1 CI can deploy Functions)

The `FIREBASE_SERVICE_ACCOUNT_SCHEDULE2GATHER` service account was provisioned by `firebase init hosting:github` with Hosting roles only. Functions deployment requires additional IAM roles on the same account:

1. Open `https://console.cloud.google.com/iam-admin/iam?project=schedule2gather`
2. Find the service account named `github-action-<numeric-id>@schedule2gather.iam.gserviceaccount.com` (created by `firebase init hosting:github` in P0)
3. Click the pencil icon → **Add another role**, add each of:
   - **Cloud Functions Admin** (`roles/cloudfunctions.admin`) — deploy/update/delete functions
   - **Service Account User** (`roles/iam.serviceAccountUser`) — let the SA act as the runtime service account for the deployed function
   - **Cloud Run Admin** (`roles/run.admin`) — gen-2 functions run on Cloud Run under the hood
   - **Artifact Registry Writer** (`roles/artifactregistry.writer`) — gen-2 functions push container images to Artifact Registry
4. Click **Save**

The first P1 push will deploy Functions successfully once these roles are in place. If skipped, the Deploy Functions step will fail with `permission denied`; the fix is the same four roles.

---

## 10. Edge cases handled in P1

- Slug collision (5× retry, then 500)
- Event not found OR expired (`expiresAt < now`) → 404 view
- Participant write rejected (rule failure, offline) → toast error, keep local optimistic bits, retry on next paint
- Empty event → "Be the first to paint!" overlay
- Browser refresh mid-drag → drag state lost (acceptable; in-memory only)
- Two browsers paint concurrently → no conflict (separate docs); both viewers see both updates via `onSnapshot`
- Host creating event then refreshing before naming themselves → no participant doc yet, name prompt re-appears on refresh

## 11. Explicit non-goals (deferred to BACKLOG)

| Item | Target phase |
|---|---|
| Per-participant TZ | P2 |
| Mobile/touch drag | P3 |
| Undo/redo | P3 |
| Best-slot ranking + .ics export | P4 |
| 3-state painting | P5 |
| Edit your own name after first entry | P2 (alongside Google sign-in) |
| Hard-delete event by host | P5 |
| Real-time "X is editing" presence | Beyond launch |
| Pagination of participants list | Hard cap of 100 in P5 |
| Rate limiting on `createEvent` | Beyond launch |
| Skip-name "view-only" mode for host | Defer; host = participant in P1 |
| Multiple-identity selector when localStorage has >1 name | P1 prompts as if new visit; auto-loads only when exactly one name exists |

---

## 12. Acceptance criteria (P1 done-when)

From PRODUCTION.md §12 P1, restated concretely:

1. Two desktop Chromium browsers (different profiles or incognito-vs-regular).
2. Browser A: visit `/`, fill form (any mode), submit, get redirected to `/e/{slug}`, prompted for name, enter "Alice".
3. Browser B: visit the same `/e/{slug}`, prompted for name, enter "Bob".
4. Both browsers paint different patterns. Pointer-up commits write to Firestore.
5. Both browsers see the live aggregate heatmap reflect both Alice and Bob's painted cells within ~1 second of any commit.
6. Cell hover shows the names available at that slot.
7. Refreshing either browser preserves the painter's name (auto-load via localStorage) and their committed bitmap (re-fetched from Firestore).
8. Lint, typecheck, and Vitest unit tests all pass; CI is green.
