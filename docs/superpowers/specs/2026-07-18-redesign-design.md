# schedule2gather Redesign — Design Spec

**Date:** 2026-07-18
**Status:** Approved by user (brainstorm session with visual companion)
**Scope:** Visual/UX overhaul + three quality-of-life features + formal documentation set, on top of the existing shipped codebase.

## 1. Context

schedule2gather is a live when2meet-successor (React 19 + Vite + Tailwind v4 + Firebase; Phases 0–3 shipped May 2026). This release keeps the codebase and backend, and delivers:

1. A ground-up **visual redesign** — "Warm & Friendly" direction with light and dark modes.
2. A restructured **create flow** and a dedicated **invitee join flow**.
3. Three new features: **best-times panel**, **export/add-to-calendar**, **live presence**.
4. A **formal documentation set** (architecture, design system, UX flows).

Explicitly out of scope: three-state "if needed" painting (avoids bitmap migration), product rename (name stays **schedule2gather**), any Firestore schema change, native apps, and the C-style dark/gradient aesthetic (rejected by user).

**Execution approach (chosen):** design-system-first — define tokens and shared primitives, then migrate screens onto them; new features are built directly in the new system.

## 2. Design System

### 2.1 Color tokens

Tokens are CSS custom properties declared in Tailwind v4 `@theme` in `src/index.css`. Dark mode reassigns the same custom properties under `[data-theme="dark"]`; components never use `dark:` variants.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F0E7D5` | `#2B2825` | Page canvas (deep beige / warm dark grey — never pure black) |
| `surface` | `#FFFDF7` | `#363230` | Cards, panels |
| `surface-raised` | `#FFFFFF` | `#403B37` | Inputs, popovers, segmented-control thumb |
| `line` | `#DFD3BB` | `#4A443E` | Borders, dividers |
| `ink` | `#3D3833` | `#F0EAE0` | Primary text |
| `ink-muted` | `#857A66` | `#B0A697` | Secondary text, labels |
| `primary` | `#E0653A` | `#F07B4F` | Buttons, wordmark accent, focus rings |
| `on-primary` | `#FFFFFF` | `#2A1006` | Text on primary |
| `danger` | `#C94F36` | `#E06A50` | Destructive actions |
| `success` | `#2F9E57` | `#58C277` | Confirmation, presence dots |
| `slot-empty` | `#FFFDF7` + 1px `line` border | `#3A3631` | Unselected grid slot. Light mode is warm-white so slots visibly stand out from the beige canvas (explicit user requirement). |

**Heatmap ramp** (attendance 0 → all): light `#FFFDF7(border) → #CDE8CF → #9FD8A6 → #63BF77 → #2F9E57`; dark `#3A3631 → #2F5A3C → #3C7A4F → #4EA265 → #63C87E`. With >4 participants, levels are bucketed by fraction of the max attendance. "My availability" painted cells use solid `#2F9E57` (light) / `#3F9459` (dark).

All ink-on-surface pairs must meet WCAG AA (4.5:1); exact heatmap values may be contrast-tuned during implementation but must keep this hue/ordering.

**Avatar palette:** warm hues assigned by name hash: `#D98E4A #7BA05B #6B5D52 #A3784F #C96F52 #8E9A5B`.

### 2.2 Typography, shape, elevation

- **Font:** Nunito, self-hosted via `@fontsource` (no render-blocking Google Fonts request). Weights 400/600/700/800.
- **Ramp:** display 28/800 · h2 19/700 · body 15/400 · small 12.5/400 · micro-label 10/800 uppercase +8% tracking.
- **Radii:** cards 20px · controls 12px · buttons and pills 999px · grid cells 5px.
- **Elevation:** light mode `0 2px 8px rgba(61,56,51,.06)` on surfaces, `0 4px 12px rgba(224,101,58,.30)` under primary buttons; dark mode uses borders instead of shadows.

### 2.3 Primitives (`src/components/ui/`)

`Button` (primary/secondary/ghost/danger × sm/md/lg), `Card`, `TextField`, `Chip`, `SegmentedControl`, `BottomSheet` (mobile; renders as centered modal ≥768px), `Toast`, `Avatar` (initials + optional presence dot), `ThemeToggle`. Each is a thin styled wrapper — no headless-UI dependency. Existing components migrate onto these; component-local color literals are removed.

### 2.4 Theme behavior

`themeStore` (Zustand): `light | dark | system`, persisted to localStorage, applied as `data-theme` on `<html>`. Default = system (`prefers-color-scheme`); `matchMedia` unavailable → light. Toggle lives in the page header (🌙/☀️).

## 3. Screens & UX Flows

### 3.1 Host: create flow ("two decisions + smart defaults")

Landing page = wordmark, one-line value prop, create card. The card asks only:

1. **Event name** (text field).
2. **Dates** (calendar; responsive single/dual month as currently implemented; past dates disabled).

Time range (default **9 AM–9 PM**) and time zone (auto-detected) collapse into one summary row — `⚙ 9 AM – 9 PM · Eastern ▾` — expanding inline on tap. One tap on **Create event** → event page with the existing share-link banner (restyled, with copy button). No sign-in required; Google sign-in for hosts remains available as today.

### 3.2 Invitee: join → paint

1. **Join screen** (new; replaces the name-prompt overlay): "You're invited to" + event title, date range, organizer name, avatar row of participants ("N people have painted their times"), one name field, **Join & paint my times** button, hint "No account needed. Come back with the same name to edit." Auto-rejoin via localStorage skips this screen entirely.
2. **Paint screen:** a `SegmentedControl` — **✏️ My times / 👥 Group** — governs the visible grid layer on mobile. "My times" shows the invitee's own binary availability (solid green paint); "Group" shows the heatmap. Painting interaction (drag paintbrush, paint-mode/scroll gating, undo/redo, autosave, haptics, keyboard nav + ARIA) is **retained from the current implementation and reskinned**, not rebuilt. Hint text: "Drag to paint · saves automatically."
3. On **Desktop (≥1024px)** the toggle disappears: My-times grid and Group heatmap render side by side (when2meet's familiar layout), with best times/participants/comments in a right sidebar.

### 3.3 Event page (both roles)

Header: wordmark, theme toggle, event title, date range, participant avatars (presence dots on those currently viewing). Then: **✨ Best times panel** → grid (existing week/month pagination) → paint bar → comments (existing, restyled). Timezone picker remains in the header area.

### 3.4 Best-times panel

Shows top 3 ranked windows, e.g. `Wed 7:00–8:30 PM · 6/6 · [Add to cal ⤓]`, updating live as availabilities change. Empty state (fewer than 2 participants with any painted slot): "Share the link — best times appear once 2+ people paint."

**Ranking algorithm** (`src/lib/bestSlots.ts`, pure): compute per-slot attendance counts; for each attendance level L from max downward, collect maximal same-day runs of consecutive slots with count ≥ L; score candidates by (L desc, duration desc, earlier start); greedily keep non-overlapping top 3. Displayed in the viewer's selected time zone.

### 3.5 Export ("Add to cal")

Tapping a best-time row opens a `BottomSheet` with three actions:

- **Download .ics** — RFC 5545 file generated client-side (`src/lib/ics.ts`), Blob download; UTC times derived from the event's slot UTC moments; SUMMARY = event name, DESCRIPTION includes attendee names and event link.
- **Google Calendar** — pre-filled `calendar.google.com/calendar/render?action=TEMPLATE&…` URL, new tab.
- **Copy summary** — clipboard text like `Pizza Night 🍕 — Wed Jul 22, 7:00–8:30 PM EDT (6/6 available): <link>`.

### 3.6 Live presence

Green dot on the avatar of each participant currently on the event page. Backed by Realtime Database (§4). No "currently painting" granularity in this release — presence = page open.

## 4. Architecture

**Unchanged:** Firestore data model (`events`, `participants`, `comments`), Cloud Functions (`createEvent`, `cleanupExpiredEvents`), security rules for Firestore, Hosting + GitHub Actions CI/CD, all stores/services not listed below. **Zero Firestore schema migration.**

**Additions:**

- **Firebase Realtime Database** (new service in the existing project) solely for presence:
  `/presence/{eventId}/{participantId} = { name: string, lastSeen: serverTimestamp }`.
  Client writes its node on event-page mount (only after joining — anonymous viewers are not tracked) and registers `onDisconnect().remove()`; RTDB rules allow public read per event and writes only to a `$participantId` node with valid shape (participant IDs are unguessable client UUIDs — same trust model as existing Firestore rules). A `presenceService.ts` wraps this; `firebase.ts` gains a `getDatabase` export. Setup: provision the RTDB instance once (console or `firebase init database`), add `VITE_FIREBASE_DATABASE_URL` to `.env`/`.env.example` and `databaseURL` to the config, and add the key to the CI build secrets.
  *Why RTDB, not Firestore:* native `onDisconnect` gives reliable cleanup when tabs close or phones lock; Firestore would need heartbeat writes plus TTL logic at real cost.
- **`src/lib/bestSlots.ts`** — pure ranking lib (§3.4), consumed via `useMemo` from the existing real-time participant subscription.
- **`src/lib/ics.ts`** — pure .ics/URL/text generation (§3.5). The old spec's `generateIcs` Cloud Function is dropped as unnecessary.
- **`themeStore.ts`** + design tokens (§2).

Degradation: presence failures are silent (feature hides); export clipboard failure falls back to a select-and-copy modal; `.ics` download works offline; all Firestore error paths unchanged.

## 5. Testing

- **New unit suites:** `bestSlots` (ties, overlapping candidates, cross-day boundaries, bucketing, empty inputs), `ics` (CRLF line endings, UTC conversion, text escaping, URL encoding), `themeStore` (persistence, system fallback).
- **Existing suites** (bitmap, calendarPages, nameNormalize, participantId, slots, timezoneSlots, smoke, functions tests) must keep passing untouched.
- **Verification:** `npm run build && npm run lint && npm test`, then drive the real app in a browser — create → share → join → paint → best times → export — at 375px and ≥1280px widths, both themes.

## 6. Documentation Deliverables

- `docs/architecture.md` — system overview + mermaid diagrams (context, data flow, presence), Firestore/RTDB schemas, security model, CI/CD.
- `docs/design-system.md` — token tables (§2), type ramp, primitive usage with code examples.
- `docs/ux-flows.md` — host and invitee journeys with flow diagrams, screen inventory.
- `README.md` refresh; `PRODUCTION.md` status/roadmap updated to reflect this release.

## 7. Rollout

Feature branch → PR (existing preview-channel workflow) → visual review → merge to `main` → auto-deploy to the live Firebase Hosting site. RTDB rules deploy alongside (`firebase.json` gains a `database` target).
