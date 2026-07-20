import { eachDayOfInterval, startOfDay } from 'date-fns'

/**
 * Merge every day of [from, to] (inclusive, either order) into `existing`,
 * excluding days before `today` and deduplicating by calendar day.
 * Pure: returns a new array; existing entries keep their order, new days
 * append in ascending date order.
 */
export function mergeRangeIntoDates(existing: Date[], from: Date, to: Date, today: Date): Date[] {
  const [start, end] = from <= to ? [from, to] : [to, from]
  const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) }).filter(
    (day) => day >= startOfDay(today),
  )
  const seen = new Set(existing.map((day) => day.toDateString()))
  const merged = [...existing]
  for (const day of days) {
    if (!seen.has(day.toDateString())) {
      merged.push(day)
      seen.add(day.toDateString())
    }
  }
  return merged
}

/**
 * Toggle a candidate set against a selection: if EVERY candidate day is already
 * selected, remove them all; otherwise add the missing ones. Pure; dedupes by
 * calendar day. Empty candidates → selection returned unchanged.
 */
export function toggleDays(existing: Date[], candidates: Date[]): Date[] {
  const candidateKeys = new Set(candidates.map((d) => d.toDateString()))
  if (candidateKeys.size === 0) return existing
  const existingKeys = new Set(existing.map((d) => d.toDateString()))
  const allPresent = [...candidateKeys].every((k) => existingKeys.has(k))
  if (allPresent) {
    return existing.filter((d) => !candidateKeys.has(d.toDateString()))
  }
  const merged = [...existing]
  for (const c of candidates) {
    if (!existingKeys.has(c.toDateString())) {
      merged.push(c)
      existingKeys.add(c.toDateString())
    }
  }
  return merged
}
