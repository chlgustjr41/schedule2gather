import { formatWindowLabel } from '@/lib/ics'
import type { EventForLabels } from '@/lib/timezoneSlots'

export type AnnouncementEvent = EventForLabels & {
  name: string
  datesOnly?: boolean
  location?: string
}

/**
 * Ready-to-paste announcement for the host to drop in a group chat once an
 * event is finalized: the day/time (or just the day for dates-only events),
 * the location if the host set one, and the event link.
 */
export function buildAnnouncementText(
  event: AnnouncementEvent,
  w: { startSlot: number; endSlot: number },
  viewerTz: string,
  url: string,
): string {
  const label = formatWindowLabel(event, w, viewerTz)
  const location = event.location?.trim()
  const headline = `📅 ${event.name} is set for ${label}${location ? ` at ${location}` : ''}!`
  return `${headline}\n${url}`
}
