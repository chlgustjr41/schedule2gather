import { unpack } from '@/lib/bitmap'

export interface BestSlotsEvent {
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  slotCount: number
}

export interface BestWindow {
  /** Inclusive flat slot indices (dateIdx * slotsPerDay + timeIdx). */
  startSlot: number
  endSlot: number
  /** Participants free for EVERY slot in the window. */
  attendance: number
  total: number
}

/**
 * Rank contiguous same-day windows by (attendance desc, duration desc, earlier start).
 * Greedy non-overlapping selection of the top `limit`.
 */
export function bestWindows(
  event: BestSlotsEvent,
  availabilities: string[],
  limit = 3,
): BestWindow[] {
  const { slotCount } = event
  const spd = (event.timeRange.end - event.timeRange.start) * (60 / event.slotMinutes)
  if (slotCount === 0 || spd <= 0 || availabilities.length === 0) return []

  const counts = new Array<number>(slotCount).fill(0)
  for (const encoded of availabilities) {
    if (encoded === '') continue
    const bits = unpack(encoded, slotCount)
    for (let i = 0; i < slotCount; i++) {
      if (bits[i]) counts[i] += 1
    }
  }
  const maxCount = Math.max(...counts)
  if (maxCount === 0) return []

  const candidates: BestWindow[] = []
  for (let level = maxCount; level >= 1; level--) {
    for (let d = 0; d < event.dates.length; d++) {
      let runStart = -1
      for (let t = 0; t <= spd; t++) {
        const inRun = t < spd && counts[d * spd + t] >= level
        if (inRun && runStart === -1) runStart = t
        if (!inRun && runStart !== -1) {
          candidates.push({
            startSlot: d * spd + runStart,
            endSlot: d * spd + t - 1,
            attendance: level,
            total: availabilities.length,
          })
          runStart = -1
        }
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.attendance - a.attendance ||
      (b.endSlot - b.startSlot) - (a.endSlot - a.startSlot) ||
      a.startSlot - b.startSlot,
  )

  const chosen: BestWindow[] = []
  for (const c of candidates) {
    if (chosen.length >= limit) break
    const overlaps = chosen.some((w) => c.startSlot <= w.endSlot && w.startSlot <= c.endSlot)
    if (!overlaps) chosen.push(c)
  }
  return chosen
}
