# Phase 3 — Make it usable — Design

**Status:** Approved 2026-05-05 (user confirmed Q1=A toggleable + Q2=A with Ctrl+Z / Ctrl+Shift+Z hotkeys + tooltip).

**Goal:** Mobile-first painting + power-user productivity. After P3, the app is usable on a phone (touch paints without fighting scroll), supports undo/redo, and exposes keyboard navigation + ARIA semantics.

**Reference:** PRODUCTION.md §12 Phase 3.

---

## 1. What's already done before P3

- Pointer Events for unified mouse/touch/pen (P1)
- Commit-on-pointer-up (one Firestore write per drag stroke — P1)
- Paintbrush drag with `elementFromPoint` for capture-safe path tracking (recent fix)

These were already in scope for P3; we landed them earlier as part of P1/P2 work.

## 2. P3 in scope

- **Paint Mode toggle button** — explicit on/off state; off by default; visible on every device but only meaningful on touch (where it gates `touch-action`).
- **Undo / Redo** — buttons + Ctrl+Z (undo) / Ctrl+Shift+Z (redo) hotkeys. Stack depth 50. Per-event in-memory.
- **Keyboard navigation + ARIA** — Arrow keys move focus across cells; Space/Enter toggle the focused cell. `role="grid"` semantics on the table.
- **Haptic feedback** — `navigator.vibrate(15)` on each cell paint (folded into the paint flow).

## 3. Decisions locked

| Question | Decision | Rationale |
|---|---|---|
| Paint mode default | Off on every device | Spec's "explicit toggle" intent; first-visit safety; user must opt in to painting on touch (avoiding scroll-vs-paint surprise). |
| Paint mode UI | Pill button at top of grid: "Paint Mode: Off / On". Click toggles. Always visible (consistent UX across desktop/touch). | Simple discoverable toggle. |
| Touch behavior when paint mode off | `touch-action: pan-y pan-x` on the grid cells → page scrolls naturally. | Matches platform expectation. |
| Touch behavior when paint mode on | `touch-action: none` on cells → pointerdown triggers paint, no scroll competition. | Required for clean paint-on-touch. |
| Mouse behavior | Unaffected by paint mode. Desktop mouse drag always paints (it doesn't fight scroll). | Don't punish desktop users for a mobile feature. |
| Undo/redo stack | Per-event in-memory. Cleared when leaving the event page. Depth 50 (older entries dropped FIFO). | In-memory keeps data layer simple; 50 covers typical paint sessions. |
| Undo/redo trigger points | Push current bitmap to undo stack BEFORE applying a paint commit, column toggle, row toggle, mark-all, clear-all. Redo stack cleared on any new edit. | Standard editor undo semantics. |
| Hotkeys | Ctrl+Z (Cmd+Z on Mac) for undo, Ctrl+Shift+Z (Cmd+Shift+Z on Mac) for redo. | User-specified. |
| Hotkey UI | Tooltip on the buttons: "Undo (Ctrl+Z)" / "Redo (Ctrl+Shift+Z)". Use `Cmd` on Mac via simple userAgent check. | User-specified. |
| Button placement | Above the grid, alongside Mark-all / Clear-all. | Single action bar; no surprise locations. |
| ARIA | `<table role="grid">`, `<tr role="row">`, `<th role="columnheader">`, `<td role="gridcell">`. Roving tabindex (focused cell `tabindex="0"`, others `-1`). | Standard data-grid pattern. |
| Keyboard cell toggle | Space / Enter on focused cell. Holds paint-by-example: if cell is on → turns off, vice versa. No drag via keyboard (impractical). | Simplest meaningful keyboard interaction. |
| Arrow key wrap-around | Stop at edges (no wrap). | Less surprising than wrapping; user can still hold arrow to skim. |
| Haptic | `navigator.vibrate(15)` once per pointerdown (start of stroke) and once per new cell entered during drag. Skip if `navigator.vibrate` is undefined. | Subtle feedback; no opt-out needed (Android only — iOS doesn't expose Vibration API in Safari). |

## 4. P3 out of scope (deferred)

- Range-select via Shift+Arrow (a richer keyboard model — wait for P5 a11y polish if requested)
- Vim/emacs-style cell navigation
- Vibration intensity options
- Mobile-specific UI tweaks beyond the paint-mode toggle (font sizing, cell density) — wait for P5

## 5. Files

### New
- (none — all changes are modifications)

### Modified
- `src/stores/paintStore.ts` — adds `paintMode`, `undoStack`, `redoStack`, actions: `setPaintMode`, `pushHistory`, `undo`, `redo`
- `src/components/AvailabilityGrid.tsx` — Paint Mode button, Undo/Redo buttons, ARIA roles, roving tabindex, keyboard handlers, haptic call, `touch-action` switching, hotkey listener
- `src/pages/EventPage.tsx` — register the global keyboard hotkey listener (Ctrl+Z / Ctrl+Shift+Z) when on this route

## 6. Acceptance

1. **Touch paint mode** — On a phone, touching a cell when paint mode is off scrolls the page; tapping the toggle and then dragging paints cells along the path.
2. **Mouse paint** — Unchanged; works regardless of paint mode.
3. **Undo / Redo buttons** — paint a few strokes; click Undo → previous state restored; click Redo → restored back. Buttons disabled when stack is empty.
4. **Hotkeys** — Ctrl+Z undoes; Ctrl+Shift+Z redoes. Hover tooltips show the hotkey.
5. **Keyboard nav** — Tab into the grid (first cell focused); arrow keys move focus; Space toggles the cell; focus stays on the toggled cell.
6. **ARIA** — Screen reader announces "grid", row count, column headers, cell selected state.
7. **Haptic** — Phone vibrates briefly on each cell paint (when supported).

## 7. Order of execution

- **P3-A**: Paint Mode toggle + haptic feedback (touch UX foundation)
- **P3-B**: Undo / Redo (state + buttons + hotkeys + tooltips)
- **P3-C**: Keyboard nav + ARIA (depends on no other piece; ships last to keep markup churn isolated)

Each phase ships separately, CI green, push between.
