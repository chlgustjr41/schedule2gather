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
