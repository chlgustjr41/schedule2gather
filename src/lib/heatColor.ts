/** Group-layer heatmap: attendance fraction → 4-step token ramp. */
export function heatColor(count: number, total: number): string {
  if (total === 0 || count === 0) return 'var(--s2g-slot-empty)'
  const bucket = Math.min(4, Math.max(1, Math.ceil((count / total) * 4)))
  return `var(--s2g-heat-${bucket})`
}

/** My-times layer: solid green when painted, warm-white slot otherwise. */
export function mineColor(mine: boolean): string {
  return mine ? 'var(--s2g-mine)' : 'var(--s2g-slot-empty)'
}
