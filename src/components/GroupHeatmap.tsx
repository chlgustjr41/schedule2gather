import { useMemo, useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { unpack } from '@/lib/bitmap'
import { slotsPerDay } from '@/lib/slots'
import { heatColor } from '@/lib/heatColor'
import { formatSlotDateLabel, formatSlotTimeLabel } from '@/lib/timezoneSlots'
import Card from '@/components/ui/Card'

interface GroupHeatmapProps {
  viewerTimezone: string
}

/**
 * Transposed group availability: one horizontal strip per event date, time
 * flowing left→right. Read-only; hover/tap a cell for names.
 */
export default function GroupHeatmap({ viewerTimezone }: GroupHeatmapProps) {
  const event = useEventStore((s) => s.event)
  const participants = useEventStore((s) => s.participants)
  const [tip, setTip] = useState<number | null>(null)

  const counts = useMemo(() => {
    if (!event) return []
    const c = new Array<number>(event.slotCount).fill(0)
    for (const p of participants) {
      if (p.availability === '') continue
      const bits = unpack(p.availability, event.slotCount)
      for (let i = 0; i < event.slotCount; i++) {
        if (bits[i]) c[i] += 1
      }
    }
    return c
  }, [event, participants])

  if (!event) return null
  const spd = slotsPerDay(event.timeRange, event.slotMinutes)
  const total = participants.length

  const tipText = (slotIdx: number) => {
    const names = participants
      .filter((p) => p.availability !== '' && unpack(p.availability, event.slotCount)[slotIdx])
      .map((p) => p.name)
    const time = formatSlotTimeLabel(event, slotIdx, viewerTimezone)
    return `${time} · ${names.length === 0 ? 'no one yet' : names.join(', ')} · ${names.length}/${total}`
  }

  const swatch = (bg: string, bordered = false) => (
    <span
      className={`inline-block w-4 h-2.5 rounded-[2px] ${bordered ? 'border border-line' : ''}`}
      style={{ backgroundColor: bg }}
    />
  )

  return (
    <Card className="max-w-5xl mx-auto mb-4 border-l-4 border-l-success">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">
        👥 Group overlap
      </div>
      <p className="text-xs text-ink-muted mt-0.5 mb-3">Read-only — darker green = more people free</p>
      {/* Tapping anywhere outside a cell dismisses the tooltip (touch affordance). */}
      <div className="space-y-1.5" onClick={() => setTip(null)}>
        {event.dates.map((dateStr, dateIdx) => (
          <div key={dateStr} className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-ink-muted w-16 shrink-0 text-right">
              {formatSlotDateLabel(event, dateIdx, viewerTimezone)}
            </span>
            <div className="flex gap-[2px] flex-1">
              {event.datesOnly ? (
                <button
                  type="button"
                  aria-label={tipText(dateIdx * spd)}
                  title={tipText(dateIdx * spd)}
                  onPointerEnter={() => setTip(dateIdx * spd)}
                  onPointerLeave={() => setTip(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setTip((cur) => (cur === dateIdx * spd ? null : dateIdx * spd))
                  }}
                  className="relative flex-1 h-[18px] rounded-[3px] border border-line/60 p-0 cursor-pointer"
                  style={{ backgroundColor: heatColor(counts[dateIdx * spd] ?? 0, total) }}
                >
                  {tip === dateIdx * spd && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 bg-ink text-canvas text-xs rounded-[8px] px-2 py-1 whitespace-nowrap pointer-events-none">
                      {tipText(dateIdx * spd)}
                    </span>
                  )}
                </button>
              ) : (
                Array.from({ length: spd }).map((_, t) => {
                  const slotIdx = dateIdx * spd + t
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-label={tipText(slotIdx)}
                      onPointerEnter={() => setTip(slotIdx)}
                      onPointerLeave={() => setTip(null)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTip((cur) => (cur === slotIdx ? null : slotIdx))
                      }}
                      className="relative flex-1 min-w-[4px] h-[18px] rounded-[2px] border border-line/60 p-0 cursor-pointer"
                      style={{ backgroundColor: heatColor(counts[slotIdx] ?? 0, total) }}
                    >
                      {tip === slotIdx && (
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 bg-ink text-canvas text-xs rounded-[8px] px-2 py-1 whitespace-nowrap pointer-events-none">
                          {tipText(slotIdx)}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>
      {!event.datesOnly && (
        <div className="flex items-center gap-2 mt-1">
          <span className="w-16 shrink-0" />
          <div className="flex justify-between flex-1 text-[10px] text-ink-muted">
            <span>{formatSlotTimeLabel(event, 0, viewerTimezone)}</span>
            <span>{formatSlotTimeLabel(event, spd - 1, viewerTimezone)}</span>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 mt-3 text-[10px] text-ink-muted">
        <span>0</span>
        {swatch('var(--s2g-slot-empty)', true)}
        {swatch('var(--s2g-heat-1)')}
        {swatch('var(--s2g-heat-2)')}
        {swatch('var(--s2g-heat-3)')}
        {swatch('var(--s2g-heat-4)')}
        <span>all free</span>
      </div>
    </Card>
  )
}
