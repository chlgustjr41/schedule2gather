import { describe, expect, it } from 'vitest'
import type { EventForLabels } from '@/lib/timezoneSlots'
import {
  buildIcs,
  escapeIcsText,
  formatIcsDate,
  googleCalendarUrl,
  summaryText,
  windowUtcRange,
  type IcsEvent,
} from '@/lib/ics'

// July 22 2026, 18:00–22:00 New York (EDT = UTC-4), 30-min slots → 8 slots.
const EVENT: IcsEvent = {
  name: 'Pizza Night, extra cheese',
  mode: 'specific_dates',
  dates: ['2026-07-22'],
  timeRange: { start: 18, end: 22 },
  slotMinutes: 30,
  timezone: 'America/New_York',
} satisfies EventForLabels & { name: string }

// slots 2..4 = 19:00–20:30 EDT = 23:00Z–00:30Z(+1d)
const WINDOW = { startSlot: 2, endSlot: 4 }

describe('formatIcsDate', () => {
  it('formats UTC basic format', () => {
    expect(formatIcsDate(new Date(Date.UTC(2026, 6, 22, 23, 0, 0)))).toBe('20260722T230000Z')
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma, newline', () => {
    expect(escapeIcsText('a,b;c\nd\\e')).toBe('a\\,b\\;c\\nd\\\\e')
  })
})

describe('windowUtcRange', () => {
  it('computes inclusive-end UTC range across DST-aware zone', () => {
    const range = windowUtcRange(EVENT, WINDOW)!
    expect(range.start.toISOString()).toBe('2026-07-22T23:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-07-23T00:30:00.000Z')
  })
})

describe('buildIcs', () => {
  it('produces CRLF-joined VEVENT with escaped summary', () => {
    const ics = buildIcs(EVENT, WINDOW, 'https://s2g.app/e/abc')!
    expect(ics).toContain('DTSTART:20260722T230000Z\r\n')
    expect(ics).toContain('DTEND:20260723T003000Z\r\n')
    expect(ics).toContain('SUMMARY:Pizza Night\\, extra cheese\r\n')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

describe('googleCalendarUrl', () => {
  it('encodes template URL with dates pair', () => {
    const url = googleCalendarUrl(EVENT, WINDOW, 'https://s2g.app/e/abc')!
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true)
    expect(url).toContain('dates=20260722T230000Z%2F20260723T003000Z')
  })
})

describe('summaryText', () => {
  it('renders viewer-zone summary with attendance and link', () => {
    const text = summaryText(EVENT, WINDOW, 'America/New_York', 'https://s2g.app/e/abc', 5, 6)
    expect(text).toContain('Pizza Night, extra cheese')
    expect(text).toContain('7:00 PM')
    expect(text).toContain('(5/6 available)')
    expect(text).toContain('https://s2g.app/e/abc')
  })
})
