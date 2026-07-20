import { useMemo, useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { bestWindows } from '@/lib/bestSlots'
import { formatWindowLabel } from '@/lib/ics'
import { finalizeEvent } from '@/services/eventService'
import { slotsPerDay } from '@/lib/slots'
import { formatSlotDateLabel, formatSlotTimeLabel } from '@/lib/timezoneSlots'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import LocationInput from '@/components/LocationInput'

interface FinalizeSheetProps {
  slug: string
  viewerTimezone: string
  onClose: () => void
}

export default function FinalizeSheet({ slug, viewerTimezone, onClose }: FinalizeSheetProps) {
  const event = useEventStore((s) => s.event)
  const participants = useEventStore((s) => s.participants)
  const [choice, setChoice] = useState<number | 'custom' | null>(null)
  const [customDate, setCustomDate] = useState(0)
  const [customStart, setCustomStart] = useState(0)
  const [customSlots, setCustomSlots] = useState(2)
  const [location, setLocation] = useState(event?.location ?? '')
  const [locationIsMapLink, setLocationIsMapLink] = useState(event?.locationIsMapLink ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  if (!event) return null
  const spd = slotsPerDay(event.timeRange, event.slotMinutes)

  const windowLabel = (startSlot: number, endSlot: number) =>
    formatWindowLabel(event, { startSlot, endSlot }, viewerTimezone)

  const durationLabel = (slots: number) => {
    const mins = slots * event.slotMinutes
    return mins < 60 ? `${mins} min` : `${mins / 60} h${mins % 60 ? ` ${mins % 60} min` : ''}`
  }

  const resolveWindow = (): { startSlot: number; endSlot: number } | null => {
    if (choice === 'custom') {
      if (event.datesOnly) {
        const startSlot = customDate * spd
        return { startSlot, endSlot: startSlot + spd - 1 }
      }
      const startSlot = customDate * spd + customStart
      const endSlot = Math.min(startSlot + customSlots - 1, customDate * spd + spd - 1)
      return { startSlot, endSlot }
    }
    if (choice === null || !windows[choice]) return null
    return { startSlot: windows[choice].startSlot, endSlot: windows[choice].endSlot }
  }

  const handleFinish = async () => {
    const w = resolveWindow()
    if (!w) return
    setSaving(true)
    setError(null)
    try {
      await finalizeEvent(slug, w, location.trim() || undefined, locationIsMapLink)
      onClose()
    } catch {
      setError("Couldn't save — try again")
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    'w-full bg-raised border-[1.5px] border-line rounded-[12px] px-3 py-2 text-sm text-ink'

  return (
    <BottomSheet title="Finish the vote" onClose={onClose}>
      <div className="space-y-2">
        {windows.map((w, i) => (
          <label key={w.startSlot} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="finalize-choice"
              checked={choice === i}
              onChange={() => setChoice(i)}
              className="accent-[var(--s2g-primary)]"
            />
            <span>
              <b className="font-extrabold">{windowLabel(w.startSlot, w.endSlot)}</b>{' '}
              <span className="text-success font-extrabold">{w.attendance}/{w.total}</span>
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="finalize-choice"
            checked={choice === 'custom'}
            onChange={() => setChoice('custom')}
            className="accent-[var(--s2g-primary)]"
          />
          <span className="font-bold">Custom time…</span>
        </label>
        {choice === 'custom' && (
          <div className={`grid gap-2 pl-6 ${event.datesOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <select value={customDate} onChange={(e) => setCustomDate(Number(e.target.value))} className={selectClass} aria-label="Date">
              {event.dates.map((d, i) => (
                <option key={d} value={i}>{formatSlotDateLabel(event, i, viewerTimezone)}</option>
              ))}
            </select>
            {!event.datesOnly && (
              <>
                <select
                  value={customStart}
                  onChange={(e) => {
                    const t = Number(e.target.value)
                    setCustomStart(t)
                    setCustomSlots((s) => Math.min(s, spd - t))
                  }}
                  className={selectClass}
                  aria-label="Start time"
                >
                  {Array.from({ length: spd }).map((_, t) => (
                    <option key={t} value={t}>{formatSlotTimeLabel(event, customDate * spd + t, viewerTimezone)}</option>
                  ))}
                </select>
                <select value={customSlots} onChange={(e) => setCustomSlots(Number(e.target.value))} className={selectClass} aria-label="Duration">
                  {Array.from({ length: spd - customStart }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{durationLabel(i + 1)}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
        <LocationInput
          value={location}
          onChange={setLocation}
          isMapLink={locationIsMapLink}
          onIsMapLinkChange={setLocationIsMapLink}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button size="lg" onClick={() => void handleFinish()} disabled={saving || resolveWindow() === null} className="mt-2">
          {saving ? 'Saving…' : '🏁 Finish vote'}
        </Button>
      </div>
    </BottomSheet>
  )
}
