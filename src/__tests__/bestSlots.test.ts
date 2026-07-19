import { describe, expect, it } from 'vitest'
import { pack } from '@/lib/bitmap'
import { bestWindows, type BestSlotsEvent } from '@/lib/bestSlots'

// 2 days × (9→12, 60-min slots) = 3 slots/day, 6 total.
// Slot layout: day0 = [0,1,2] (9a,10a,11a), day1 = [3,4,5].
const EVENT: BestSlotsEvent = {
  dates: ['2026-07-20', '2026-07-21'],
  timeRange: { start: 9, end: 12 },
  slotMinutes: 60,
  slotCount: 6,
}

const bits = (s: string) => pack([...s].map((c) => c === '1'))

describe('bestWindows', () => {
  it('returns [] when nobody painted', () => {
    expect(bestWindows(EVENT, [bits('000000'), ''])).toEqual([])
    expect(bestWindows(EVENT, [])).toEqual([])
  })

  it('ranks full-overlap window first with attendance = participant count', () => {
    const a = bits('011000')
    const b = bits('011100')
    const [top] = bestWindows(EVENT, [a, b])
    expect(top).toEqual({ startSlot: 1, endSlot: 2, attendance: 2, total: 2 })
  })

  it('prefers higher attendance over longer duration', () => {
    const a = bits('111000') // day0 all
    const b = bits('100000') // 9a only
    const wins = bestWindows(EVENT, [a, b])
    expect(wins[0]).toMatchObject({ startSlot: 0, endSlot: 0, attendance: 2 })
  })

  it('breaks attendance ties by longer duration, then earlier start', () => {
    const a = bits('110011')
    const wins = bestWindows(EVENT, [a])
    // runs at level 1: day0 [0,1] (len 2), day1 [4,5] (len 2) → earlier start wins first
    expect(wins[0]).toMatchObject({ startSlot: 0, endSlot: 1 })
    expect(wins[1]).toMatchObject({ startSlot: 4, endSlot: 5 })
  })

  it('never returns overlapping windows and caps at limit 3', () => {
    const a = bits('111111')
    const b = bits('111111')
    const c = bits('101010')
    const wins = bestWindows(EVENT, [a, b, c])
    expect(wins.length).toBeLessThanOrEqual(3)
    for (let i = 0; i < wins.length; i++) {
      for (let j = i + 1; j < wins.length; j++) {
        const overlap = wins[i].startSlot <= wins[j].endSlot && wins[j].startSlot <= wins[i].endSlot
        expect(overlap).toBe(false)
      }
    }
  })

  it('does not merge runs across day boundaries', () => {
    const a = bits('001100') // 11a day0 + 9a day1 — adjacent indices, different days
    const wins = bestWindows(EVENT, [a])
    expect(wins[0].endSlot - wins[0].startSlot).toBe(0)
  })
})
