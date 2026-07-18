import { useMemo, useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { useEventStore } from '@/stores/eventStore'
import { unpack } from '@/lib/bitmap'
import { windowUtcRange } from '@/lib/ics'
import { reopenEvent } from '@/services/eventService'
import ExportSheet from '@/components/ExportSheet'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

interface FinalizedBannerProps {
  slug: string
  isHost: boolean
  viewerTimezone: string
  shareUrl: string
}

export default function FinalizedBanner({ slug, isHost, viewerTimezone, shareUrl }: FinalizedBannerProps) {
  const event = useEventStore((s) => s.event)
  const participants = useEventStore((s) => s.participants)
  const [showExport, setShowExport] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attendance = useMemo(() => {
    if (!event?.finalized) return 0
    const { startSlot, endSlot } = event.finalized
    return participants.filter((p) => {
      if (p.availability === '') return false
      const bits = unpack(p.availability, event.slotCount)
      for (let i = startSlot; i <= endSlot; i++) {
        if (!bits[i]) return false
      }
      return true
    }).length
  }, [event, participants])

  if (!event?.finalized) return null
  const { startSlot, endSlot } = event.finalized
  const range = windowUtcRange(event, { startSlot, endSlot })
  const label = range
    ? `${formatInTimeZone(range.start, viewerTimezone, 'EEE MMM d')}, ${formatInTimeZone(range.start, viewerTimezone, 'h:mm a')}–${formatInTimeZone(range.end, viewerTimezone, 'h:mm a')}`
    : ''

  const handleReopen = async () => {
    setError(null)
    try {
      await reopenEvent(slug)
    } catch {
      setError("Couldn't reopen — try again")
    }
  }

  return (
    <Card className="max-w-5xl mx-auto mb-4 border-l-4 border-l-success">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-success">
            ✅ Finalized
          </div>
          <div className="text-lg font-extrabold mt-0.5">{label}</div>
          <div className="text-xs text-ink-muted">{attendance}/{participants.length} can make it</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowExport(true)}>Add to calendar</Button>
          {isHost && (
            <Button variant="ghost" size="sm" onClick={() => void handleReopen()}>
              Reopen voting
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
      {showExport && (
        <ExportSheet
          window={{ startSlot, endSlot, attendance, total: participants.length }}
          viewerTimezone={viewerTimezone}
          shareUrl={shareUrl}
          onClose={() => setShowExport(false)}
        />
      )}
    </Card>
  )
}
