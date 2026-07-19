import { useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { useEventStore } from '@/stores/eventStore'
import { bestWindows, type BestWindow } from '@/lib/bestSlots'
import { windowUtcRange } from '@/lib/ics'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ExportSheet from '@/components/ExportSheet'

interface BestTimesPanelProps {
  viewerTimezone: string
  shareUrl: string
}

export default function BestTimesPanel({ viewerTimezone, shareUrl }: BestTimesPanelProps) {
  const event = useEventStore((s) => s.event)
  const participants = useEventStore((s) => s.participants)
  const [exportWindow, setExportWindow] = useState<BestWindow | null>(null)

  const windows = useMemo(() => {
    if (!event) return []
    return bestWindows(
      {
        dates: event.dates,
        timeRange: event.timeRange,
        slotMinutes: event.slotMinutes,
        slotCount: event.slotCount,
      },
      participants.map((p) => p.availability),
    )
  }, [event, participants])

  // weekdays_recurring has no calendar dates → no UTC moments to rank/export.
  if (!event || event.mode === 'weekdays_recurring') return null

  const painted = participants.filter((p) => p.availability !== '').length

  return (
    <Card className="mb-4 max-w-5xl mx-auto">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-2">
        ✨ Best times
      </div>
      {painted < 2 || windows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Share the link — best times appear once 2+ people paint.
        </p>
      ) : (
        <ul className="space-y-2">
          {windows.map((w) => {
            const range = windowUtcRange(event, w)
            if (!range) return null
            const day = formatInTimeZone(range.start, viewerTimezone, 'EEE MMM d')
            const from = formatInTimeZone(range.start, viewerTimezone, 'h:mm a')
            const to = formatInTimeZone(range.end, viewerTimezone, 'h:mm a')
            return (
              <li key={w.startSlot} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  <b className="font-extrabold">{day}, {from}–{to}</b>{' '}
                  <span className="text-success font-extrabold">{w.attendance}/{w.total}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => setExportWindow(w)}>
                  Add to cal ⤓
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {exportWindow && (
        <ExportSheet
          window={exportWindow}
          viewerTimezone={viewerTimezone}
          shareUrl={shareUrl}
          onClose={() => setExportWindow(null)}
        />
      )}
    </Card>
  )
}
