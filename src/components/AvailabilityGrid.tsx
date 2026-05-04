import { useMemo, useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { usePaintStore } from '@/stores/paintStore'
import { pack, unpack } from '@/lib/bitmap'
import { slotsPerDay } from '@/lib/slots'
import CellTooltip from '@/components/CellTooltip'

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

function formatDateLabel(dateStr: string, mode: string): string {
  if (mode === 'weekdays_recurring') {
    return WEEKDAY_LABELS[dateStr] ?? dateStr
  }
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTimeLabel(timeIdx: number, startHour: number, slotMinutes: number): string {
  const totalMins = startHour * 60 + timeIdx * slotMinutes
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function AvailabilityGrid() {
  const event = useEventStore((s) => s.event)
  const myParticipant = useEventStore((s) => s.myParticipant)
  const participants = useEventStore((s) => s.participants)
  const updateMyAvailability = useEventStore((s) => s.updateMyAvailability)
  const startPaint = usePaintStore((s) => s.startPaint)
  const dragTo = usePaintStore((s) => s.dragTo)
  const commitPaint = usePaintStore((s) => s.commitPaint)
  const draftBits = usePaintStore((s) => s.draftBits)
  const [tooltipSlot, setTooltipSlot] = useState<number | null>(null)

  const spd = useMemo(
    () => (event ? slotsPerDay(event.timeRange, event.slotMinutes) : 0),
    [event],
  )

  const myCommittedBits = useMemo(() => {
    if (!event || !myParticipant) return null
    return unpack(myParticipant.availability, event.slotCount)
  }, [event, myParticipant])

  const aggregateCounts = useMemo(() => {
    if (!event) return []
    const counts = new Array(event.slotCount).fill(0)
    for (const p of participants) {
      const bits = unpack(p.availability, event.slotCount)
      for (let i = 0; i < event.slotCount; i++) {
        if (bits[i]) counts[i] += 1
      }
    }
    if (draftBits && myParticipant) {
      const myBits = unpack(myParticipant.availability, event.slotCount)
      for (let i = 0; i < event.slotCount; i++) {
        if (myBits[i] && !draftBits[i]) counts[i] -= 1
        else if (!myBits[i] && draftBits[i]) counts[i] += 1
      }
    }
    return counts
  }, [event, participants, draftBits, myParticipant])

  if (!event || !myParticipant || !myCommittedBits) {
    return <div className="text-center text-gray-500">Loading event…</div>
  }

  const myDisplayBits = draftBits ?? myCommittedBits

  const handlePointerDown = (slotIdx: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startPaint(slotIdx, myCommittedBits)
  }

  const handlePointerEnter = (slotIdx: number) => () => {
    if (draftBits) {
      dragTo(slotIdx, myCommittedBits, spd)
    } else {
      setTooltipSlot(slotIdx)
    }
  }

  const handlePointerLeave = () => {
    if (!draftBits) setTooltipSlot(null)
  }

  const handlePointerUp = async () => {
    const finalBits = commitPaint()
    if (finalBits) {
      await updateMyAvailability(pack(finalBits))
    }
  }

  return (
    <div className="overflow-auto p-4">
      <table
        className="border-collapse select-none"
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <thead>
          <tr>
            <th className="w-20"></th>
            {event.dates.map((d) => (
              <th key={d} className="p-2 text-sm font-medium">
                {formatDateLabel(d, event.mode)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: spd }).map((_, timeIdx) => (
            <tr key={timeIdx}>
              <td className="text-xs text-gray-500 pr-2 align-top">
                {formatTimeLabel(timeIdx, event.timeRange.start, event.slotMinutes)}
              </td>
              {event.dates.map((_, dateIdx) => {
                const slotIdx = dateIdx * spd + timeIdx
                const mine = myDisplayBits[slotIdx]
                const count = aggregateCounts[slotIdx]
                const intensity = participants.length > 0 ? count / participants.length : 0
                const bg = mine
                  ? '#4f46e5'
                  : `rgba(34, 197, 94, ${0.15 + intensity * 0.6})`
                return (
                  <td
                    key={slotIdx}
                    onPointerDown={handlePointerDown(slotIdx)}
                    onPointerEnter={handlePointerEnter(slotIdx)}
                    onPointerLeave={handlePointerLeave}
                    style={{ backgroundColor: bg }}
                    className="w-12 h-6 border border-gray-200 cursor-pointer relative"
                  >
                    {tooltipSlot === slotIdx && !draftBits && (
                      <CellTooltip
                        names={participants.filter((p) => unpack(p.availability, event.slotCount)[slotIdx]).map((p) => p.name)}
                      />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
