import { describe, it, expect } from 'vitest'
import { validateCreateEventInput, ValidationError } from '../lib/validate'

const validSpecificDates = {
  name: 'Test Event',
  mode: 'specific_dates' as const,
  dates: ['2026-05-05', '2026-05-06'],
  timeRange: { start: 9, end: 17 },
  slotMinutes: 30 as const,
  timezone: 'America/New_York',
}

const validRecurring = {
  name: 'Weekly Standup',
  mode: 'weekdays_recurring' as const,
  dates: ['mon', 'wed', 'fri'],
  timeRange: { start: 9, end: 10 },
  slotMinutes: 15 as const,
  timezone: 'UTC',
}

describe('validateCreateEventInput', () => {
  describe('valid inputs', () => {
    it('accepts specific_dates input', () => {
      expect(() => validateCreateEventInput(validSpecificDates)).not.toThrow()
    })

    it('accepts weekdays_recurring input', () => {
      expect(() => validateCreateEventInput(validRecurring)).not.toThrow()
    })

    it('accepts weekdays_in_range input', () => {
      expect(() =>
        validateCreateEventInput({
          ...validSpecificDates,
          mode: 'weekdays_in_range',
        }),
      ).not.toThrow()
    })
  })

  describe('name validation', () => {
    it('rejects empty name', () => {
      expect(() => validateCreateEventInput({ ...validSpecificDates, name: '' })).toThrow(
        ValidationError,
      )
    })

    it('rejects whitespace-only name', () => {
      expect(() => validateCreateEventInput({ ...validSpecificDates, name: '   ' })).toThrow(
        ValidationError,
      )
    })

    it('rejects name >80 chars', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, name: 'a'.repeat(81) }),
      ).toThrow(ValidationError)
    })

    it('accepts name = 80 chars', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, name: 'a'.repeat(80) }),
      ).not.toThrow()
    })

    it('rejects non-string name', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, name: 123 as unknown as string }),
      ).toThrow(ValidationError)
    })
  })

  describe('mode validation', () => {
    it('rejects unknown mode', () => {
      expect(() =>
        validateCreateEventInput({
          ...validSpecificDates,
          mode: 'unknown' as 'specific_dates',
        }),
      ).toThrow(ValidationError)
    })
  })

  describe('dates validation', () => {
    it('rejects empty dates array', () => {
      expect(() => validateCreateEventInput({ ...validSpecificDates, dates: [] })).toThrow(
        ValidationError,
      )
    })

    it('rejects > 60 dates', () => {
      const manyDates = Array.from({ length: 61 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`)
      expect(() => validateCreateEventInput({ ...validSpecificDates, dates: manyDates })).toThrow(
        ValidationError,
      )
    })

    it('rejects bad date format in specific_dates', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, dates: ['not-a-date'] }),
      ).toThrow(ValidationError)
    })

    it('rejects weekday name in specific_dates', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, dates: ['mon'] }),
      ).toThrow(ValidationError)
    })

    it('rejects ISO date in weekdays_recurring', () => {
      expect(() =>
        validateCreateEventInput({ ...validRecurring, dates: ['2026-05-05'] }),
      ).toThrow(ValidationError)
    })

    it('rejects unknown weekday in weekdays_recurring', () => {
      expect(() =>
        validateCreateEventInput({ ...validRecurring, dates: ['xyz'] }),
      ).toThrow(ValidationError)
    })
  })

  describe('timeRange validation', () => {
    it('rejects start >= end', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: 10, end: 10 } }),
      ).toThrow(ValidationError)
    })

    it('rejects start < 0', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: -1, end: 17 } }),
      ).toThrow(ValidationError)
    })

    it('rejects end > 24', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: 9, end: 25 } }),
      ).toThrow(ValidationError)
    })

    it('rejects non-integer hours', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timeRange: { start: 9.5, end: 17 } }),
      ).toThrow(ValidationError)
    })
  })

  describe('slotMinutes validation', () => {
    it('rejects 10 minutes', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, slotMinutes: 10 as 15 }),
      ).toThrow(ValidationError)
    })

    it('accepts 15, 30, 60', () => {
      ;[15, 30, 60].forEach((sm) => {
        expect(() =>
          validateCreateEventInput({ ...validSpecificDates, slotMinutes: sm as 15 | 30 | 60 }),
        ).not.toThrow()
      })
    })
  })

  describe('timezone validation', () => {
    it('rejects invalid IANA name', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timezone: 'NotARealZone' }),
      ).toThrow(ValidationError)
    })

    it('accepts UTC', () => {
      expect(() =>
        validateCreateEventInput({ ...validSpecificDates, timezone: 'UTC' }),
      ).not.toThrow()
    })
  })

  describe('slotCount cap', () => {
    it('rejects when slotCount > 5000', () => {
      // 60 dates × 24 hours × 4 (15-min) = 5760 slots
      const manyDates = Array.from({ length: 60 }, (_, i) => `2026-05-${String((i % 28) + 1).padStart(2, '0')}`)
      expect(() =>
        validateCreateEventInput({
          ...validSpecificDates,
          dates: manyDates,
          timeRange: { start: 0, end: 24 },
          slotMinutes: 15,
        }),
      ).toThrow(ValidationError)
    })
  })
})
