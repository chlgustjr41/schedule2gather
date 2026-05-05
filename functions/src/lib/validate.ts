export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const MODES = ['specific_dates', 'weekdays_in_range', 'weekdays_recurring'] as const
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const SLOT_MINUTES = [15, 30, 60] as const

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface CreateEventInput {
  name: string
  mode: (typeof MODES)[number]
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
}

/**
 * Number of time slots in a single event-day, derived from time range and slot size.
 * Pure; used by both the handler and the validator's cap check to avoid divergence.
 */
export function computeSlotsPerDay(
  timeRange: { start: number; end: number },
  slotMinutes: 15 | 30 | 60,
): number {
  return (timeRange.end - timeRange.start) * (60 / slotMinutes)
}

/**
 * Total slot count across all event days.
 */
export function computeSlotCount(input: CreateEventInput): number {
  return input.dates.length * computeSlotsPerDay(input.timeRange, input.slotMinutes)
}

function isInteger(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

function isValidIANATimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function validateCreateEventInput(input: unknown): asserts input is CreateEventInput {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('input must be an object')
  }
  const i = input as Record<string, unknown>

  // name
  if (typeof i.name !== 'string') {
    throw new ValidationError('name must be a string')
  }
  const trimmedName = i.name.trim()
  if (trimmedName.length === 0) {
    throw new ValidationError('name must not be empty')
  }
  if (trimmedName.length > 80) {
    throw new ValidationError('name must be 80 chars or fewer')
  }

  // mode
  if (!MODES.includes(i.mode as (typeof MODES)[number])) {
    throw new ValidationError(`mode must be one of: ${MODES.join(', ')}`)
  }
  const mode = i.mode as (typeof MODES)[number]

  // dates
  if (!Array.isArray(i.dates)) {
    throw new ValidationError('dates must be an array')
  }
  if (i.dates.length === 0) {
    throw new ValidationError('dates must not be empty')
  }
  if (i.dates.length > 60) {
    throw new ValidationError('dates must have 60 or fewer entries')
  }
  if (mode === 'weekdays_recurring') {
    for (const d of i.dates) {
      if (typeof d !== 'string' || !WEEKDAYS.includes(d as (typeof WEEKDAYS)[number])) {
        throw new ValidationError(
          `each date in weekdays_recurring mode must be one of: ${WEEKDAYS.join(', ')}`,
        )
      }
    }
  } else {
    // specific_dates or weekdays_in_range — both use ISO dates
    for (const d of i.dates) {
      if (typeof d !== 'string' || !ISO_DATE_RE.test(d)) {
        throw new ValidationError(`each date must be ISO format YYYY-MM-DD; got "${d}"`)
      }
    }
  }

  // timeRange
  if (!i.timeRange || typeof i.timeRange !== 'object') {
    throw new ValidationError('timeRange must be an object')
  }
  const tr = i.timeRange as { start?: unknown; end?: unknown }
  if (!isInteger(tr.start) || !isInteger(tr.end)) {
    throw new ValidationError('timeRange.start and end must be integers')
  }
  if (tr.start < 0 || tr.start > 23) {
    throw new ValidationError('timeRange.start must be 0-23')
  }
  if (tr.end < 1 || tr.end > 24) {
    throw new ValidationError('timeRange.end must be 1-24')
  }
  if (tr.end <= tr.start) {
    throw new ValidationError('timeRange.end must be greater than timeRange.start')
  }

  // slotMinutes
  if (!SLOT_MINUTES.includes(i.slotMinutes as (typeof SLOT_MINUTES)[number])) {
    throw new ValidationError(`slotMinutes must be one of: ${SLOT_MINUTES.join(', ')}`)
  }

  // timezone
  if (typeof i.timezone !== 'string') {
    throw new ValidationError('timezone must be a string')
  }
  if (!isValidIANATimezone(i.timezone)) {
    throw new ValidationError(`timezone "${i.timezone}" is not a valid IANA timezone`)
  }

  // slotCount cap — uses shared computeSlotCount to avoid divergence with the handler
  const slotCount = computeSlotCount(input as CreateEventInput)
  if (slotCount > 5000) {
    throw new ValidationError(`slotCount ${slotCount} exceeds cap of 5000`)
  }
}
