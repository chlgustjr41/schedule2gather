import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useEventStore } from '@/stores/eventStore'
import { usePaintStore } from '@/stores/paintStore'
import { pack, unpack } from '@/lib/bitmap'
import { slotsPerDay } from '@/lib/slots'
import { formatSlotDateLabel, formatSlotTimeLabel } from '@/lib/timezoneSlots'
import CellTooltip from '@/components/CellTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'

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
  const [focusedSlot, setFocusedSlot] = useState<number>(0)
  const isMobile = useIsMobile()
  const [pageSize, setPageSize] = useState<7 | 31>(7)
  const [pageIdx, setPageIdx] = useState(0)
  // Track previous participantId to reset stacks when participant changes (render-phase pattern)
  const prevParticipantIdRef = useRef<string | undefined>(undefined)
  const currentParticipantId = myParticipant?.participantId
  if (prevParticipantIdRef.current !== currentParticipantId) {
    prevParticipantIdRef.current = currentParticipantId
    if (undoStack.length > 0) setUndoStack([])
    if (redoStack.length > 0) setRedoStack([])
  }
  const tableRef = useRef<HTMLTableElement>(null)

  // Clamp focusedSlot when slotCount changes (e.g., switching events).
  if (event && focusedSlot >= event.slotCount) {
    setFocusedSlot(0)
  }

  const spd = useMemo(
    () => (event ? slotsPerDay(event.timeRange, event.slotMinutes) : 0),
    [event],
  )

  const totalDates = event ? event.dates.length : 0
  const visibleStart = isMobile ? pageIdx * pageSize : 0
  const visibleEnd = isMobile
    ? Math.min(visibleStart + pageSize, totalDates)
    : totalDates
  const totalPages = isMobile ? Math.max(1, Math.ceil(totalDates / pageSize)) : 1

  // Clamp pageIdx when pageSize or totalDates changes.
  if (pageIdx >= totalPages) {
    setPageIdx(0)
  }

  const effectivePaintMode = isMobile ? true : paintMode

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
    if (e.pointerType === 'touch' && !effectivePaintMode) return
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

  const focusSlotCell = (slotIdx: number) => {
    if (!tableRef.current) return
    const cell = tableRef.current.querySelector<HTMLElement>(`td[data-slot-idx="${slotIdx}"]`)
    if (cell) cell.focus()
  }

  const toggleSingleSlot = async (slotIdx: number) => {
    if (!myCommittedBits) return
    pushHistory(myParticipant?.availability ?? '')
    const next = [...myCommittedBits]
    next[slotIdx] = !next[slotIdx]
    await updateMyAvailability(pack(next))
  }

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLTableElement>) => {
    if (!event) return
    const target = e.target as HTMLElement | null
    if (!target || !target.matches('td[data-slot-idx]')) return

    const cur = Number(target.dataset.slotIdx)
    if (Number.isNaN(cur)) return
    const dateIdx = Math.floor(cur / spd)
    const timeIdx = cur % spd
    const lastDate = event.dates.length - 1
    const lastTime = spd - 1

    let nextIdx: number | null = null
    switch (e.key) {
      case 'ArrowUp':
        if (timeIdx > 0) nextIdx = dateIdx * spd + (timeIdx - 1)
        break
      case 'ArrowDown':
        if (timeIdx < lastTime) nextIdx = dateIdx * spd + (timeIdx + 1)
        break
      case 'ArrowLeft':
        if (dateIdx > 0) nextIdx = (dateIdx - 1) * spd + timeIdx
        break
      case 'ArrowRight':
        if (dateIdx < lastDate) nextIdx = (dateIdx + 1) * spd + timeIdx
        break
      case ' ':
      case 'Enter':
        e.preventDefault()
        void toggleSingleSlot(cur)
        return
      default:
        return
    }

    if (nextIdx !== null) {
      e.preventDefault()
      const nextDateIdx = Math.floor(nextIdx / spd)
      if (isMobile && (nextDateIdx < visibleStart || nextDateIdx >= visibleEnd)) {
        // Move to the page containing nextDateIdx
        const newPageIdx = Math.floor(nextDateIdx / pageSize)
        setPageIdx(newPageIdx)
      }
      setFocusedSlot(nextIdx)
      requestAnimationFrame(() => focusSlotCell(nextIdx))
    }
  }

  return (
    <div className="p-4">
      <div className="flex justify-center gap-1 sm:gap-2 mb-3 flex-wrap">
        {isMobile && (
          <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => { setPageSize(7); setPageIdx(0) }}
              className={
                pageSize === 7
                  ? 'bg-indigo-600 text-white px-3 py-1'
                  : 'bg-white text-gray-700 hover:bg-gray-50 px-3 py-1'
              }
              aria-pressed={pageSize === 7}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => { setPageSize(31); setPageIdx(0) }}
              className={
                pageSize === 31
                  ? 'bg-indigo-600 text-white px-3 py-1'
                  : 'bg-white text-gray-700 hover:bg-gray-50 px-3 py-1'
              }
              aria-pressed={pageSize === 31}
            >
              Month
            </button>
          </div>
        )}
        {!isMobile && (
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
        )}
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
        ref={tableRef}
        role="grid"
        aria-label={event ? `Availability grid for ${event.name}` : 'Availability grid'}
        aria-rowcount={spd + 1}
        aria-colcount={event ? event.dates.length + 1 : 0}
        className="border-collapse select-none mx-auto"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleGridKeyDown}
      >
        <thead>
          <tr role="row">
            <th className="w-20" aria-hidden="true"></th>
            {event.dates.slice(visibleStart, visibleEnd).map((d, localIdx) => {
              const dateIdx = visibleStart + localIdx
              return (
                <th
                  key={d}
                  role="columnheader"
                  scope="col"
                  onClick={() => void toggleColumn(dateIdx)}
                  className="p-2 text-sm font-medium cursor-pointer select-none hover:bg-gray-50"
                  title="Click to toggle this entire column"
                >
                  {formatSlotDateLabel(event, dateIdx, viewerTimezone)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: spd }).map((_, timeIdx) => (
            <tr key={timeIdx} role="row">
              <td
                role="rowheader"
                scope="row"
                onClick={() => void toggleRow(timeIdx)}
                className="text-xs text-gray-500 pr-2 align-top cursor-pointer select-none hover:text-gray-700"
                title="Click to toggle this entire row"
              >
                {/* P2 simplification: time label uses dateIdx=0; cross-TZ DST or date-line shifts may cause minor mismatch with later columns. */}
                {formatSlotTimeLabel(event, timeIdx, viewerTimezone)}
              </td>
              {event.dates.slice(visibleStart, visibleEnd).map((_d, localIdx) => {
                const dateIdx = visibleStart + localIdx
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
                    role="gridcell"
                    tabIndex={slotIdx === focusedSlot ? 0 : -1}
                    aria-selected={mine}
                    aria-label={`${formatSlotDateLabel(event, dateIdx, viewerTimezone)} ${formatSlotTimeLabel(event, timeIdx, viewerTimezone)} — ${mine ? 'available' : 'unavailable'}`}
                    data-slot-idx={slotIdx}
                    onFocus={() => setFocusedSlot(slotIdx)}
                    onPointerDown={handlePointerDown(slotIdx)}
                    onPointerEnter={handlePointerEnter(slotIdx)}
                    onPointerLeave={handlePointerLeave}
                    style={{
                      backgroundColor: bg,
                      touchAction: effectivePaintMode ? 'none' : 'auto',
                    }}
                    className="w-12 h-6 border border-gray-200 cursor-pointer relative focus:outline-2 focus:outline-indigo-500 focus:outline-offset-[-2px]"
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
      {isMobile && totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-3 pb-2">
          <button
            type="button"
            onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
            disabled={pageIdx === 0}
            className="text-sm border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            aria-label="Previous date page"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500 min-w-[80px] text-center">
            {visibleStart + 1}–{visibleEnd} of {totalDates}
          </span>
          <button
            type="button"
            onClick={() => setPageIdx((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIdx >= totalPages - 1}
            className="text-sm border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            aria-label="Next date page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
