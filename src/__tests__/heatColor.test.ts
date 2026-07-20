import { describe, expect, it } from 'vitest'
import { heatColor, mineColor } from '@/lib/heatColor'

describe('heatColor', () => {
  it('returns slot-empty for zero count or zero total', () => {
    expect(heatColor(0, 5)).toBe('var(--s2g-slot-empty)')
    expect(heatColor(0, 0)).toBe('var(--s2g-slot-empty)')
  })
  it('buckets fractions of max into 4 levels', () => {
    expect(heatColor(1, 8)).toBe('var(--s2g-heat-1)')
    expect(heatColor(4, 8)).toBe('var(--s2g-heat-2)')
    expect(heatColor(6, 8)).toBe('var(--s2g-heat-3)')
    expect(heatColor(8, 8)).toBe('var(--s2g-heat-4)')
  })
})

describe('mineColor', () => {
  it('maps painted/empty', () => {
    expect(mineColor(true)).toBe('var(--s2g-mine)')
    expect(mineColor(false)).toBe('var(--s2g-slot-empty)')
  })

  it('shows the danger color for painted cells in "not available" mode', () => {
    expect(mineColor(true, true)).toBe('var(--s2g-danger)')
    // Unpainted cells look the same regardless of mode.
    expect(mineColor(false, true)).toBe('var(--s2g-slot-empty)')
  })
})
