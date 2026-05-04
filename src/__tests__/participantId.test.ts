import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadParticipantsForEvent,
  saveParticipantsForEvent,
  getOrCreateParticipantId,
  countNamesForEvent,
} from '@/lib/participantId'

describe('participantId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadParticipantsForEvent', () => {
    it('returns empty object when no entries', () => {
      expect(loadParticipantsForEvent('abc123')).toEqual({})
    })

    it('returns parsed map when entry exists', () => {
      localStorage.setItem(
        'mg:event:abc123:participants',
        JSON.stringify({ alice: 'uuid-1', bob: 'uuid-2' }),
      )
      expect(loadParticipantsForEvent('abc123')).toEqual({ alice: 'uuid-1', bob: 'uuid-2' })
    })

    it('returns empty object on corrupted JSON', () => {
      localStorage.setItem('mg:event:abc123:participants', '{not json')
      expect(loadParticipantsForEvent('abc123')).toEqual({})
    })
  })

  describe('saveParticipantsForEvent', () => {
    it('writes JSON to the right key', () => {
      saveParticipantsForEvent('xyz789', { alice: 'uuid-1' })
      expect(localStorage.getItem('mg:event:xyz789:participants')).toBe(
        JSON.stringify({ alice: 'uuid-1' }),
      )
    })
  })

  describe('countNamesForEvent', () => {
    it('returns 0 when no entries', () => {
      expect(countNamesForEvent('abc')).toBe(0)
    })

    it('returns count when entries exist', () => {
      saveParticipantsForEvent('abc', { alice: 'u1', bob: 'u2', carol: 'u3' })
      expect(countNamesForEvent('abc')).toBe(3)
    })
  })

  describe('getOrCreateParticipantId', () => {
    it('creates a new UUID for a new name', () => {
      const id = getOrCreateParticipantId('abc', 'Alice')
      expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/) // nanoid default 21 chars
    })

    it('returns the same UUID when called again with the same name', () => {
      const id1 = getOrCreateParticipantId('abc', 'Alice')
      const id2 = getOrCreateParticipantId('abc', 'Alice')
      expect(id1).toBe(id2)
    })

    it('treats names as case-insensitive (Alice and alice → same)', () => {
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
  })
})
