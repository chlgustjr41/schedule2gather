import { nanoid } from 'nanoid'
import { normalizeName } from '@/lib/nameNormalize'

const KEY_PREFIX = 'mg:event:'
const KEY_SUFFIX = ':participants'

function key(slug: string): string {
  return `${KEY_PREFIX}${slug}${KEY_SUFFIX}`
}

export function loadParticipantsForEvent(slug: string): Record<string, string> {
  const raw = localStorage.getItem(key(slug))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

export function saveParticipantsForEvent(slug: string, map: Record<string, string>): void {
  localStorage.setItem(key(slug), JSON.stringify(map))
}

export function countNamesForEvent(slug: string): number {
  return Object.keys(loadParticipantsForEvent(slug)).length
}

/**
 * Returns the UUID for (slug, name). Creates and stores a new UUID if absent.
 * Names are normalized (lowercase + trimmed + collapsed whitespace) for keying.
 */
export function getOrCreateParticipantId(slug: string, name: string): string {
  const map = loadParticipantsForEvent(slug)
  const normalized = normalizeName(name)
  if (map[normalized]) {
    return map[normalized]
  }
  const id = nanoid()
  map[normalized] = id
  saveParticipantsForEvent(slug, map)
  return id
}
