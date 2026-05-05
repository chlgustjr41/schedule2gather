import { describe, it, expect } from 'vitest'
import {
  startOfWeekSunday,
  getWeekPages,
  getMonthPages,
  getVisibleColumns,
} from '@/lib/calendarPages'

describe('calendarPages', () => {
  describe('startOfWeekSunday', () => {
    it('returns Sunday for a Sunday', () => {
      // 2026-05-03 is a Sunday
      expect(startOfWeekSunday(new Date('2026-05-03T12:00:00'))).toEqual(
        new Date('2026-05-03T00:00:00'),
      )
    })

    it('returns previous Sunday for a Wednesday', () => {
      // 2026-05-06 is a Wednesday → previous Sunday is 2026-05-03
      expect(startOfWeekSunday(new Date('2026-05-06T12:00:00'))).toEqual(
        new Date('2026-05-03T00:00:00'),
      )
    })

    it('returns previous Sunday for a Saturday', () => {
      // 2026-05-09 is a Saturday → previous Sunday is 2026-05-03
      expect(startOfWeekSunday(new Date('2026-05-09T12:00:00'))).toEqual(
        new Date('2026-05-03T00:00:00'),
      )
    })
  })

  describe('getWeekPages', () => {
    it('returns [] for empty event dates', () => {
      expect(getWeekPages([])).toEqual([])
    })

    it('returns one page for dates within a single week', () => {
      // 2026-05-06 (Wed), 2026-05-08 (Fri) — both in same Sun-Sat week
      const pages = getWeekPages(['2026-05-06', '2026-05-08'])
      expect(pages).toHaveLength(1)
      expect(pages[0]).toEqual(new Date('2026-05-03T00:00:00'))
    })

    it('returns multiple pages for dates across weeks', () => {
      // 2026-05-06 (Wed) and 2026-05-20 (Wed) — three weeks
      const pages = getWeekPages(['2026-05-06', '2026-05-20'])
      expect(pages).toHaveLength(3)
      expect(pages[0]).toEqual(new Date('2026-05-03T00:00:00'))
      expect(pages[2]).toEqual(new Date('2026-05-17T00:00:00'))
    })

    it('produces contiguous weeks even when middle weeks have no event dates', () => {
      // 2026-05-06 (week 1) and 2026-05-27 (week 4) — should produce 4 pages
      const pages = getWeekPages(['2026-05-06', '2026-05-27'])
      expect(pages).toHaveLength(4)
    })
  })

  describe('getMonthPages', () => {
    it('returns [] for empty event dates', () => {
      expect(getMonthPages([])).toEqual([])
    })

    it('returns one page for single-month event', () => {
      const pages = getMonthPages(['2026-05-06', '2026-05-20'])
      expect(pages).toHaveLength(1)
      expect(pages[0]).toEqual(new Date(2026, 4, 1))
    })

    it('returns multiple pages for multi-month event', () => {
      // 2026-05-06 → 2026-07-15: May, June, July = 3 pages
      const pages = getMonthPages(['2026-05-06', '2026-07-15'])
      expect(pages).toHaveLength(3)
      expect(pages[0]).toEqual(new Date(2026, 4, 1))
      expect(pages[1]).toEqual(new Date(2026, 5, 1))
      expect(pages[2]).toEqual(new Date(2026, 6, 1))
    })
  })

  describe('getVisibleColumns', () => {
    describe('week mode', () => {
      it('returns 7 columns Sun-Sat', () => {
        const cols = getVisibleColumns(
          new Date('2026-05-03T00:00:00'),
          'week',
          ['2026-05-06', '2026-05-08'],
        )
        expect(cols).toHaveLength(7)
        expect(cols[0].dateStr).toBe('2026-05-03')
        expect(cols[6].dateStr).toBe('2026-05-09')
      })

      it('marks event dates with their event.dates index', () => {
        const cols = getVisibleColumns(
          new Date('2026-05-03T00:00:00'),
          'week',
          ['2026-05-06', '2026-05-08'],
        )
        expect(cols[3].eventDateIdx).toBe(0) // Wed = '2026-05-06' = event.dates[0]
        expect(cols[5].eventDateIdx).toBe(1) // Fri = '2026-05-08' = event.dates[1]
      })

      it('marks out-of-range dates with -1', () => {
        const cols = getVisibleColumns(
          new Date('2026-05-03T00:00:00'),
          'week',
          ['2026-05-06', '2026-05-08'],
        )
        expect(cols[0].eventDateIdx).toBe(-1) // Sun
        expect(cols[1].eventDateIdx).toBe(-1) // Mon
        expect(cols[2].eventDateIdx).toBe(-1) // Tue
        expect(cols[4].eventDateIdx).toBe(-1) // Thu
        expect(cols[6].eventDateIdx).toBe(-1) // Sat
      })
    })

    describe('month mode', () => {
      it('returns all days of the calendar month', () => {
        // May 2026 has 31 days
        const cols = getVisibleColumns(
          new Date(2026, 4, 1),
          'month',
          ['2026-05-15'],
        )
        expect(cols).toHaveLength(31)
        expect(cols[0].dateStr).toBe('2026-05-01')
        expect(cols[30].dateStr).toBe('2026-05-31')
      })

      it('returns 28 days for non-leap February', () => {
        const cols = getVisibleColumns(
          new Date(2026, 1, 1), // Feb 2026
          'month',
          [],
        )
        expect(cols).toHaveLength(28)
      })

      it('marks event dates with their index', () => {
        const cols = getVisibleColumns(
          new Date(2026, 4, 1),
          'month',
          ['2026-05-06', '2026-05-20'],
        )
        expect(cols[5].eventDateIdx).toBe(0) // May 6
        expect(cols[19].eventDateIdx).toBe(1) // May 20
      })
    })
  })
})
