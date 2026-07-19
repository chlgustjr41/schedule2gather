export interface HourRange {
  start: number
  end: number
}

/**
 * Enforce a valid daily window (start < end, start 0–23, end 1–24).
 * `changed` names the bound the user just moved; the sibling is pushed
 * out of the way rather than rejecting the input.
 */
export function clampTimeRange(start: number, end: number, changed: 'start' | 'end'): HourRange {
  const s0 = Math.min(23, Math.max(0, Math.round(start)))
  const e0 = Math.min(24, Math.max(1, Math.round(end)))
  let s = s0
  let e = e0
  if (s >= e) {
    if (changed === 'start') e = s + 1
    else s = e - 1
  }
  return { start: s, end: e }
}
