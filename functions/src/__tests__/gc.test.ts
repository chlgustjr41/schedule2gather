import { describe, expect, it } from 'vitest'
import { IDLE_MS, shouldDeleteEvent, type GcEvent } from '../lib/gc'

const DAY = 24 * 60 * 60 * 1000
const ts = (ms: number) => ({ toMillis: () => ms })
const NOW = Date.parse('2026-07-18T12:00:00Z')

const base = (over: Partial<GcEvent>): GcEvent => ({
  mode: 'specific_dates',
  dates: ['2026-06-01', '2026-06-02'],
  createdAt: ts(NOW - 40 * DAY),
  expiresAt: ts(NOW + 50 * DAY),
  lastVisitedAt: null,
  ...over,
})

describe('shouldDeleteEvent', () => {
  it('deletes past the hard cap regardless of visits', () => {
    expect(shouldDeleteEvent(base({ expiresAt: ts(NOW - 1), lastVisitedAt: ts(NOW) }), NOW)).toBe(true)
  })

  it('deletes when all dates passed and idle > 30 days (createdAt fallback)', () => {
    expect(shouldDeleteEvent(base({}), NOW)).toBe(true)
  })

  it('keeps when all dates passed but visited recently', () => {
    expect(shouldDeleteEvent(base({ lastVisitedAt: ts(NOW - 5 * DAY) }), NOW)).toBe(false)
  })

  it('keeps when idle but a date is still upcoming', () => {
    expect(shouldDeleteEvent(base({ dates: ['2026-06-01', '2026-08-01'] }), NOW)).toBe(false)
  })

  it('keeps when the last date is today (not fully passed)', () => {
    expect(shouldDeleteEvent(base({ dates: ['2026-07-18'] }), NOW)).toBe(false)
  })

  it('weekdays_recurring uses the hard cap only', () => {
    expect(shouldDeleteEvent(base({ mode: 'weekdays_recurring', dates: ['mon', 'tue'] }), NOW)).toBe(false)
  })

  it('exposes the 30-day idle constant', () => {
    expect(IDLE_MS).toBe(30 * DAY)
  })
})
