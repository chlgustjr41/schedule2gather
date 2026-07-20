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
  /** True when the host only wants date-level voting (no hourly grid). */
  datesOnly?: boolean
  /** Optional venue/address, shown to voters and included in the finalize announcement. */
  location?: string
  /** True when `location` was confirmed via Places search — only then is it rendered as a map link. */
  locationIsMapLink?: boolean
  /** Optional free-text details shown to voters on the event page. */
  description?: string
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

/** True for a finite number that's a whole multiple of 15 minutes when expressed in hours. */
function isQuarterHour(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.round(n * 4) === n * 4
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

  // timeRange — hours, allowing quarter-hour precision (e.g. 9.25 = 9:15) so the
  // boundary can land on any 15-minute mark; slotMinutes (validated below) must
  // still evenly divide the resulting duration.
  if (!i.timeRange || typeof i.timeRange !== 'object') {
    throw new ValidationError('timeRange must be an object')
  }
  const tr = i.timeRange as { start?: unknown; end?: unknown }
  if (!isQuarterHour(tr.start) || !isQuarterHour(tr.end)) {
    throw new ValidationError('timeRange.start and end must be in 15-minute increments')
  }
  if (tr.start < 0 || tr.start >= 24) {
    throw new ValidationError('timeRange.start must be 0-23.75')
  }
  if (tr.end <= 0 || tr.end > 24) {
    throw new ValidationError('timeRange.end must be 0.25-24')
  }
  if (tr.end <= tr.start) {
    throw new ValidationError('timeRange.end must be greater than timeRange.start')
  }

  // slotMinutes
  if (!SLOT_MINUTES.includes(i.slotMinutes as (typeof SLOT_MINUTES)[number])) {
    throw new ValidationError(`slotMinutes must be one of: ${SLOT_MINUTES.join(', ')}`)
  }
  const slotMinutes = i.slotMinutes as (typeof SLOT_MINUTES)[number]
  const durationMinutes = Math.round((tr.end - tr.start) * 60)
  if (durationMinutes % slotMinutes !== 0) {
    throw new ValidationError(
      `timeRange duration (${durationMinutes} min) must be a whole multiple of slotMinutes (${slotMinutes})`,
    )
  }

  // datesOnly (optional) — `!= null` (not `!== undefined`) because the callable
  // SDK serializes an omitted/undefined field as `null` on the wire.
  if (i.datesOnly != null && typeof i.datesOnly !== 'boolean') {
    throw new ValidationError('datesOnly must be a boolean')
  }

  // location (optional)
  if (i.location != null) {
    if (typeof i.location !== 'string') {
      throw new ValidationError('location must be a string')
    }
    if (i.location.trim().length > 200) {
      throw new ValidationError('location must be 200 chars or fewer')
    }
  }

  // locationIsMapLink (optional)
  if (i.locationIsMapLink != null && typeof i.locationIsMapLink !== 'boolean') {
    throw new ValidationError('locationIsMapLink must be a boolean')
  }

  // description (optional)
  if (i.description != null) {
    if (typeof i.description !== 'string') {
      throw new ValidationError('description must be a string')
    }
    if (i.description.trim().length > 1000) {
      throw new ValidationError('description must be 1000 chars or fewer')
    }
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
