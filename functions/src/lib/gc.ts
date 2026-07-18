export interface GcEvent {
  mode: 'specific_dates' | 'weekdays_in_range' | 'weekdays_recurring'
  /** ISO yyyy-MM-dd for calendar modes; weekday names for recurring. */
  dates: string[]
  createdAt: { toMillis(): number }
  expiresAt: { toMillis(): number }
  lastVisitedAt?: { toMillis(): number } | null
}

export const IDLE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * An event should be deleted when:
 *  - the 90-day hard cap has passed (expiresAt), OR
 *  - it has calendar dates, the last date's day has fully ended (UTC — a
 *    deliberate simplification vs. event-timezone wall clock), and the last
 *    visit (falling back to creation) was more than 30 days ago.
 * weekdays_recurring events have no calendar dates → hard cap only.
 */
export function shouldDeleteEvent(event: GcEvent, nowMs: number): boolean {
  if (event.expiresAt.toMillis() <= nowMs) return true
  if (event.mode === 'weekdays_recurring') return false
  const isoDates = event.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (isoDates.length === 0) return false
  const lastDate = [...isoDates].sort()[isoDates.length - 1]
  const lastDateEndMs = Date.parse(`${lastDate}T23:59:59.999Z`)
  if (Number.isNaN(lastDateEndMs) || lastDateEndMs >= nowMs) return false
  const lastTouchMs = event.lastVisitedAt?.toMillis() ?? event.createdAt.toMillis()
  return nowMs - lastTouchMs > IDLE_MS
}
