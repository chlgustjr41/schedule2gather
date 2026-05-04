import { describe, it, expect } from 'vitest'
import { normalizeName } from '@/lib/nameNormalize'

describe('normalizeName', () => {
  it('lowercases ASCII', () => {
    expect(normalizeName('Alice')).toBe('alice')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  Alice  ')).toBe('alice')
  })

  it('collapses internal whitespace to single space', () => {
    expect(normalizeName('Alice    Smith')).toBe('alice smith')
  })

  it('handles tabs and newlines as whitespace', () => {
    expect(normalizeName('Alice\t\nSmith')).toBe('alice smith')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('')
  })

  it('handles unicode (Korean) without dropping characters', () => {
    expect(normalizeName('  최성준  ')).toBe('최성준')
  })

  it('handles mixed case unicode (German umlauts)', () => {
    expect(normalizeName('  Müller  ')).toBe('müller')
  })

  it('returns empty for empty input', () => {
    expect(normalizeName('')).toBe('')
  })
})
