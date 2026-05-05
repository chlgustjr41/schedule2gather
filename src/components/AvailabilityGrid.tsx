import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { usePaintStore } from '@/stores/paintStore'
import { pack, unpack } from '@/lib/bitmap'
import { slotsPerDay } from '@/lib/slots'
import { formatSlotDateLabel, formatSlotTimeLabel } from '@/lib/timezoneSlots'
import CellTooltip from '@/components/CellTooltip'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const UNDO_HOTKEY_LABEL = IS_MAC ? '⌘Z' : 'Ctrl+Z'
const REDO_HOTKEY_LABEL = IS_MAC ? '⌘⇧Z' : 'Ctrl+Shift+Z'
const UNDO_DEPTH = 50

interface AvailabilityGridProps {
  viewerTimezone: string
}

export default function AvailabilityGrid({ viewerTimezone }: AvailabilityGridProps) {
  const event = useEventStore((s) => s.event)
  const myParticipant = useEventStore((s) => s.myParticipant)
  const participants = useEventStore((s) => s.participants)
  const updateMyAvailability = useEventStore((s) => s.updateMyAvailability)
  const startPaint = usePaintStore((s) => s.startPaint)
  const dragTo = usePaintStore((s) => s.dragTo)
  const commitPaint = usePaintStore((s) => s.commitPaint)
  const draftBits = usePaintStore((s) => s.draftBits)
  const paintMode = usePaintStore((s) => s.paintMode)
  const setPaintMode = usePaintStore((s) => s.setPaintMode)
  const [tooltipSlot, setTooltipSlot] = useState<number | null>(null)
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  // Track previous participantId to reset stacks when participant changes (render-phase pattern)
  const prevParticipantIdRef = useRef<string | undefined>(undefined)
  const currentParticipantId = myParticipant?.participantId
  if (prevParticipantIdRef.current !== currentParticipantId) {
    prevParticipantIdRef.current = currentParticipantId
    if (undoStack.length > 0) setUndoStack([])
    if (redoStack.length > 0) setRedoStack([])
  }

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

  const pushHistory = useCallback((snapshot: string) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot]
      if (next.length > UNDO_DEPTH) next.shift()
      return next
    })
    setRedoStack([])
  }, [])

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    const current = myParticipant?.availability ?? ''
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, current])
    await updateMyAvailability(previous)
  }, [undoStack, myParticipant, updateMyAvailability])

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    const current = myParticipant?.availability ?? ''
    setRedoStack((prev) => prev.slice(0, -1))
    setUndoStack((prev) => {
      const nextStack = [...prev, current]
      if (nextStack.length > UNDO_DEPTH) nextStack.shift()
      return nextStack
    })
    await updateMyAvailability(next)
  }, [redoStack, myParticipant, updateMyAvailability])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          void redo()
        } else {
          void undo()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  if (!event || !myParticipant || !myCommittedBits) {
    return <div className="text-center text-gray-500">Loading event…</div>
  }

  const myDisplayBits = draftBits ?? myCommittedBits

  const toggleColumn = async (dateIdx: number) => {
    if (!myCommittedBits) return
    const startIdx = dateIdx * spd
    const endIdx = startIdx + spd - 1
    let anyOff = false
    for (let i = startIdx; i <= endIdx; i++) {
      if (!myCommittedBits[i]) {
        anyOff = true
        break
      }
    }
    const value = anyOff
    const next = [...myCommittedBits]
    for (let i = startIdx; i <= endIdx; i++) next[i] = value
    pushHistory(myParticipant?.availability ?? '')
    await updateMyAvailability(pack(next))
  }

  const toggleRow = async (timeIdx: number) => {
    if (!myCommittedBits || !event) return
    let anyOff = false
    for (let d = 0; d < event.dates.length; d++) {
      if (!myCommittedBits[d * spd + timeIdx]) {
        anyOff = true
        break
      }
    }
    const value = anyOff
    const next = [...myCommittedBits]
    for (let d = 0; d < event.dates.length; d++) next[d * spd + timeIdx] = value
    pushHistory(myParticipant?.availability ?? '')
    await updateMyAvailability(pack(next))
  }

  const setAllAvailable = async () => {
    if (!event || !myCommittedBits) return
    const next = new Array(event.slotCount).fill(true)
    pushHistory(myParticipant?.availability ?? '')
    await updateMyAvailability(pack(next))
  }

  const setAllUnavailable = async () => {
    if (!event || !myCommittedBits) return
    const next = new Array(event.slotCount).fill(false)
    pushHistory(myParticipant?.availability ?? '')
    await updateMyAvailability(pack(next))
  }

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(15)
      } catch {
        // Vibration API can throw if user has disabled it; ignore.
      }
    }
  }

  const handlePointerDown = (slotIdx: number) => (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && !paintMode) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startPaint(slotIdx, myCommittedBits)
    triggerHaptic()
  }

  const handlePointerEnter = (slotIdx: number) => () => {
    if (draftBits) {
      dragTo(slotIdx, myCommittedBits)
    } else {
      setTooltipSlot(slotIdx)
    }
  }

  const handlePointerLeave = () => {
    if (!draftBits) setTooltipSlot(null)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draftBits) return
    const elem = document.elementFromPoint(e.clientX, e.clientY)
    if (!elem) return
    const cellEl = elem.closest('td[data-slot-idx]') as HTMLElement | null
    if (!cellEl) return
    const slotIdxStr = cellEl.dataset.slotIdx
    if (!slotIdxStr) return
    const slotIdx = Number(slotIdxStr)
    if (Number.isNaN(slotIdx)) return
    // Capture visited-state BEFORE dragTo (which may add slotIdx).
    const wasNew = !usePaintStore.getState().visited.has(slotIdx)
    dragTo(slotIdx, myCommittedBits)
    if (wasNew) triggerHaptic()
  }

  const handlePointerUp = async () => {
    const finalBits = commitPaint()
    if (finalBits) {
      pushHistory(myParticipant?.availability ?? '')
      await updateMyAvailability(pack(finalBits))
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-center gap-2 mb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setPaintMode(!paintMode)}
          aria-pressed={paintMode}
          className={
            paintMode
              ? 'text-sm rounded px-3 py-1 bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700'
              : 'text-sm rounded px-3 py-1 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }
          title={
            paintMode
              ? 'Turn off paint mode (touch will scroll the page)'
              : 'Turn on paint mode (touch will paint cells; required on mobile)'
          }
        >
          {paintMode ? 'Paint Mode: On' : 'Paint Mode: Off'}
        </button>
        <button
          type="button"
          onClick={() => void setAllAvailable()}
          className="text-sm border border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded px-3 py-1"
        >
          Mark all available
        </button>
        <button
          type="button"
          onClick={() => void setAllUnavailable()}
          className="text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 rounded px-3 py-1"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() => void undo()}
          disabled={undoStack.length === 0}
          title={`Undo (${UNDO_HOTKEY_LABEL})`}
          aria-label={`Undo (${UNDO_HOTKEY_LABEL})`}
          className="text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={() => void redo()}
          disabled={redoStack.length === 0}
          title={`Redo (${REDO_HOTKEY_LABEL})`}
          aria-label={`Redo (${REDO_HOTKEY_LABEL})`}
          className="text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Redo ↷
        </button>
      </div>
      <div className="overflow-auto flex justify-center">
      <table
        className="border-collapse select-none mx-auto"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <thead>
          <tr>
            <th className="w-20"></th>
            {event.dates.map((d, dateIdx) => (
              <th
                key={d}
                onClick={() => void toggleColumn(dateIdx)}
                className="p-2 text-sm font-medium cursor-pointer select-none hover:bg-gray-50"
                title="Click to toggle this entire column"
              >
                {formatSlotDateLabel(event, dateIdx, viewerTimezone)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: spd }).map((_, timeIdx) => (
            <tr key={timeIdx}>
              <td
                onClick={() => void toggleRow(timeIdx)}
                className="text-xs text-gray-500 pr-2 align-top cursor-pointer select-none hover:text-gray-700"
                title="Click to toggle this entire row"
              >
                {/* P2 simplification: time label uses dateIdx=0; cross-TZ DST or date-line shifts may cause minor mismatch with later columns. */}
                {formatSlotTimeLabel(event, timeIdx, viewerTimezone)}
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
                    data-slot-idx={slotIdx}
                    onPointerDown={handlePointerDown(slotIdx)}
                    onPointerEnter={handlePointerEnter(slotIdx)}
                    onPointerLeave={handlePointerLeave}
                    style={{
                      backgroundColor: bg,
                      touchAction: paintMode ? 'none' : 'auto',
                    }}
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
    </div>
  )
}
