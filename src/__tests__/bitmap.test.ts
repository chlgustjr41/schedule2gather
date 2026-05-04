import { describe, it, expect } from 'vitest'
import { pack, unpack, getBit, setBit, setRectangle } from '@/lib/bitmap'

describe('bitmap', () => {
  describe('pack / unpack roundtrip', () => {
    it('roundtrips empty array', () => {
      expect(unpack(pack([]), 0)).toEqual([])
    })

    it('roundtrips single false', () => {
      expect(unpack(pack([false]), 1)).toEqual([false])
    })

    it('roundtrips single true', () => {
      expect(unpack(pack([true]), 1)).toEqual([true])
    })

    it('roundtrips length 8 (one full byte)', () => {
      const bits = [true, false, true, false, true, false, true, false]
      expect(unpack(pack(bits), 8)).toEqual(bits)
    })

    it('roundtrips length 9 (overflows into second byte)', () => {
      const bits = [true, false, true, false, true, false, true, false, true]
      expect(unpack(pack(bits), 9)).toEqual(bits)
    })

    it('roundtrips length 63', () => {
      const bits = Array.from({ length: 63 }, (_, i) => i % 3 === 0)
      expect(unpack(pack(bits), 63)).toEqual(bits)
    })

    it('roundtrips length 8000', () => {
      const bits = Array.from({ length: 8000 }, (_, i) => i % 7 === 0)
      expect(unpack(pack(bits), 8000)).toEqual(bits)
    })

    it('uses MSB-first within byte', () => {
      // bit 0 should be at position 7 of byte 0 (i.e., MSB)
      // pack([true]) → byte[0] = 0b10000000 = 0x80 → base64('gA==')
      expect(pack([true])).toBe('gA==')
      // pack([false, true, false, false, false, false, false, false]) → 0b01000000 = 0x40 → 'QA=='
      expect(pack([false, true, false, false, false, false, false, false])).toBe('QA==')
    })
  })

  describe('getBit', () => {
    it('reads bit 0 of single-true', () => {
      expect(getBit(pack([true]), 0)).toBe(true)
    })

    it('reads bit 0 of single-false', () => {
      expect(getBit(pack([false]), 0)).toBe(false)
    })

    it('reads bits 0-8 of mixed pattern', () => {
      const bits = [true, false, true, true, false, false, false, true, true]
      const encoded = pack(bits)
      bits.forEach((expected, idx) => {
        expect(getBit(encoded, idx)).toBe(expected)
      })
    })
  })

  describe('setBit', () => {
    it('sets bit 0 to true on empty (length 1)', () => {
      const result = setBit(pack([false]), 0, true, 1)
      expect(unpack(result, 1)).toEqual([true])
    })

    it('sets bit 0 to false on existing-true', () => {
      const result = setBit(pack([true]), 0, false, 1)
      expect(unpack(result, 1)).toEqual([false])
    })

    it('sets middle bit without disturbing neighbors', () => {
      const start = [true, true, true, true, true, true, true, true, true, true]
      const result = setBit(pack(start), 5, false, 10)
      const expected = [...start]
      expected[5] = false
      expect(unpack(result, 10)).toEqual(expected)
    })

    it('sets bit across byte boundary (idx 8)', () => {
      const start = Array(16).fill(false)
      const result = setBit(pack(start), 8, true, 16)
      const expected = [...start]
      expected[8] = true
      expect(unpack(result, 16)).toEqual(expected)
    })
  })

  describe('setRectangle', () => {
    // For a 3-day × 4-slots-per-day grid (slotsPerDay=4):
    // slotIndex layout (dateIdx * slotsPerDay + timeIdx):
    //  day0: [0, 1, 2, 3]
    //  day1: [4, 5, 6, 7]
    //  day2: [8, 9, 10, 11]

    it('single cell (from === to)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 5, 5, true, 4)
      const expected = [...start]
      expected[5] = true
      expect(result).toEqual(expected)
    })

    it('horizontal line within one day (from=4, to=7, day1 all slots)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 4, 7, true, 4)
      const expected = [...start]
      ;[4, 5, 6, 7].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('vertical line across days (from=1 to=9, all timeIdx=1 across day0,1,2)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 1, 9, true, 4)
      const expected = [...start]
      ;[1, 5, 9].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('rectangle 2x2 (from=1 to=6 → day0-day1, time1-time2)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 1, 6, true, 4)
      const expected = [...start]
      ;[1, 2, 5, 6].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('rectangle handles reversed corners (from=6 to=1, same as 1 to 6)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 6, 1, true, 4)
      const expected = [...start]
      ;[1, 2, 5, 6].forEach((i) => (expected[i] = true))
      expect(result).toEqual(expected)
    })

    it('full grid (from=0 to=11)', () => {
      const start = Array(12).fill(false)
      const result = setRectangle(start, 0, 11, true, 4)
      expect(result).toEqual(Array(12).fill(true))
    })

    it('clears with value=false', () => {
      const start = Array(12).fill(true)
      const result = setRectangle(start, 1, 6, false, 4)
      const expected = [...start]
      ;[1, 2, 5, 6].forEach((i) => (expected[i] = false))
      expect(result).toEqual(expected)
    })

    it('does not mutate input', () => {
      const start = Array(12).fill(false)
      const startCopy = [...start]
      setRectangle(start, 1, 6, true, 4)
      expect(start).toEqual(startCopy)
    })
  })
})
