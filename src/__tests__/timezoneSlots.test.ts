import { describe, it, expect } from 'vitest'
import {
  slotsPerDay,
  slotMomentInUTC,
  formatSlotDateLabel,
  formatSlotTimeLabel,
  type EventForLabels,
} from '@/lib/timezoneSlots'

const nyEvent: EventForLabels = {
  mode: 'specific_dates',
  dates: ['2026-05-05', '2026-05-06'],
  timeRange: { start: 9, end: 17 },
  slotMinutes: 30,
  timezone: 'America/New_York',
}

const sydneyEvent: EventForLabels = {
  mode: 'specific_dates',
  dates: ['2026-05-05'],
  timeRange: { start: 9, end: 17 },
  slotMinutes: 30,
  timezone: 'Australia/Sydney',
}

describe('timezoneSlots', () => {
  describe('slotsPerDay', () => {
    it('30-min from 9 to 17 → 16', () => {
      expect(slotsPerDay(nyEvent)).toBe(16)
    })
  })

  describe('slotMomentInUTC', () => {
    it('produces correct UTC moment for NY event slot 0 (May 5 9:00 EDT)', () => {
      // NY May 5, 2026 is on EDT (UTC-4). 9:00 EDT = 13:00 UTC.
      const m = slotMomentInUTC(nyEvent, 0)
      expect(m).not.toBeNull()
      expect(m!.toISOString()).toBe('2026-05-05T13:00:00.000Z')
    })

    it('produces correct UTC moment for NY event slot 1 (9:30 EDT)', () => {
      const m = slotMomentInUTC(nyEvent, 1)
      expect(m!.toISOString()).toBe('2026-05-05T13:30:00.000Z')
    })

    it('produces correct UTC moment for NY event slot 16 (May 6 9:00 EDT)', () => {
      const m = slotMomentInUTC(nyEvent, 16)
      expect(m!.toISOString()).toBe('2026-05-06T13:00:00.000Z')
    })

    it('returns null for weekdays_recurring mode', () => {
      const recurring: EventForLabels = {
        mode: 'weekdays_recurring',
        dates: ['mon', 'wed', 'fri'],
        timeRange: { start: 9, end: 17 },
        slotMinutes: 30,
        timezone: 'America/New_York',
      }
      expect(slotMomentInUTC(recurring, 0)).toBeNull()
    })

    it('returns null for out-of-range slot index', () => {
      expect(slotMomentInUTC(nyEvent, -1)).toBeNull()
      expect(slotMomentInUTC(nyEvent, 32)).toBeNull() // 2 dates * 16 slots = 32, so 32 is out
    })
  })

  describe('formatSlotDateLabel', () => {
    it('same-TZ (NY event, NY viewer): "Tue May 5"', () => {
      expect(formatSlotDateLabel(nyEvent, 0, 'America/New_York')).toBe('Tue May 5')
    })

    it('cross-TZ (NY event 9 AM EDT, Tokyo viewer): same day in Tokyo (Tue May 5 22:00 JST)', () => {
      // 9:00 EDT = 13:00 UTC = 22:00 JST same day
      expect(formatSlotDateLabel(nyEvent, 0, 'Asia/Tokyo')).toBe('Tue May 5')
    })

    it('date-line crossing (Sydney event 9 AM AEST, NY viewer): previous day in NY', () => {
      // Sydney May 5, 2026 is AEST (UTC+10). 9:00 AEST = 23:00 UTC May 4 = 19:00 EDT May 4.
      expect(formatSlotDateLabel(sydneyEvent, 0, 'America/New_York')).toBe('Mon May 4')
    })

    it('weekdays_recurring returns capitalized weekday', () => {
      const recurring: EventForLabels = {
        mode: 'weekdays_recurring',
        dates: ['mon', 'wed', 'fri'],
        timeRange: { start: 9, end: 17 },
        slotMinutes: 30,
        timezone: 'America/New_York',
      }
      expect(formatSlotDateLabel(recurring, 0, 'Asia/Tokyo')).toBe('Mon')
      expect(formatSlotDateLabel(recurring, 1, 'Asia/Tokyo')).toBe('Wed')
    })
  })

  describe('formatSlotTimeLabel', () => {
    it('same-TZ (NY event 9 AM, NY viewer): "09:00"', () => {
      expect(formatSlotTimeLabel(nyEvent, 0, 'America/New_York')).toBe('09:00')
    })

    it('NY event slot 1 in NY viewer: "09:30"', () => {
      expect(formatSlotTimeLabel(nyEvent, 1, 'America/New_York')).toBe('09:30')
    })

    it('cross-TZ (NY 9 AM EDT, LA viewer PDT): "06:00"', () => {
      // 9:00 EDT = 13:00 UTC = 06:00 PDT
      expect(formatSlotTimeLabel(nyEvent, 0, 'America/Los_Angeles')).toBe('06:00')
    })

    it('cross-TZ (NY 9 AM EDT, Tokyo viewer JST): "22:00"', () => {
      // 9:00 EDT = 13:00 UTC = 22:00 JST
      expect(formatSlotTimeLabel(nyEvent, 0, 'Asia/Tokyo')).toBe('22:00')
    })

    it('weekdays_recurring uses event-TZ formatting', () => {
      const recurring: EventForLabels = {
        mode: 'weekdays_recurring',
        dates: ['mon', 'wed', 'fri'],
        timeRange: { start: 9, end: 17 },
        slotMinutes: 30,
        timezone: 'America/New_York',
      }
      // Even with viewer TZ Tokyo, weekdays_recurring shows event-local times
      expect(formatSlotTimeLabel(recurring, 0, 'Asia/Tokyo')).toBe('09:00')
      expect(formatSlotTimeLabel(recurring, 1, 'Asia/Tokyo')).toBe('09:30')
    })
  })

  describe('DST handling', () => {
    it('spring-forward boundary: NY event at 7 AM EDT on 2026-03-08 → 11:00 UTC', () => {
      // 2026-03-08: NY transitions at 02:00 EST → 03:00 EDT. By 07:00 it's EDT (UTC-4).
      const event: EventForLabels = {
        mode: 'specific_dates',
        dates: ['2026-03-08'],
        timeRange: { start: 7, end: 8 },
        slotMinutes: 60,
        timezone: 'America/New_York',
      }
      const m = slotMomentInUTC(event, 0)
      expect(m!.toISOString()).toBe('2026-03-08T11:00:00.000Z')
    })

    it('pre-spring-forward (1 AM EST on 2026-03-08) → 06:00 UTC', () => {
      // 1:00 EST (UTC-5) = 06:00 UTC. Before the 02:00 jump.
      const event: EventForLabels = {
        mode: 'specific_dates',
        dates: ['2026-03-08'],
        timeRange: { start: 1, end: 2 },
        slotMinutes: 60,
        timezone: 'America/New_York',
      }
      const m = slotMomentInUTC(event, 0)
      expect(m!.toISOString()).toBe('2026-03-08T06:00:00.000Z')
    })

    it('fall-back boundary: NY event at 9 AM EST on 2026-11-01 → 14:00 UTC', () => {
      // 2026-11-01: NY transitions at 02:00 EDT → 01:00 EST. By 09:00 it's EST (UTC-5).
      const event: EventForLabels = {
        mode: 'specific_dates',
        dates: ['2026-11-01'],
        timeRange: { start: 9, end: 10 },
        slotMinutes: 60,
        timezone: 'America/New_York',
      }
      const m = slotMomentInUTC(event, 0)
      expect(m!.toISOString()).toBe('2026-11-01T14:00:00.000Z')
    })

    it('Sydney DST: event at 9 AM AEDT on 2026-01-15 → 22:00 UTC previous day', () => {
      // Sydney January is on AEDT (UTC+11). 9:00 AEDT = 22:00 UTC previous day (Jan 14).
      const event: EventForLabels = {
        mode: 'specific_dates',
        dates: ['2026-01-15'],
        timeRange: { start: 9, end: 10 },
        slotMinutes: 60,
        timezone: 'Australia/Sydney',
      }
      const m = slotMomentInUTC(event, 0)
      expect(m!.toISOString()).toBe('2026-01-14T22:00:00.000Z')
    })
  })
})
