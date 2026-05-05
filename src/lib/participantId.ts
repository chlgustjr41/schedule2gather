import { nanoid } from 'nanoid'
import { normalizeName } from '@/lib/nameNormalize'

const KEY_PREFIX = 'mg:event:'
const KEY_SUFFIX = ':participants'

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}${KEY_SUFFIX}`
}

export interface StoredParticipant {
  id: string
  rawName: string
}

export type ParticipantMap = Record<string, StoredParticipant>

/**
 * Parse a stored entry, accepting both the old shape (string UUID) and the new shape ({id, rawName}).
 * Returns null for unrecognized shapes.
 */
function parseEntry(value: unknown): StoredParticipant | null {
  if (typeof value === 'string') {
    // Old shape: pre-P2-A2 entries had just a UUID. rawName isn't recoverable; leave empty.
    return { id: value, rawName: '' }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>
    if (typeof v.id === 'string' && typeof v.rawName === 'string') {
      return { id: v.id, rawName: v.rawName }
    }
  }
  return null
}

export function loadParticipantsForEvent(slug: string): ParticipantMap {
  const raw = localStorage.getItem(key(slug))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: ParticipantMap = {}
    for (const [k, v] of Object.entries(parsed)) {
      const entry = parseEntry(v)
      if (entry) result[k] = entry
    }
    return result
  } catch {
    return {}
  }
}

export function saveParticipantsForEvent(slug: string, map: ParticipantMap): void {
  localStorage.setItem(key(slug), JSON.stringify(map))
}

export function countNamesForEvent(slug: string): number {
  return Object.keys(loadParticipantsForEvent(slug)).length
}

/**
 * Returns the UUID for (slug, name). Creates and stores a new entry if absent.
 * Names are normalized (lowercase + trimmed + collapsed whitespace) for keying.
 * The original-cased trimmed name is preserved alongside as `rawName`.
 *
 * For old-shape entries (rawName === ''), this lazily updates the rawName to the
 * freshly-provided name so subsequent auto-rejoins restore the correct casing.
 */
export function getOrCreateParticipantId(slug: string, name: string): string {
  const map = loadParticipantsForEvent(slug)
  const normalized = normalizeName(name)
  const trimmed = name.trim()
  const existing = map[normalized]
  if (existing) {
    if (!existing.rawName && trimmed) {
      map[normalized] = { ...existing, rawName: trimmed }
      saveParticipantsForEvent(slug, map)
    }
    return existing.id
  }
  const id = nanoid()
  map[normalized] = { id, rawName: trimmed }
  saveParticipantsForEvent(slug, map)
  return id
}
