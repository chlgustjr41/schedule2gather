import { formatInTimeZone } from 'date-fns-tz'
import { slotMomentInUTC, type EventForLabels } from '@/lib/timezoneSlots'

export interface SlotWindow {
  startSlot: number
  /** Inclusive. */
  endSlot: number
}

export type IcsEvent = EventForLabels & { name: string }

export function windowUtcRange(event: EventForLabels, w: SlotWindow): { start: Date; end: Date } | null {
  const start = slotMomentInUTC(event, w.startSlot)
  const endStart = slotMomentInUTC(event, w.endSlot)
  if (!start || !endStart) return null
  return { start, end: new Date(endStart.getTime() + event.slotMinutes * 60_000) }
}

/**
 * Human label for a ranked/finalized window: a full "day, from–to" range
 * normally, or just the day when the event is date-only (no hourly grid).
 * Shared by BestTimesPanel, FinalizeSheet, and FinalizedBanner to avoid
 * triplicating the day/from/to formatting.
 */
export function formatWindowLabel(
  event: EventForLabels & { datesOnly?: boolean },
  w: SlotWindow,
  viewerTz: string,
): string {
  const range = windowUtcRange(event, w)
  if (!range) return ''
  const day = formatInTimeZone(range.start, viewerTz, 'EEE MMM d')
  if (event.datesOnly) return day
  const from = formatInTimeZone(range.start, viewerTz, 'h:mm a')
  const to = formatInTimeZone(range.end, viewerTz, 'h:mm a')
  return `${day}, ${from}–${to}`
}

export function formatIcsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

export function buildIcs(event: IcsEvent, w: SlotWindow, url: string): string | null {
  const range = windowUtcRange(event, w)
  if (!range) return null
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//schedule2gather//EN',
    'BEGIN:VEVENT',
    `UID:${encodeURIComponent(url)}-${w.startSlot}@schedule2gather`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(range.start)}`,
    `DTEND:${formatIcsDate(range.end)}`,
    `SUMMARY:${escapeIcsText(event.name)}`,
    `DESCRIPTION:${escapeIcsText(`Scheduled with schedule2gather: ${url}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

export function googleCalendarUrl(event: IcsEvent, w: SlotWindow, url: string): string | null {
  const range = windowUtcRange(event, w)
  if (!range) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name,
    dates: `${formatIcsDate(range.start)}/${formatIcsDate(range.end)}`,
    details: `Scheduled with schedule2gather: ${url}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function summaryText(
  event: IcsEvent,
  w: SlotWindow,
  viewerTz: string,
  url: string,
  attendance: number,
  total: number,
): string {
  const range = windowUtcRange(event, w)
  if (!range) return url
  const label = formatWindowLabel(event, w, viewerTz)
  return `${event.name} — ${label} (${attendance}/${total} available): ${url}`
}

/** Browser-only: trigger a .ics file download. Not unit-tested (DOM side effect). */
export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
