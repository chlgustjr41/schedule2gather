import { describe, expect, it } from 'vitest'
import { clampTimeRange } from '@/lib/timeRange'

describe('clampTimeRange', () => {
  it('returns a valid range untouched', () => {
    expect(clampTimeRange(540, 1260, 'start', 30)).toEqual({ start: 540, end: 1260 })
  })
  it('pushes end up when start crosses it', () => {
    expect(clampTimeRange(1260, 1260, 'start', 30)).toEqual({ start: 1260, end: 1290 })
    expect(clampTimeRange(1410, 600, 'start', 30)).toEqual({ start: 1410, end: 1440 })
  })
  it('pushes start down when end crosses it', () => {
    expect(clampTimeRange(540, 540, 'end', 30)).toEqual({ start: 510, end: 540 })
    expect(clampTimeRange(900, 30, 'end', 30)).toEqual({ start: 0, end: 30 })
  })
  it('clamps out-of-bounds inputs', () => {
    expect(clampTimeRange(-120, 1800, 'start', 30)).toEqual({ start: 0, end: 1440 })
  })
  it('snaps to the given step', () => {
    expect(clampTimeRange(547, 1263, 'start', 15)).toEqual({ start: 540, end: 1260 })
    expect(clampTimeRange(553, 1268, 'start', 15)).toEqual({ start: 555, end: 1275 })
  })
  it('always yields start < end within 0..1440 for any step', () => {
    for (const step of [15, 30, 60] as const) {
      for (let s = -30; s <= 1470; s += 30) {
        for (const changed of ['start', 'end'] as const) {
          const r = clampTimeRange(s, s, changed, step)
          expect(r.start).toBeLessThan(r.end)
          expect(r.start).toBeGreaterThanOrEqual(0)
          expect(r.end).toBeLessThanOrEqual(1440)
          expect(r.start % step).toBe(0)
          expect(r.end % step).toBe(0)
        }
      }
    }
  })
})
