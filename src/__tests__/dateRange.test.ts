import { describe, expect, it } from 'vitest'
import { mergeRangeIntoDates, toggleDays } from '@/lib/dateRange'

const d = (s: string) => new Date(s + 'T00:00:00')

describe('mergeRangeIntoDates', () => {
  const today = d('2026-07-18')

  it('adds every day of the range in order', () => {
    const out = mergeRangeIntoDates([], d('2026-07-20'), d('2026-07-22'), today)
    expect(out.map((x) => x.getDate())).toEqual([20, 21, 22])
  })

  it('accepts reversed from/to', () => {
    const out = mergeRangeIntoDates([], d('2026-07-22'), d('2026-07-20'), today)
    expect(out.map((x) => x.getDate())).toEqual([20, 21, 22])
  })

  it('excludes days before today', () => {
    const out = mergeRangeIntoDates([], d('2026-07-16'), d('2026-07-19'), today)
    expect(out.map((x) => x.getDate())).toEqual([18, 19])
  })

  it('deduplicates against existing selection and preserves it', () => {
    const existing = [d('2026-07-21'), d('2026-07-30')]
    const out = mergeRangeIntoDates(existing, d('2026-07-20'), d('2026-07-22'), today)
    expect(out.map((x) => x.getDate())).toEqual([21, 30, 20, 22])
  })
})

describe('toggleDays', () => {
  it('adds candidates that are missing', () => {
    const out = toggleDays([d('2026-07-20')], [d('2026-07-20'), d('2026-07-27')])
    expect(out.map((x) => x.getDate()).sort((a, b) => a - b)).toEqual([20, 27])
  })
  it('removes all candidates when every one is present', () => {
    const out = toggleDays([d('2026-07-20'), d('2026-07-27'), d('2026-07-21')], [d('2026-07-20'), d('2026-07-27')])
    expect(out.map((x) => x.getDate())).toEqual([21])
  })
  it('no-ops on empty candidates', () => {
    const existing = [d('2026-07-20')]
    expect(toggleDays(existing, [])).toEqual(existing)
  })
  it('dedupes when adding', () => {
    const out = toggleDays([], [d('2026-07-20'), d('2026-07-20')])
    expect(out).toHaveLength(1)
  })
})
