import { useMemo, useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { unpack } from '@/lib/bitmap'
import { windowUtcRange, formatWindowLabel } from '@/lib/ics'
import { buildAnnouncementText } from '@/lib/announcement'
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
  const [copied, setCopied] = useState(false)

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
  const label = range ? formatWindowLabel(event, { startSlot, endSlot }, viewerTimezone) : ''
  const announcementText = buildAnnouncementText(event, { startSlot, endSlot }, viewerTimezone, shareUrl)

  const handleReopen = async () => {
    setError(null)
    try {
      await reopenEvent(slug)
    } catch {
      setError("Couldn't reopen — try again")
    }
  }

  const handleCopyAnnouncement = async () => {
    try {
      await navigator.clipboard.writeText(announcementText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard can fail (permissions) — silently ignore, button just won't show "Copied"
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
          <Button size="sm" onClick={() => setShowExport(true)} title="Download or share this time to your calendar">Add to calendar</Button>
          {isHost && (
            <Button variant="ghost" size="sm" onClick={() => void handleReopen()} title="Reopen voting so people can keep painting">
              Reopen voting
            </Button>
          )}
        </div>
      </div>
      {isHost && (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-1.5">
            📣 Announce to the group
          </div>
          <p className="text-sm whitespace-pre-line bg-raised border border-line rounded-[12px] p-3">
            {announcementText}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => void handleCopyAnnouncement()}
            title="Copy this announcement to your clipboard"
          >
            {copied ? 'Copied ✓' : 'Copy announcement'}
          </Button>
        </div>
      )}
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
