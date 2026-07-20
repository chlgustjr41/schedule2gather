export interface MinuteRange {
  start: number
  end: number
}

/**
 * Enforce a valid daily window in minutes-from-midnight (0..1440), snapped to
 * `step`. `changed` names the bound the user just moved; the sibling is
 * pushed out of the way by one step rather than rejecting the input.
 */
export function clampTimeRange(
  start: number,
  end: number,
  changed: 'start' | 'end',
  step: number,
): MinuteRange {
  const snap = (n: number) => Math.round(n / step) * step
  const s0 = Math.min(1440 - step, Math.max(0, snap(start)))
  const e0 = Math.min(1440, Math.max(step, snap(end)))
  let s = s0
  let e = e0
  if (s >= e) {
    if (changed === 'start') e = s + step
    else s = e - step
  }
  return { start: s, end: e }
}
