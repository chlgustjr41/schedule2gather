import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

export interface EventForLabels {
  mode: 'specific_dates' | 'weekdays_in_range' | 'weekdays_recurring'
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
}

const WEEKDAY_TITLES: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function slotsPerDay(event: EventForLabels): number {
  return (event.timeRange.end - event.timeRange.start) * (60 / event.slotMinutes)
}

export function slotMomentInUTC(event: EventForLabels, slotIdx: number): Date | null {
  if (event.mode === 'weekdays_recurring') return null
  const spd = slotsPerDay(event)
  if (slotIdx < 0 || slotIdx >= event.dates.length * spd) return null
  const dateIdx = Math.floor(slotIdx / spd)
  const timeIdx = slotIdx % spd
  const dateStr = event.dates[dateIdx]
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const totalMinutes = event.timeRange.start * 60 + timeIdx * event.slotMinutes
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  const wallClock = `${dateStr}T${pad(hour)}:${pad(minute)}:00`
  try {
    return fromZonedTime(wallClock, event.timezone)
  } catch {
    return null
  }
}

export function formatSlotDateLabel(
  event: EventForLabels,
  dateIdx: number,
  viewerTz: string,
): string {
  if (event.mode === 'weekdays_recurring') {
    const w = event.dates[dateIdx]
    return WEEKDAY_TITLES[w] ?? w ?? ''
  }
  const spd = slotsPerDay(event)
  const moment = slotMomentInUTC(event, dateIdx * spd)
  if (!moment) return event.dates[dateIdx] ?? ''
  try {
    return formatInTimeZone(moment, viewerTz, 'EEE MMM d')
  } catch {
    return event.dates[dateIdx] ?? ''
  }
}

/** Same date, split into weekday and month/day — for two-line column headers. */
export function formatSlotDateParts(
  event: EventForLabels,
  dateIdx: number,
  viewerTz: string,
): { day: string; date: string } {
  if (event.mode === 'weekdays_recurring') {
    const w = event.dates[dateIdx]
    return { day: WEEKDAY_TITLES[w] ?? w ?? '', date: '' }
  }
  const spd = slotsPerDay(event)
  const moment = slotMomentInUTC(event, dateIdx * spd)
  if (!moment) return { day: event.dates[dateIdx] ?? '', date: '' }
  try {
    return {
      day: formatInTimeZone(moment, viewerTz, 'EEE'),
      date: formatInTimeZone(moment, viewerTz, 'MMM d'),
    }
  } catch {
    return { day: event.dates[dateIdx] ?? '', date: '' }
  }
}

/** 12-hour clock with AM/PM, e.g. "9:15 AM" — `hour24` may be >23 (wraps). */
function formatHourMinute12(hour24: number, minute: number): string {
  const norm = ((hour24 % 24) + 24) % 24
  const suffix = norm < 12 ? 'AM' : 'PM'
  const h12 = norm % 12 === 0 ? 12 : norm % 12
  return `${h12}:${pad(minute)} ${suffix}`
}

export function formatSlotTimeLabel(
  event: EventForLabels,
  slotIdx: number,
  viewerTz: string,
): string {
  if (event.mode === 'weekdays_recurring') {
    const spd = slotsPerDay(event)
    const timeIdx = slotIdx % spd
    const totalMinutes = event.timeRange.start * 60 + timeIdx * event.slotMinutes
    const hour = Math.floor(totalMinutes / 60)
    const minute = totalMinutes % 60
    return formatHourMinute12(hour, minute)
  }
  const moment = slotMomentInUTC(event, slotIdx)
  if (!moment) return ''
  try {
    return formatInTimeZone(moment, viewerTz, 'h:mm a')
  } catch {
    return ''
  }
}
