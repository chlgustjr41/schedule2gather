import { describe, it, expect } from 'vitest'
import { mintSlug, SLUG_ALPHABET, SLUG_LENGTH } from '../lib/slug'

describe('slug', () => {
  describe('alphabet', () => {
    it('is 32 chars with no look-alikes', () => {
      expect(SLUG_ALPHABET).toBe('abcdefghijkmnpqrstuvwxyz23456789')
      expect(SLUG_ALPHABET.length).toBe(32)
      // No 0, o, O, 1, l, I in alphabet
      ;['0', 'o', 'O', '1', 'l', 'I'].forEach((c) => {
        expect(SLUG_ALPHABET).not.toContain(c)
      })
    })
  })

  describe('SLUG_LENGTH', () => {
    it('is 6', () => {
      expect(SLUG_LENGTH).toBe(6)
    })
  })

  describe('mintSlug', () => {
    it('returns a 6-char string from the alphabet', () => {
      const slug = mintSlug()
      expect(slug.length).toBe(6)
      for (const c of slug) {
        expect(SLUG_ALPHABET).toContain(c)
      }
    })

    it('produces different slugs across many calls (sanity)', () => {
      const slugs = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        slugs.add(mintSlug())
      }
      // 32^6 = ~1B; 1000 calls almost certainly all unique
      expect(slugs.size).toBe(1000)
    })
  })
})
