import { describe, expect, it } from 'vitest'
import { normalizeCode } from '@/lib/joinCode'

describe('normalizeCode', () => {
  it('trims and lowercases bare codes', () => {
    expect(normalizeCode('  AbC123 ')).toBe('abc123')
  })
  it('extracts the slug from a pasted share URL', () => {
    expect(normalizeCode('http://localhost:5173/e/6w3wrh')).toBe('6w3wrh')
    expect(normalizeCode('https://schedule2gather.web.app/e/XY-9z?utm=1')).toBe('xy-9z')
  })
  it('strips invalid characters', () => {
    expect(normalizeCode('ab c!123')).toBe('abc123')
  })
  it('returns empty for empty/garbage input', () => {
    expect(normalizeCode('   ')).toBe('')
    expect(normalizeCode('!!!')).toBe('')
  })
})
