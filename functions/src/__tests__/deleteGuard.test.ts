import { describe, expect, it } from 'vitest'
import { assertDeletable } from '../lib/deleteGuard'

describe('assertDeletable', () => {
  it('rejects missing auth', () => {
    expect(assertDeletable({ ownerUid: 'a' }, undefined)).toBe('unauthenticated')
  })
  it('rejects missing event', () => {
    expect(assertDeletable(undefined, 'a')).toBe('not-found')
  })
  it('rejects non-owner', () => {
    expect(assertDeletable({ ownerUid: 'a' }, 'b')).toBe('permission-denied')
  })
  it('allows the owner', () => {
    expect(assertDeletable({ ownerUid: 'a' }, 'a')).toBe('ok')
  })
})
