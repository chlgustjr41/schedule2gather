import { describe, it, expect } from 'vitest'
import { slotIndex, slotsPerDay, slotsPerEvent } from '@/lib/slots'

describe('slots', () => {
  describe('slotsPerDay', () => {
    it('30-minute slots from 9 to 17 → 16', () => {
      expect(slotsPerDay({ start: 9, end: 17 }, 30)).toBe(16)
    })

    it('60-minute slots from 0 to 24 → 24', () => {
      expect(slotsPerDay({ start: 0, end: 24 }, 60)).toBe(24)
    })

    it('15-minute slots from 8 to 12 → 16', () => {
      expect(slotsPerDay({ start: 8, end: 12 }, 15)).toBe(16)
    })

    it('15-minute slots single hour → 4', () => {
      expect(slotsPerDay({ start: 14, end: 15 }, 15)).toBe(4)
    })
  })

  describe('slotIndex', () => {
    it('day 0, time 0 → 0', () => {
      expect(slotIndex(0, 0, 16)).toBe(0)
    })

    it('day 0, time 5 → 5', () => {
      expect(slotIndex(0, 5, 16)).toBe(5)
    })

    it('day 1, time 0 → slotsPerDay', () => {
      expect(slotIndex(1, 0, 16)).toBe(16)
    })

    it('day 2, time 7, slotsPerDay 16 → 39', () => {
      expect(slotIndex(2, 7, 16)).toBe(39)
    })
  })

  describe('slotsPerEvent', () => {
    it('3 dates × 16 slots/day → 48', () => {
      expect(
        slotsPerEvent({
          dates: ['2026-05-05', '2026-05-06', '2026-05-07'],
          timeRange: { start: 9, end: 17 },
          slotMinutes: 30,
        }),
      ).toBe(48)
    })

    it('5 weekdays × 24 slots/day → 120', () => {
      expect(
        slotsPerEvent({
          dates: ['mon', 'tue', 'wed', 'thu', 'fri'],
          timeRange: { start: 0, end: 24 },
          slotMinutes: 60,
        }),
      ).toBe(120)
    })

    it('1 date × 4 slots/day → 4', () => {
      expect(
        slotsPerEvent({
          dates: ['2026-05-05'],
          timeRange: { start: 14, end: 15 },
          slotMinutes: 15,
        }),
      ).toBe(4)
    })
  })
})
