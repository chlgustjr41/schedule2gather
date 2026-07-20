import { describe, expect, it } from 'vitest'
import { hashPasscode, verifyPasscode } from '../lib/passcodeHash'

describe('passcodeHash', () => {
  it('round-trips a passcode', () => {
    const rec = hashPasscode('abc123')
    expect(verifyPasscode('abc123', rec)).toBe(true)
  })
  it('rejects a wrong passcode', () => {
    const rec = hashPasscode('abc123')
    expect(verifyPasscode('abc124', rec)).toBe(false)
  })
  it('produces different hashes for different salts', () => {
    const a = hashPasscode('abc123')
    const b = hashPasscode('abc123')
    expect(a.salt).not.toBe(b.salt)
    expect(a.passcodeHash).not.toBe(b.passcodeHash)
  })
  it('is deterministic for a fixed salt', () => {
    const a = hashPasscode('abc123', 'aa'.repeat(16))
    const b = hashPasscode('abc123', 'aa'.repeat(16))
    expect(a.passcodeHash).toBe(b.passcodeHash)
  })
  it('rejects tampered hashes', () => {
    const rec = hashPasscode('abc123')
    expect(verifyPasscode('abc123', { ...rec, passcodeHash: rec.passcodeHash.slice(0, -2) + '00' })).toBe(false)
  })
})
