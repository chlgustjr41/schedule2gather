import { useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import type { BestWindow } from '@/lib/bestSlots'
import { buildIcs, downloadIcs, googleCalendarUrl, summaryText } from '@/lib/ics'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'

interface ExportSheetProps {
  window: BestWindow
  viewerTimezone: string
  shareUrl: string
  onClose: () => void
}

export default function ExportSheet({ window: win, viewerTimezone, shareUrl, onClose }: ExportSheetProps) {
  const event = useEventStore((s) => s.event)
  const [copied, setCopied] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  if (!event) return null

  const handleIcs = () => {
    const ics = buildIcs(event, win, shareUrl)
    if (ics) downloadIcs(`${event.name.replace(/[^\w-]+/g, '_')}.ics`, ics)
  }

  const handleGoogle = () => {
    const url = googleCalendarUrl(event, win, shareUrl)
    if (url) globalThis.open(url, '_blank', 'noopener')
  }

  const handleCopy = async () => {
    const text = summaryText(event, win, viewerTimezone, shareUrl, win.attendance, win.total)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure origin / permissions) — select-and-copy fallback.
      setFallbackText(text)
    }
  }

  return (
    <BottomSheet title="Add to calendar" onClose={onClose}>
      <div className="space-y-2">
        <Button variant="secondary" size="lg" onClick={handleIcs}>Download .ics</Button>
        <Button variant="secondary" size="lg" onClick={handleGoogle}>Open Google Calendar</Button>
        <Button variant="secondary" size="lg" onClick={() => void handleCopy()}>
          {copied ? 'Copied ✓' : 'Copy summary text'}
        </Button>
        {fallbackText && (
          <textarea
            readOnly
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-24 text-xs bg-raised border border-line rounded-[12px] p-2"
          />
        )}
      </div>
    </BottomSheet>
  )
}
