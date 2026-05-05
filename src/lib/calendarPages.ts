import { addDays, addMonths, endOfMonth, format, startOfMonth } from 'date-fns'

export interface CalendarColumn {
  /** The actual Date object for this column. */
  date: Date
  /** ISO yyyy-MM-dd of the date. */
  dateStr: string
  /** Index into event.dates if this date is in the event; -1 otherwise (greyed). */
  eventDateIdx: number
}

/**
 * Return the Sunday at or before the given date (local time).
 */
export function startOfWeekSunday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function parseEventDates(eventDates: string[]): Date[] {
  return eventDates
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
    .map((s) => {
      const d = new Date(s + 'T00:00:00')
      d.setHours(0, 0, 0, 0)
      return d
    })
    .sort((a, b) => a.getTime() - b.getTime())
}

/**
 * Returns the Sunday-anchored start dates of every calendar week between the first and
 * last event date (inclusive of both endpoints' weeks).
 */
export function getWeekPages(eventDates: string[]): Date[] {
  const dates = parseEventDates(eventDates)
  if (dates.length === 0) return []
  const startSun = startOfWeekSunday(dates[0])
  const endSun = startOfWeekSunday(dates[dates.length - 1])
  const out: Date[] = []
  let cur = new Date(startSun)
  while (cur.getTime() <= endSun.getTime()) {
    out.push(new Date(cur))
    cur = addDays(cur, 7)
  }
  return out
}

/**
 * Returns the first-of-month for every month between the first and last event date.
 */
export function getMonthPages(eventDates: string[]): Date[] {
  const dates = parseEventDates(eventDates)
  if (dates.length === 0) return []
  const startM = startOfMonth(dates[0])
  const endM = startOfMonth(dates[dates.length - 1])
  const out: Date[] = []
  let cur = new Date(startM)
  while (cur.getTime() <= endM.getTime()) {
    out.push(new Date(cur))
    cur = addMonths(cur, 1)
  }
  return out
}

/**
 * Compute visible columns for a page.
 * - Week mode: 7 dates Sun-Sat from pageStart (which must be a Sunday).
 * - Month mode: all dates in the calendar month containing pageStart.
 *
 * Each column is annotated with eventDateIdx (= -1 if the date is not in event.dates).
 */
export function getVisibleColumns(
  pageStart: Date,
  viewMode: 'week' | 'month',
  eventDates: string[],
): CalendarColumn[] {
  const eventIdxByStr = new Map<string, number>()
  eventDates.forEach((s, i) => eventIdxByStr.set(s, i))

  const days: Date[] = []
  if (viewMode === 'week') {
    for (let i = 0; i < 7; i++) {
      days.push(addDays(pageStart, i))
    }
  } else {
    const monthEnd = endOfMonth(pageStart)
    let cur = new Date(pageStart)
    while (cur.getTime() <= monthEnd.getTime()) {
      days.push(new Date(cur))
      cur = addDays(cur, 1)
    }
  }

  return days.map((d) => {
    const dateStr = format(d, 'yyyy-MM-dd')
    return {
      date: d,
      dateStr,
      eventDateIdx: eventIdxByStr.get(dateStr) ?? -1,
    }
  })
}
