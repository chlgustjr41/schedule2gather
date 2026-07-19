import { describe, expect, it } from 'vitest'
import { decideClaim, decideCreate, normalizeName } from '../lib/joinLogic'

describe('normalizeName', () => {
  it('lowercases, trims, collapses whitespace', () => {
    expect(normalizeName('  Sam   Lee ')).toBe('sam lee')
  })
})

describe('decideCreate', () => {
  const existing = [{ participantId: 'p1', name: 'Sam Lee' }]
  it('rejects when finalized', () => {
    expect(decideCreate(true, 'New', existing)).toEqual({ kind: 'closed' })
  })
  it('detects duplicates case/space-insensitively', () => {
    expect(decideCreate(false, ' sam  lee ', existing)).toEqual({ kind: 'duplicate', participantId: 'p1' })
  })
  it('allows fresh names', () => {
    expect(decideCreate(false, 'Riley', existing)).toEqual({ kind: 'create' })
  })
})

describe('decideClaim', () => {
  it('rejects when finalized', () => {
    expect(decideClaim(true, true, false)).toEqual({ kind: 'closed' })
  })
  it('rejects missing participants', () => {
    expect(decideClaim(false, false, false)).toEqual({ kind: 'missing' })
  })
  it('distinguishes open vs protected claims', () => {
    expect(decideClaim(false, true, false)).toEqual({ kind: 'claim-open' })
    expect(decideClaim(false, true, true)).toEqual({ kind: 'claim-protected' })
  })
})
