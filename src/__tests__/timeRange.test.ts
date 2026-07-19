import { describe, expect, it } from 'vitest'
import { clampTimeRange } from '@/lib/timeRange'

describe('clampTimeRange', () => {
  it('returns a valid range untouched', () => {
    expect(clampTimeRange(9, 21, 'start')).toEqual({ start: 9, end: 21 })
  })
  it('pushes end up when start crosses it', () => {
    expect(clampTimeRange(21, 21, 'start')).toEqual({ start: 21, end: 22 })
    expect(clampTimeRange(23, 10, 'start')).toEqual({ start: 23, end: 24 })
  })
  it('pushes start down when end crosses it', () => {
    expect(clampTimeRange(9, 9, 'end')).toEqual({ start: 8, end: 9 })
    expect(clampTimeRange(15, 1, 'end')).toEqual({ start: 0, end: 1 })
  })
  it('clamps out-of-bounds inputs', () => {
    expect(clampTimeRange(-2, 30, 'start')).toEqual({ start: 0, end: 24 })
  })
  it('always yields start < end within 0..24', () => {
    for (let s = -1; s <= 25; s++) {
      for (const changed of ['start', 'end'] as const) {
        const r = clampTimeRange(s, s, changed)
        expect(r.start).toBeLessThan(r.end)
        expect(r.start).toBeGreaterThanOrEqual(0)
        expect(r.end).toBeLessThanOrEqual(24)
      }
    }
  })
})
