import { customAlphabet } from 'nanoid'

export const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
export const SLUG_LENGTH = 6

const generator = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH)

/**
 * Mint a 6-character slug from a 32-character look-alike-free alphabet.
 * 32^6 ≈ 1 billion combinations.
 */
export function mintSlug(): string {
  return generator()
}
