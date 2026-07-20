import { describe, expect, it } from 'vitest'
import type { EventForLabels } from '@/lib/timezoneSlots'
import { buildAnnouncementText, type AnnouncementEvent } from '@/lib/announcement'

// July 22 2026, 18:00–22:00 New York (EDT = UTC-4), 30-min slots.
const EVENT: AnnouncementEvent = {
  name: 'Pizza Night',
  mode: 'specific_dates',
  dates: ['2026-07-22'],
  timeRange: { start: 18, end: 22 },
  slotMinutes: 30,
  timezone: 'America/New_York',
} satisfies EventForLabels & { name: string }

const WINDOW = { startSlot: 2, endSlot: 4 }

describe('buildAnnouncementText', () => {
  it('includes the event name, day/time, and link', () => {
    const text = buildAnnouncementText(EVENT, WINDOW, 'America/New_York', 'https://s2g.app/e/abc')
    expect(text).toContain('Pizza Night')
    expect(text).toContain('7:00 PM')
    expect(text).toContain('https://s2g.app/e/abc')
  })

  it('appends the location when set', () => {
    const text = buildAnnouncementText(
      { ...EVENT, location: 'Joe’s Pizza, 123 Main St' },
      WINDOW,
      'America/New_York',
      'https://s2g.app/e/abc',
    )
    expect(text).toContain('at Joe’s Pizza, 123 Main St')
  })

  it('omits the "at ..." clause when there is no location', () => {
    const text = buildAnnouncementText(EVENT, WINDOW, 'America/New_York', 'https://s2g.app/e/abc')
    expect(text).not.toContain(' at ')
  })

  it('shows just the day (no time range) for dates-only events', () => {
    const text = buildAnnouncementText(
      { ...EVENT, datesOnly: true },
      WINDOW,
      'America/New_York',
      'https://s2g.app/e/abc',
    )
    expect(text).not.toContain('PM')
    expect(text).toContain('Jul 22')
  })
})
