import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadParticipantsForEvent,
  saveParticipantsForEvent,
  getOrCreateParticipantId,
  countNamesForEvent,
  type ParticipantMap,
} from '@/lib/participantId'

describe('participantId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadParticipantsForEvent', () => {
    it('returns empty object when no entries', () => {
      expect(loadParticipantsForEvent('abc123')).toEqual({})
    })

    it('returns parsed map when new-shape entry exists', () => {
      const stored: ParticipantMap = {
        alice: { id: 'uuid-1', rawName: 'Alice' },
        bob: { id: 'uuid-2', rawName: 'Bob' },
      }
      localStorage.setItem('mg:event:abc123:participants', JSON.stringify(stored))
      expect(loadParticipantsForEvent('abc123')).toEqual(stored)
    })

    it('handles legacy string-only shape (pre-P2-A2 entries)', () => {
      // Old shape: { [normalizedName]: uuid }
      localStorage.setItem(
        'mg:event:abc123:participants',
        JSON.stringify({ alice: 'uuid-1', bob: 'uuid-2' }),
      )
      expect(loadParticipantsForEvent('abc123')).toEqual({
        alice: { id: 'uuid-1', rawName: '' },
        bob: { id: 'uuid-2', rawName: '' },
      })
    })

    it('handles a mixed-shape map (one new, one legacy)', () => {
      localStorage.setItem(
        'mg:event:abc123:participants',
        JSON.stringify({
          alice: { id: 'uuid-1', rawName: 'Alice' },
          bob: 'uuid-2',
        }),
      )
      expect(loadParticipantsForEvent('abc123')).toEqual({
        alice: { id: 'uuid-1', rawName: 'Alice' },
        bob: { id: 'uuid-2', rawName: '' },
      })
    })

    it('returns empty object on corrupted JSON', () => {
      localStorage.setItem('mg:event:abc123:participants', '{not json')
      expect(loadParticipantsForEvent('abc123')).toEqual({})
    })

    it('drops entries with malformed values (e.g., numbers, arrays)', () => {
      localStorage.setItem(
        'mg:event:abc123:participants',
        JSON.stringify({
          alice: { id: 'uuid-1', rawName: 'Alice' },
          weird: 12345,
          alsoBad: ['x'],
          partial: { id: 'no-rawname' },
        }),
      )
      expect(loadParticipantsForEvent('abc123')).toEqual({
        alice: { id: 'uuid-1', rawName: 'Alice' },
      })
    })
  })

  describe('saveParticipantsForEvent', () => {
    it('writes JSON to the right key', () => {
      const map: ParticipantMap = { alice: { id: 'uuid-1', rawName: 'Alice' } }
      saveParticipantsForEvent('xyz789', map)
      expect(localStorage.getItem('mg:event:xyz789:participants')).toBe(JSON.stringify(map))
    })
  })

  describe('countNamesForEvent', () => {
    it('returns 0 when no entries', () => {
      expect(countNamesForEvent('abc')).toBe(0)
    })

    it('returns count when entries exist', () => {
      saveParticipantsForEvent('abc', {
        alice: { id: 'u1', rawName: 'Alice' },
        bob: { id: 'u2', rawName: 'Bob' },
        carol: { id: 'u3', rawName: 'Carol' },
      })
      expect(countNamesForEvent('abc')).toBe(3)
    })
  })

  describe('getOrCreateParticipantId', () => {
    it('creates a new UUID for a new name', () => {
      const id = getOrCreateParticipantId('abc', 'Alice')
      expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/)
    })

    it('preserves the original-cased trimmed name in storage', () => {
      getOrCreateParticipantId('abc', '  Alice  ')
      const map = loadParticipantsForEvent('abc')
      expect(map.alice.rawName).toBe('Alice')
    })

    it('returns the same UUID when called again with the same name', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'Alice')
      expect(id1).toBe(id2)
    })

    it('treats names as case-insensitive (Alice and alice → same UUID)', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'alice')
      expect(id1).toBe(id2)
    })

    it('treats trimmed and untrimmed names as same identity', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', '  Alice  ')
      expect(id1).toBe(id2)
    })

    it('different names → different UUIDs', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'Bob')
      expect(id1).not.toBe(id2)
    })

    it('different events → independent UUID space', () => {
      const id1 = getOrCreateParticipantId('event-1', 'Alice')
      const id2 = getOrCreateParticipantId('event-2', 'Alice')
      expect(id1).not.toBe(id2)
    })

    it('lazily fills in rawName for legacy entries', () => {
      // Pre-existing legacy entry without rawName
      localStorage.setItem(
        'mg:event:abc:participants',
        JSON.stringify({ alice: 'legacy-uuid' }),
      )
      // Calling getOrCreateParticipantId should preserve the existing UUID and fill in rawName
      const id = getOrCreateParticipantId('abc', 'Alice')
      expect(id).toBe('legacy-uuid')
      const map = loadParticipantsForEvent('abc')
      expect(map.alice).toEqual({ id: 'legacy-uuid', rawName: 'Alice' })
    })
  })
})
