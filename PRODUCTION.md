# PRODUCTION.md

## Project: **MeetGrid** (working title) — A Modern When2Meet Successor

A lightweight group availability scheduling web app. Same core purpose as When2Meet — find the best meeting time for a group by overlaying everyone's free/busy windows on a grid — but with a cleaner UI, modern interactions, and quality-of-life features that When2Meet has never added (mobile-friendly drag, time zones per participant, calendar sync, exportable results, shareable links, and live updates).

---

## 1. Goals & Non-Goals

### Goals
- Match When2Meet's core flow in <30 seconds: create event → share link → participants paint availability → host sees overlap.
- Eliminate When2Meet's biggest friction points (see §2).
- Stay **fully serverless on Firebase** to keep ops cost near zero and latency low.
- Mobile-first: usable one-handed on a phone.
- Real-time: when one participant updates, everyone viewing the page sees it within ~1s.

### Non-Goals (v1)
- No paid tier, no accounts required for participants (anonymous-by-name like When2Meet).
- No AI-driven scheduling suggestions beyond simple "best slot" highlighting.
- No native mobile apps — PWA only.
- No team/org management, no recurring meetings, no calendar booking on behalf of users.

---

## 2. What We're Improving Over When2Meet

| Pain point in When2Meet | MeetGrid fix |
|---|---|
| Drag-to-paint is buggy on mobile (touch events fight scroll) | Dedicated touch handler with explicit "paint mode" toggle, haptic feedback on supported devices |
| No per-participant time zones — single TZ for whole event | Each participant sees the grid in **their own** TZ; host sees overlap correctly across zones |
| No way to edit availability after submitting without re-finding the link | Optional magic-link email/login to return; localStorage fallback for anonymous users |
| Visual density poor — colors hard to read with >10 people | Configurable heatmap palette, accessible high-contrast mode, hover tooltips with names |
| No "best time" surfacing — host has to eyeball the grid | Auto-rank top 3 slots by participant count + duration, pinned at top of host view |
| No export | Export "best slot" to .ics, Google Calendar quick-add, copy-as-text |
| No live collaboration feedback | Real-time avatars showing who's currently editing |
| No way to mark "if-need-be" availability | Three-state painting: Available / If needed / Unavailable |
| Ads & dated UI | Clean, ad-free, modern design system |
| No undo | Undo/redo stack on the grid |

---

## 3. Architecture Overview

**Stack: 100% Firebase serverless.**

```
┌─────────────────────────────────────────────────────────────┐
│  Client (React + TypeScript + Vite, deployed as static SPA) │
│  - Tailwind CSS, shadcn/ui                                  │
│  - Firestore SDK (real-time listeners)                      │
│  - Firebase Auth (anonymous + optional Google/email link)   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Firebase Hosting (static SPA + PWA assets, global CDN)     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Firestore (primary data store, real-time)                  │
│  - events/{eventId}                                         │
│  - events/{eventId}/participants/{participantId}            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloud Functions for Firebase (Node 20, on-demand)          │
│  - createEvent (generates short slug, validates input)      │
│  - sendMagicLink (optional, for return-edit feature)        │
│  - generateIcs (.ics export for best slot)                  │
│  - cleanupExpiredEvents (scheduled, daily)                  │
└─────────────────────────────────────────────────────────────┘
```

### Why this fits serverless

- **Reads/writes are tiny**: each availability cell is a boolean (or 2 bits for 3-state). A typical event with 10 participants × 7 days × 48 half-hour slots = 3,360 cells total. Trivial for Firestore.
- **Real-time is native**: Firestore's `onSnapshot` replaces the need for WebSocket infrastructure.
- **Traffic is bursty and short-lived**: an event lives ~1 week and gets ~10–50 participants. Cloud Functions cold starts are acceptable for the few non-realtime endpoints.
- **No heavy compute**: best-slot ranking is O(slots × participants) and runs client-side.

### When this would NOT be enough (and what we'd add)

You asked when this would need more than serverless. Honest answer:

- **If we add Google/Outlook calendar two-way sync** with thousands of users — webhook delivery, token refresh, and rate-limit handling get painful in Functions. We'd want a small Cloud Run service with a job queue (Pub/Sub + a worker).
- **If we add ML-based "smart suggestions"** (e.g., predicting best times from historical data) — we'd want Vertex AI or a Cloud Run inference endpoint.
- **If we exceed ~10k concurrent listeners on a single event** (unlikely for this use case) — Firestore's per-document write contention would force us to shard the availability doc.

For v1 and v2 as scoped here, **plain Firebase is sufficient**. No dedicated backend needed.

---

## 4. Data Model (Firestore)

```
events/{eventId}
  ├── name: string
  ├── createdAt: Timestamp
  ├── expiresAt: Timestamp        // createdAt + 90 days
  ├── ownerUid: string | null     // null for anonymous-created events
  ├── mode: "specific_dates" | "days_of_week"
  ├── dates: string[]             // ISO dates or weekday names
  ├── timeRange: { start: number, end: number }  // hours, 0-24
  ├── slotMinutes: 15 | 30 | 60
  ├── timezone: string            // event default TZ (IANA)
  ├── allowIfNeeded: boolean      // enable 3-state painting
  └── settings: { ... }

events/{eventId}/participants/{participantId}
  ├── name: string
  ├── uid: string | null          // null = anonymous
  ├── timezone: string            // participant's local TZ
  ├── availability: string        // packed bitmap (base64), see below
  ├── lastUpdated: Timestamp
  └── editToken: string           // random, allows return-edit without auth
```

**Availability encoding**: pack the slots into a bitmap. With 3-state, each slot is 2 bits. For a 7-day × 12-hour × 30-min event = 168 slots × 2 bits = 336 bits = 42 bytes, base64 → ~56 chars. Keeps the doc tiny and lets us send the whole availability in one write.

---

## 5. Security Rules (Firestore)

Rough shape:

```
match /events/{eventId} {
  allow read: if true;  // events are public-by-link
  allow create: if request.resource.data.size() < 50000
                && request.resource.data.name is string;
  allow update: if request.auth.uid == resource.data.ownerUid;
  allow delete: if request.auth.uid == resource.data.ownerUid;

  match /participants/{participantId} {
    allow read: if true;
    allow create: if request.resource.data.name is string
                  && request.resource.data.name.size() < 80;
    // Participants can update their own row by knowing the editToken
    // (validated in a Cloud Function that proxies the write, OR
    //  by storing editToken hash and checking in rules via custom claims)
    allow update: if request.auth.uid == resource.data.uid
                  || /* editToken match logic */;
  }
}
```

Editing as an anonymous participant is the trickiest piece. Two viable options:

1. **Sign in anonymously on first visit.** Firebase Auth gives a stable UID stored in IndexedDB. Use that UID as the participant doc owner. Simple, no Cloud Function needed.
2. **Edit token.** Generate a random token at creation, return it to the client, store hash on the doc. Updates go through a Cloud Function that verifies the token.

**Recommendation: option 1.** Anonymous auth is the canonical Firebase pattern for this and avoids a Function on the hot path.

**Decision (locked during implementation planning):**
- **Participants** stay anonymous. `signInAnonymously()` runs invisibly on first visit; the resulting UID owns the participant doc and persists in IndexedDB, so returning to the same device "just works."
- **Hosts** start anonymous too, but can upgrade to Google via `linkWithPopup` from their event view. The same UID is preserved through the link, so events created while anonymous remain owned after sign-in. This gives hosts cross-device access without forcing every participant to authenticate.
- The magic-link option is deferred to post-launch.

---

## 6. Frontend

- **Framework**: React 18 + TypeScript + Vite.
- **Styling**: Tailwind CSS + shadcn/ui for primitives.
- **State**: Zustand for UI state, Firestore listeners for server state. No Redux.
- **Routing**: React Router.
- **PWA**: `vite-plugin-pwa` for offline shell + installability.
- **Drag-paint engine**: custom hook handling pointer events (works for mouse, touch, pen). Track a "paint origin" cell and the cell currently under the pointer; fill the rectangle between them on pointer-up.
- **Time zone handling**: `date-fns-tz` or `Temporal` polyfill. Render the grid in the participant's TZ; convert to a canonical UTC slot index before writing.
- **Accessibility**: full keyboard nav (arrow keys + space to toggle), ARIA grid semantics, prefers-reduced-motion, prefers-contrast.

---

## 7. Key UX Flows

> The flows below describe the final post-launch state. Capabilities land progressively across phases — see §12 for the delivery schedule (e.g., per-participant TZ in P2, 3-state "if needed" in P5).

**Host creates event**
1. Lands on `/`. Picks dates (calendar) or weekdays. Picks time range. Picks slot size. Names the event. Submits.
2. Cloud Function `createEvent` generates a 6-char slug, writes the doc, returns the URL.
3. Host is redirected to `/e/{slug}` and prompted to enter their name.

**Participant joins**
1. Opens `/e/{slug}`. Enters name. (Anonymous auth runs in background.)
2. Sees the grid in their local TZ. Paints availability. Writes are debounced (300ms) and pushed as bitmap updates.
3. Sees other participants' aggregate heatmap update live.

**Host views results**
1. "Best times" panel pinned at top: top 3 slots ranked by (count desc, duration desc, earliness asc).
2. Hover any cell to see who's available / unavailable / if-needed.
3. Export: copy text, download .ics, "Add to Google Calendar" link.

---

## 8. Cloud Functions (the only server-side code)

| Function | Trigger | Purpose |
|---|---|---|
| `createEvent` | HTTPS callable | Validate input, mint short slug (with collision retry), write event doc |
| `sendMagicLink` | HTTPS callable | Email a return-edit link (deferred to post-launch — see §12 "Beyond Phase 5") |
| `generateIcs` | HTTPS request | Return a `.ics` file for a chosen slot |
| `cleanupExpiredEvents` | Pub/Sub schedule (daily) | Delete events past `expiresAt` |

All written in TypeScript, deployed via `firebase deploy --only functions`.

---

## 9. Hosting & Deployment

- **Firebase Hosting** for the SPA. Single-page rewrite to `/index.html`. Long cache for hashed assets, no-cache for `index.html`.
- **Preview channels** for PR builds (`firebase hosting:channel:deploy pr-123`).
- **CI**: GitHub Actions. On push to `main`: lint → typecheck → test → build → deploy.
- **Environments**: `dev` and `prod` Firebase projects, separated by `.firebaserc` aliases.

---

## 10. Observability

- **Firebase Performance Monitoring** for client-side perf (TTI, custom traces around grid render and write latency).
- **Cloud Logging** for Functions (default).
- **Sentry** for client errors (free tier).
- **Custom event analytics** via Firebase Analytics: event_created, participant_joined, availability_saved, best_slot_exported. No PII.

---

## 11. Cost Estimate (rough)

Assumptions: 1k events/month, avg 8 participants, avg 5 paint sessions per participant.

| Service | Usage | Cost |
|---|---|---|
| Firestore reads | ~500k/mo | ~$0.18 |
| Firestore writes | ~80k/mo | ~$0.14 |
| Firestore storage | <1 GB | ~$0.18 |
| Cloud Functions invocations | ~5k/mo | free tier |
| Hosting bandwidth | ~10 GB/mo | free tier |
| **Total** | | **<$1/mo** |

Comfortably within Firebase's Spark (free) tier for early traffic; scales linearly and predictably.

---

## 12. Implementation Phases

The roadmap below replaces the earlier v1/v2/v3/v4 framing with shippable, demoable phases. Each phase ends with a deploy to a Firebase Hosting preview channel (`phase-N`), the four-item phase checklist passing (see §13), and a squash-merge to `main`. `main` is always deployable.

Total target: **~5 weeks solo** to reach the Phase 5 / "polished launch" bar.

### Phase 0 — Foundation (~1–2 days)

**Goal:** A "hello world" deploys, anonymous auth resolves on visit, CI is green.

**In scope:**
- Lift the Vite + React 18 + TypeScript + Tailwind + ESLint scaffold from `D:\web-project\survey-builder\` as a starting template (swap RTDB calls for Firestore — different SDK methods, different rules dialect).
- Provision two Firebase projects (`schedule2gather-dev`, `schedule2gather-prod`); wire up `.firebaserc` aliases.
- Initialize Firestore, Auth (anonymous), Functions, Hosting.
- Install Zustand and shadcn/ui base; configure `@/*` path alias.
- Folder structure: `src/lib`, `src/stores`, `src/services`, `src/pages`, `src/components`.
- Baseline Firestore security rules (deny-by-default scaffold; locked down with emulator tests in P5).
- Firebase emulator suite installed and runnable via `npm run emulators`.
- Vitest installed.
- GitHub Actions CI: lint → typecheck → build → deploy to preview channel on push.

**Out of scope:** All app features.

**Done when:** Visiting the deployed preview URL signs you in anonymously (UID visible in console), the placeholder page renders, CI is green.

### Phase 1 — Core loop (~1 week)

**Goal:** Single-TZ, 2-state, desktop-only end-to-end working app.

**In scope:**
- Event creation form (specific dates *or* days-of-week mode; time range; slot size; name).
- `createEvent` Cloud Function (validate input, mint 6-char slug with collision retry, write doc).
- `/e/{slug}` landing → name prompt → grid renders.
- Desktop drag-paint engine (mouse only, 2-state Available / Unavailable).
- Bitmap encode/decode with **unit tests**.
- Per-paint-stroke debounced write (commit on pointer-up).
- `onSnapshot` aggregate heatmap that updates live.
- Cell-hover tooltip showing names available at that slot.
- Zustand stores for event/builder state; `eventService` and `participantService` analogs to `survey-builder`'s service layer.

**Out of scope:** Per-participant TZ, mobile/touch, undo/redo, best-slot ranking, export, Google sign-in, 3-state, PWA, accessibility polish.

**Done when:** Two desktop browsers, two participants — both paint, both see the live aggregate update.

### Phase 2 — Real users, real zones (~1 week)

**Goal:** Per-participant TZ rendering and host upgrade-to-Google.

**In scope:**
- Canonical UTC slot-index data model; `date-fns-tz` for conversions at the render/write boundary.
- Viewer's grid renders in their TZ; writes round-trip correctly across zones.
- DST-boundary unit tests (spring forward, fall back, southern hemisphere).
- Host can `linkWithPopup` (Google) from the event view; UID is preserved so existing event ownership survives the upgrade.
- "Sign in" button surfaced only on host's view.

**Out of scope:** Mobile/touch, undo/redo, ranking, export, 3-state, PWA, a11y polish.

**Done when:** Host in TZ-A, participant in TZ-B — painting in B's local hours yields an aggregate that A sees correctly. Host signs in with Google → still owns event; switching devices works.

### Phase 3 — Make it usable (~1 week)

**Goal:** Mobile-first painting and power-user productivity.

**In scope:**
- Pointer Events API for unified mouse/touch/pen handling.
- Explicit "paint mode" toggle button to prevent touch-vs-scroll conflict.
- Haptic feedback (`navigator.vibrate`) where supported.
- Undo/redo stack on the grid (in-memory only; not persisted).
- Keyboard navigation (arrow keys + space) and proper ARIA grid semantics.
- 300 ms write debounce.

**Out of scope:** Best-slot ranking, export, 3-state, PWA, observability.

**Done when:** Phone-only smoke test passes (paint smoothly with thumb, undo works, page scrolls when paint mode is off). Keyboard-only smoke test passes.

### Phase 4 — Make it shareable (~3–4 days)

**Goal:** Host can act on the results.

**In scope:**
- Best-slot ranking pinned panel for host (top 3 by count desc, duration desc, earliness asc) with **unit tests**.
- Per-cell hover detail expanded to show available / unavailable lists.
- `generateIcs` Cloud Function (HTTPS, returns `.ics` for chosen slot).
- Client-side Google Calendar quick-add URL generator.
- "Copy as text" button for sharing the chosen slot.

**Out of scope:** 3-state, accessibility palette work, PWA.

**Done when:** Fixture data ranks correctly. Downloaded `.ics` opens in Calendar.app/Outlook. GCal quick-add URL prefills correctly.

### Phase 5 — Make it polished (~1 week)

**Goal:** Production quality bar.

**In scope:**
- **3-state painting** (Available / If needed / Unavailable). Bitmap moves from 1 bit to 2 bits per slot. Lazy migration on first read of each event doc.
- **Accessible high-contrast palette** mode, toggleable in settings; grayscale becomes the high-contrast option (color-first remains the default — locks in §13's previous "color-first" question).
- **PWA install** via `vite-plugin-pwa` (manifest + service-worker offline shell).
- **Firestore security rules** locked down, with an emulator-based test suite asserting deny-by-default for unauthorized writes.
- **Sentry** client error tracking.
- **Firebase Analytics** custom events: `event_created`, `participant_joined`, `availability_saved`, `best_slot_exported`.
- **`cleanupExpiredEvents`** scheduled Cloud Function (daily Pub/Sub) to delete events past `expiresAt`.
- **Participant cap of 100** enforced in `createEvent` and Firestore rules (locks in §13's previous "hard cap" question).
- Custom domain pointed at Hosting (if domain decided — see §14).

**Done when:** Lighthouse PWA install criteria met. Security-rule emulator tests green. Production deploy live.

### Beyond Phase 5 (out of scope for the launch)

The original spec listed v3/v4 ambitions that remain valuable but are explicitly out of scope here:
- Magic-link return-edit for participants/hosts.
- Live editor avatars (showing who's currently painting).
- Optional Google Calendar one-way overlay ("show my busy times").
- Per-slot comments.
- Saved templates ("recurring poker night").
- Two-way calendar sync (would require Cloud Run + Pub/Sub — see §3 "When this would NOT be enough").
- Smart suggestions from historical group data (Vertex AI).

These live in `BACKLOG.md` under the heading "Beyond launch."

---

## 13. Implementation Discipline

### Branching & merging
- One branch per phase: `phase/0-foundation`, `phase/1-core-loop`, …
- Phase branches deploy to a named Hosting preview channel (`phase-N`).
- `main` is always deployable; merges to `main` only after the phase checklist passes.
- Squash-merge so each phase is a single commit on `main` (clean history; trivial to revert a phase).

### Phase checklist (every phase)
1. **Deploys cleanly** to a preview channel.
2. **Demoable end-to-end** on the deployed URL without dev tools open.
3. **Tests pass** for whatever the phase added.
4. **`BACKLOG.md` updated** with anything that felt essential but wasn't in scope.

### Backlog discipline
- Single `BACKLOG.md` at repo root, sectioned by target phase (P1, P2, …, "Beyond launch").
- During a phase: out-of-scope work goes to `BACKLOG.md` immediately, **not done now**.
- Reviewed at the start of each phase — items still relevant get added to that phase's "In scope"; stale ones drop.

### Testing approach (locked decision)
- **Pure logic gets unit tests** (Vitest): bitmap pack/unpack, TZ conversion, best-slot ranking.
- **Security rules get emulator-based tests** in P5.
- **UI is verified manually** in the browser per phase. Playwright is not in scope for the launch.
- Trade-off: relaxed security rules between P0 and P5 mean a rules bug wouldn't be caught by CI in those phases. Acceptable because nothing is on a public domain until P5.

### Bitmap migration (P5)
- P1–P4 store 1 bit per slot. P5 expands to 2 bits per slot (3-state).
- Lazy migration: on first read in P5, expand `b` → `b ? 0b01 : 0b00`. Old events stay 1-bit until touched. Avoids a big-bang migration script.

### Observability rollout
- P0: Cloud Functions logs (default).
- P5: Sentry, Firebase Analytics, Performance Monitoring traces around grid render and write latency.
- Reasoning: pre-launch error volume is meaningless and adds triage noise.

---

## 14. Open Questions

- **Domain name** — to be decided before P5. Until then, the Hosting default URL (`schedule2gather-prod.web.app` or similar) is the production URL.

(Earlier open questions on auth approach, heatmap palette default, and participant cap were resolved during implementation planning — see §5 for auth, §12 P5 for palette and cap.)
