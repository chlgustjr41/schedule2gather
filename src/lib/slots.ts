export interface TimeRange {
  start: number
  end: number
}

export interface EventShape {
  dates: string[]
  timeRange: TimeRange
  slotMinutes: 15 | 30 | 60
}

/**
 * Number of time slots in a single day for the event's time range.
 */
export function slotsPerDay(timeRange: TimeRange, slotMinutes: 15 | 30 | 60): number {
  const hours = timeRange.end - timeRange.start
  return (hours * 60) / slotMinutes
}

/**
 * Flat row-major slot index: dateIdx * slotsPerDay + timeIdx.
 */
export function slotIndex(dateIdx: number, timeIdx: number, slotsPerDayCount: number): number {
  return dateIdx * slotsPerDayCount + timeIdx
}

/**
 * Total slot count across all days of an event.
 */
export function slotsPerEvent(event: EventShape): number {
  return event.dates.length * slotsPerDay(event.timeRange, event.slotMinutes)
}
