/**
 * Pack an array of booleans into a base64-encoded bitmap.
 * MSB-first within each byte. Trailing pad bits are 0.
 */
export function pack(bits: boolean[]): string {
  const byteCount = Math.ceil(bits.length / 8)
  const bytes = new Uint8Array(byteCount)
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      const byteIdx = Math.floor(i / 8)
      const bitPos = 7 - (i % 8)
      bytes[byteIdx] |= 1 << bitPos
    }
  }
  return uint8ToBase64(bytes)
}

/**
 * Unpack a base64-encoded bitmap into an array of booleans of the given length.
 */
export function unpack(encoded: string, length: number): boolean[] {
  if (length === 0) return []
  const bytes = base64ToUint8(encoded)
  const bits: boolean[] = new Array(length)
  for (let i = 0; i < length; i++) {
    const byteIdx = Math.floor(i / 8)
    const bitPos = 7 - (i % 8)
    bits[i] = (bytes[byteIdx] & (1 << bitPos)) !== 0
  }
  return bits
}

export function getBit(encoded: string, idx: number): boolean {
  const bytes = base64ToUint8(encoded)
  const byteIdx = Math.floor(idx / 8)
  const bitPos = 7 - (idx % 8)
  return (bytes[byteIdx] & (1 << bitPos)) !== 0
}

export function setBit(encoded: string, idx: number, value: boolean, length: number): string {
  const bits = unpack(encoded, length)
  bits[idx] = value
  return pack(bits)
}

/**
 * Fill a rectangle in the bit grid between fromIdx and toIdx (inclusive).
 * The rectangle spans dateIndices [min(fromDate, toDate), max(...)] and
 * timeIndices [min(fromTime, toTime), max(...)] where indices decompose as
 * dateIdx = floor(slotIdx / slotsPerDay), timeIdx = slotIdx % slotsPerDay.
 *
 * Pure: returns a new array, does not mutate `bits`.
 */
export function setRectangle(
  bits: boolean[],
  fromIdx: number,
  toIdx: number,
  value: boolean,
  slotsPerDay: number,
): boolean[] {
  const fromDate = Math.floor(fromIdx / slotsPerDay)
  const fromTime = fromIdx % slotsPerDay
  const toDate = Math.floor(toIdx / slotsPerDay)
  const toTime = toIdx % slotsPerDay

  const minDate = Math.min(fromDate, toDate)
  const maxDate = Math.max(fromDate, toDate)
  const minTime = Math.min(fromTime, toTime)
  const maxTime = Math.max(fromTime, toTime)

  const result = [...bits]
  for (let d = minDate; d <= maxDate; d++) {
    for (let t = minTime; t <= maxTime; t++) {
      result[d * slotsPerDay + t] = value
    }
  }
  return result
}

// --- internal base64 helpers ---

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(encoded: string): Uint8Array {
  if (encoded === '') return new Uint8Array(0)
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
