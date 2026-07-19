# Design System

The "Warm & Friendly" design system introduced in the 2026-07 redesign
(`docs/superpowers/specs/2026-07-18-redesign-design.md` §2). Tokens are CSS custom properties
declared in `src/index.css`; components consume them only through Tailwind v4 utility classes —
there is no `dark:` variant anywhere in the codebase. Dark mode works by **reassigning the same
custom properties** under `:root[data-theme="dark"]`, so every component that uses a token utility
gets dark mode for free.

## Token tables

### Light (`:root`)

| Token | Value | Use |
|---|---|---|
| `bg` (`--s2g-bg`) | `#F0E7D5` | Page canvas — warm beige, never pure white |
| `surface` (`--s2g-surface`) | `#FFFDF7` | Cards, panels |
| `surface-raised` (`--s2g-raised`) | `#FFFFFF` | Inputs, popovers, segmented-control thumb |
| `line` (`--s2g-line`) | `#DFD3BB` | Borders, dividers |
| `ink` (`--s2g-ink`) | `#3D3833` | Primary text |
| `ink-muted` (`--s2g-ink-muted`) | `#857A66` | Secondary text, labels |
| `primary` (`--s2g-primary`) | `#E0653A` | Buttons, wordmark accent, focus rings |
| `on-primary` (`--s2g-on-primary`) | `#FFFFFF` | Text on primary-colored surfaces |
| `danger` (`--s2g-danger`) | `#C94F36` | Destructive actions, error text |
| `success` (`--s2g-success`) | `#2F9E57` | Confirmation, presence dots |
| `slot-empty` (`--s2g-slot-empty`) | `#FFFDF7` (+ 1px `line` border) | Unselected grid slot — warm-white so it stands out from the beige canvas |

### Dark (`:root[data-theme="dark"]`)

| Token | Value | Use |
|---|---|---|
| `bg` | `#2B2825` | Page canvas — warm dark grey, never pure black |
| `surface` | `#363230` | Cards, panels |
| `surface-raised` | `#403B37` | Inputs, popovers, segmented-control thumb |
| `line` | `#4A443E` | Borders, dividers |
| `ink` | `#F0EAE0` | Primary text |
| `ink-muted` | `#B0A697` | Secondary text, labels |
| `primary` | `#F07B4F` | Buttons, wordmark accent, focus rings |
| `on-primary` | `#2A1006` | Text on primary-colored surfaces |
| `danger` | `#E06A50` | Destructive actions, error text |
| `success` | `#58C277` | Confirmation, presence dots |
| `slot-empty` | `#3A3631` | Unselected grid slot |

All ink-on-surface pairs are designed to meet WCAG AA (4.5:1); the redesign spec allows exact
heatmap values to be contrast-tuned during implementation as long as hue and ordering are kept —
the shipped values in `src/index.css` match the spec's proposed values exactly, so no tuning was
needed.

`src/index.css` is the single implementation source. It declares the raw `--s2g-*` custom
properties, then re-exposes a subset through Tailwind v4's `@theme inline` block as utility-ready
color tokens:

```css
@theme inline {
  --color-canvas: var(--s2g-bg);
  --color-surface: var(--s2g-surface);
  --color-raised: var(--s2g-raised);
  --color-line: var(--s2g-line);
  --color-ink: var(--s2g-ink);
  --color-ink-muted: var(--s2g-ink-muted);
  --color-primary: var(--s2g-primary);
  --color-on-primary: var(--s2g-on-primary);
  --color-danger: var(--s2g-danger);
  --color-success: var(--s2g-success);
  --font-sans: 'Nunito', system-ui, Avenir, Helvetica, Arial, sans-serif;
}
```

Which is why components can write `bg-canvas`, `bg-surface`, `bg-raised`, `border-line`, `text-ink`,
`text-ink-muted`, `bg-primary`, `text-on-primary`, `text-danger`, `text-success` (and Tailwind
opacity modifiers like `bg-primary/10`) directly, with zero `dark:` conditionals. Tokens that
aren't run through `@theme inline` (heatmap steps, mine color, shadows) are consumed via arbitrary
`var(--s2g-*)` references instead — see below.

## Heatmap ramp & "my times" paint color

The Group layer buckets attendance into 4 discrete steps (`src/lib/heatColor.ts`):

```ts
export function heatColor(count: number, total: number): string {
  if (total === 0 || count === 0) return 'var(--s2g-slot-empty)'
  const bucket = Math.min(4, Math.max(1, Math.ceil((count / total) * 4)))
  return `var(--s2g-heat-${bucket})`
}
```

| Step | Light | Dark |
|---|---|---|
| `heat-1` (lowest non-zero attendance fraction) | `#CDE8CF` | `#2F5A3C` |
| `heat-2` | `#9FD8A6` | `#3C7A4F` |
| `heat-3` | `#63BF77` | `#4EA265` |
| `heat-4` (full/near-full attendance) | `#2F9E57` | `#63C87E` |

The My-times layer is binary, not ramped — `mineColor(mine)` returns solid `--s2g-mine`
(`#2F9E57` light / `#3F9459` dark) when painted, or `--s2g-slot-empty` otherwise.

## Avatar palette

Six warm hues, assigned deterministically by a name hash (`src/lib/avatarColor.ts`, same array in
both light and dark mode — avatars don't retheme):

`#D98E4A` `#7BA05B` `#6B5D52` `#A3784F` `#C96F52` `#8E9A5B`

```ts
export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
```

`avatarInitials` renders first+last word initials uppercased (`"Jacob Choi"` → `"JC"`), a single
word sliced to 2 chars (`"sam"` → `"SA"`), or `"?"` for an empty/whitespace-only name.

## Typography

Font: **Nunito**, self-hosted via `@fontsource/nunito` — weights 400/600/700/800 imported
per-weight in `src/main.tsx` (`@fontsource/nunito/{400,600,700,800}.css`) so there's no
render-blocking Google Fonts request.

| Style | Size / weight |
|---|---|
| Display | 28px / 800 |
| H2 | 19px / 700 |
| Body | 15px / 400 |
| Small | 12.5px / 400 |
| Micro-label | 10px / 800, uppercase, +8% letter-spacing |

## Shape & elevation

- **Radii:** cards 20px (`rounded-[20px]`, see `Card`/`BottomSheet`), controls 12px
  (`rounded-[12px]`, see `TextField`), buttons and pills 999px (`rounded-full`, see `Button`/
  `SegmentedControl`). The spec also calls for 5px grid-cell corners; the shipped
  `AvailabilityGrid` cells are square (no `rounded-*` class on the `<td>`) — see Documented
  deviations.
- **Elevation:** light mode uses shadows — `--s2g-shadow-card: 0 2px 8px rgba(61,56,51,.06)` on
  surfaces, `--s2g-shadow-primary: 0 4px 12px rgba(224,101,58,.30)` under primary buttons — consumed
  as `shadow-[var(--s2g-shadow-card)]` / `shadow-[var(--s2g-shadow-primary)]`. Dark mode sets both
  variables to `none`; `Card` and `Button` still carry a 1px `border-line`/border class
  unconditionally, so the border *becomes* the elevation cue in dark mode without any conditional
  logic in the component.

## Primitives reference (`src/components/ui/`)

### `Button.tsx`

| Prop | Type | Default |
|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `className` | `string` | `''` |
| ...rest | all native `<button>` attributes | — |

```tsx
// src/components/BestTimesPanel.tsx
<Button variant="secondary" size="sm" onClick={() => setExportWindow(w)}>
  Add to cal ⤓
</Button>
```

### `Card.tsx`

| Prop | Type | Default |
|---|---|---|
| `className` | `string` | `''` |
| ...rest | all native `<div>` attributes | — |

```tsx
// src/components/BestTimesPanel.tsx
<Card className="mb-4 max-w-5xl mx-auto">
  {/* ✨ Best times heading + ranked window list */}
</Card>
```

### `SegmentedControl.tsx`

| Prop | Type | Default |
|---|---|---|
| `options` | `{ value: T; label: string }[]` | required |
| `value` | `T` | required |
| `onChange` | `(value: T) => void` | required |
| `className` | `string` | `''` |

Generic over `T extends string`. Renders `role="tablist"` / `role="tab"` with `aria-selected`.

```tsx
// src/components/AvailabilityGrid.tsx (mobile My-times/Group toggle, <1024px)
<SegmentedControl
  className="max-w-xs mx-auto mb-3"
  options={[
    { value: 'mine', label: '✏️ My times' },
    { value: 'group', label: '👥 Group' },
  ]}
  value={layer}
  onChange={setLayer}
/>
```

### `BottomSheet.tsx`

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | required |
| `onClose` | `() => void` | required |
| `children` | `ReactNode` | required |

Closes on backdrop click or `Escape`. Renders as a bottom sheet below `640px` viewport width and a
centered modal at `640px` and above (Tailwind `sm:` breakpoint) — see Documented deviations.

```tsx
// src/components/ExportSheet.tsx
<BottomSheet title="Add to calendar" onClose={onClose}>
  <div className="space-y-2">
    <Button variant="secondary" size="lg" onClick={handleIcs}>Download .ics</Button>
    <Button variant="secondary" size="lg" onClick={handleGoogle}>Open Google Calendar</Button>
    <Button variant="secondary" size="lg" onClick={() => void handleCopy()}>
      {copied ? 'Copied ✓' : 'Copy summary text'}
    </Button>
  </div>
</BottomSheet>
```

### `Avatar.tsx`

| Prop | Type | Default |
|---|---|---|
| `name` | `string` | required |
| `present` | `boolean` | `false` |
| `size` | `number` (px) | `30` |

Renders initials on an `avatarColor(name)` background; `present` overlays a small `bg-success`
dot with `aria-label="{name} is here now"`.

```tsx
// src/pages/EventPage.tsx (header avatar row, presence-aware)
<Avatar name={p.name} present={presentIds.has(p.participantId)} size={28} />
```

### `TextField.tsx`

| Prop | Type | Default |
|---|---|---|
| `label` | `string?` | — |
| `id` | `string?` | — |
| `className` | `string` | `''` |
| ...rest | all native `<input>` attributes | — |

Label (if given) renders as an uppercase micro-label above the input.

```tsx
// src/components/JoinScreen.tsx
<TextField
  id="join-name"
  label="Join in"
  type="text"
  autoFocus
  required
  maxLength={79}
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Your name"
/>
```

### `ThemeToggle.tsx`

No props. Reads/writes `themeStore` directly; renders 🌙 (light mode, click to go dark) or ☀️
(dark mode, click to go light) with an accessible `aria-label`.

```tsx
// src/pages/LandingPage.tsx
<header className="max-w-2xl mx-auto px-4 pt-4 flex items-center justify-between">
  <Wordmark />
  <ThemeToggle />
</header>
```

### `Wordmark.tsx`

No props. A `react-router-dom` `Link` to `/` rendering `schedule2gather` with the `2` in `primary`.

```tsx
// src/pages/EventPage.tsx
<Wordmark />
```

## Documented deviations

- **`BottomSheet` breakpoint:** the spec (§2.3) describes bottom-sheet→centered-modal switching at
  768px. The shipped component uses Tailwind's `sm:` prefix throughout (`items-end sm:items-center`,
  `rounded-t-[20px] sm:rounded-[20px]`, `pb-8 sm:pb-5`), which is **640px**, not 768px. This is the
  intentional, shipped behavior — not a bug — and this doc records 640px as the real breakpoint.
- **`Chip` / `Toast` not built:** spec §2.3 lists `Chip` and `Toast` as primitives. Neither exists
  under `src/components/ui/`. Their use cases are covered by inline patterns instead: the
  Advanced-settings summary row (`⚙ 9 AM – 9 PM · 30 min · Eastern ▾`) in `CreateEventForm.tsx`
  substitutes for a chip, and copy feedback in `ExportSheet.tsx` is an inline button-label swap
  (`Copied ✓`) rather than a toast.
- **Grid cell radius:** spec §2.2 lists a 5px radius for grid cells. `AvailabilityGrid.tsx`'s
  `<td>` cells carry no `rounded-*` class — cells render as sharp rectangles in the shipped grid.

## Theming how-to

`themeStore` (`src/stores/themeStore.ts`) holds a `light | dark | system` preference, defaulting to
`system`. `resolveTheme()` maps `system` to `dark` only when `window.matchMedia('(prefers-color-scheme: dark)').matches`
is true (and `matchMedia` is unavailable → falls back to `light`, e.g. in non-browser test
environments). `init()` reads `localStorage['s2g-theme']`, applies the resolved theme by setting
`document.documentElement.dataset.theme`, and subscribes to `prefers-color-scheme` changes so an
untouched "system" preference keeps following the OS. `toggle()` flips between light/dark, persists
the explicit choice to `localStorage` (best-effort — wrapped in `try/catch` for private-mode
browsers), and re-stamps `data-theme`. `main.tsx` calls `useThemeStore.getState().init()` once,
synchronously, before the first render.

**To add a new token:** one line in three places —

1. `:root { --s2g-my-token: <light value>; }` in `src/index.css`
2. `:root[data-theme="dark"] { --s2g-my-token: <dark value>; }` in the same file
3. If it should be a Tailwind utility, add `--color-my-token: var(--s2g-my-token);` inside the
   `@theme inline` block (otherwise consume it via `var(--s2g-my-token)` in an arbitrary-value
   class, as the heatmap/shadow tokens do).

No component code needs to change for a new color — dark mode is automatic because components only
ever reference the token name, never a literal hex value.
