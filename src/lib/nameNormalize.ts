/**
 * Normalize a participant name for use as a localStorage key:
 * - lowercase
 * - trim leading/trailing whitespace
 * - collapse internal whitespace runs to a single space
 *
 * Preserves all unicode (does not strip non-ASCII).
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}
