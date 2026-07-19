import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { useEventStore } from '@/stores/eventStore'
import { usePaintStore } from '@/stores/paintStore'
import { pack, unpack } from '@/lib/bitmap'
import { slotsPerDay } from '@/lib/slots'
import { formatSlotDateLabel, formatSlotTimeLabel } from '@/lib/timezoneSlots'
import { getMonthPages, getVisibleColumns, getWeekPages, type CalendarColumn } from '@/lib/calendarPages'
import CellTooltip from '@/components/CellTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import { mineColor } from '@/lib/heatColor'
import Button from '@/components/ui/Button'
import SegmentedControl from '@/components/ui/SegmentedControl'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const UNDO_HOTKEY_LABEL = IS_MAC ? '⌘Z' : 'Ctrl+Z'
const REDO_HOTKEY_LABEL = IS_MAC ? '⌘⇧Z' : 'Ctrl+Shift+Z'
const UNDO_DEPTH = 50

const ZOOM_LEVELS = ['sm', 'md', 'lg'] as const
type Zoom = (typeof ZOOM_LEVELS)[number]
const CELL_CLASS: Record<Zoom, string> = { sm: 'w-8 h-5', md: 'w-12 h-6', lg: 'w-16 h-10' }
const LABEL_CLASS: Record<Zoom, string> = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }

interface AvailabilityGridProps {
  viewerTimezone: string
  /** Finalized events render the grid non-interactive. */
  readOnly?: boolean
}

export default function AvailabilityGrid({ viewerTimezone, readOnly = false }: AvailabilityGridProps) {
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
  const [zoom, setZoom] = useState<Zoom>(() => {
    try {
      const z = localStorage.getItem('s2g-grid-zoom')
      return z === 'sm' || z === 'lg' ? z : 'md'
    } catch {
      return 'md'
    }
  })
  const [eventDaysOnly, setEventDaysOnly] = useState(true)

  const changeZoom = (dir: 1 | -1) =>
    setZoom((z) => {
      const next = ZOOM_LEVELS[ZOOM_LEVELS.indexOf(z) + dir] ?? z
      try {
        localStorage.setItem('s2g-grid-zoom', next)
      } catch {
        // persistence is best-effort
      }
      return next
    })
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

  // Week/month pages for mobile views (computed once per event change)
  const weekPages = useMemo(
    () => (event ? getWeekPages(event.dates) : []),
    [event],
  )
  const monthPages = useMemo(
    () => (event ? getMonthPages(event.dates) : []),
    [event],
  )
  const viewMode: 'week' | 'month' = pageSize === 7 ? 'week' : 'month'
  const rawPages = useMemo(
    () => (isMobile ? (viewMode === 'week' ? weekPages : monthPages) : []),
    [isMobile, viewMode, weekPages, monthPages],
  )
  const pages = useMemo(() => {
    if (!event || !eventDaysOnly || rawPages.length === 0) return rawPages
    const filtered = rawPages.filter((pageStart) =>
      getVisibleColumns(pageStart, viewMode, event.dates).some((c) => c.eventDateIdx !== -1),
    )
    return filtered.length > 0 ? filtered : rawPages
  }, [rawPages, eventDaysOnly, event, viewMode])
  const totalPages = pages.length > 0 ? pages.length : 1
  const safePageIdx = Math.min(pageIdx, Math.max(0, pages.length - 1))
  const currentPageStart = pages.length > 0 ? pages[safePageIdx] : null

  // visibleColumns: list of CalendarColumn for rendering. On desktop, list every event date.
  // On mobile, list the calendar columns for the current page (with greyed entries for out-of-range dates).
  const visibleColumns: CalendarColumn[] = useMemo(() => {
    if (!event) return []
    if (!isMobile) {
      return event.dates.map((d, idx) => ({
        date: new Date(d + 'T00:00:00'),
        dateStr: d,
        eventDateIdx: idx,
      }))
    }
    if (!currentPageStart) return []
    const cols = getVisibleColumns(currentPageStart, viewMode, event.dates)
    if (!eventDaysOnly) return cols
    const filtered = cols.filter((c) => c.eventDateIdx !== -1)
    return filtered.length > 0 ? filtered : cols
  }, [event, isMobile, currentPageStart, viewMode, eventDaysOnly])

  // Clamp pageIdx when pageSize or pages change.
  if (pageIdx >= totalPages) {
    setPageIdx(0)
  }

  const effectivePaintMode = isMobile ? (viewMode === 'week' ? true : paintMode) : true
  const interactive = !readOnly
  const showPaintToggle = isMobile && viewMode === 'month'
  const stickyTimeColumn = isMobile && viewMode === 'month'
  const scrollableMonth = isMobile && viewMode === 'month'

  const myCommittedBits = useMemo(() => {
    if (!event || !myParticipant) return null
    return unpack(myParticipant.availability, event.slotCount)
  }, [event, myParticipant])

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
    return <div className="text-center text-ink-muted">Loading event…</div>
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
      if (isMobile && event) {
        const targetEventDate = event.dates[nextDateIdx]
        if (targetEventDate) {
          // Find the page (week or month start) containing this date
          const targetD = new Date(targetEventDate + 'T00:00:00')
          const newPageIdx = pages.findIndex((pageStart, i) => {
            const nextStart = pages[i + 1]
            return targetD.getTime() >= pageStart.getTime() &&
              (!nextStart || targetD.getTime() < nextStart.getTime())
          })
          if (newPageIdx >= 0 && newPageIdx !== safePageIdx) {
            setPageIdx(newPageIdx)
          }
        }
      }
      setFocusedSlot(nextIdx)
      requestAnimationFrame(() => focusSlotCell(nextIdx))
    }
  }

  const renderTable = () => (
    <table
      ref={interactive ? tableRef : undefined}
      role="grid"
      aria-label={`My availability for ${event.name}`}
      aria-rowcount={spd + 1}
      aria-colcount={event.dates.length + 1}
      className={`border-collapse select-none ${scrollableMonth ? '' : 'mx-auto'}`}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      onPointerCancel={interactive ? handlePointerUp : undefined}
      onKeyDown={interactive ? handleGridKeyDown : undefined}
    >
      <thead>
        <tr role="row">
          <th
            className={`w-20 ${stickyTimeColumn ? 'sticky left-0 bg-canvas z-10' : ''}`}
            aria-hidden="true"
          ></th>
          {visibleColumns.map((col) => {
            if (col.eventDateIdx === -1) {
              return (
                <th
                  key={col.dateStr}
                  role="columnheader"
                  scope="col"
                  className="p-2 text-sm font-medium text-ink-muted/50 select-none"
                >
                  {format(col.date, 'EEE d')}
                </th>
              )
            }
            const dateIdx = col.eventDateIdx
            return (
              <th
                key={col.dateStr}
                role="columnheader"
                scope="col"
                onClick={interactive ? () => void toggleColumn(dateIdx) : undefined}
                className={`p-2 text-sm font-medium select-none ${interactive ? 'cursor-pointer hover:bg-raised' : ''}`}
                title={interactive ? 'Click to toggle this entire column' : undefined}
              >
                <span className={interactive ? 'inline-block bg-raised border border-line rounded-[8px] px-1.5 py-0.5 active:bg-primary/20 select-none' : undefined}>
                  {formatSlotDateLabel(event, dateIdx, viewerTimezone)}
                </span>
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
              onClick={interactive ? () => void toggleRow(timeIdx) : undefined}
              className={`${LABEL_CLASS[zoom]} text-ink-muted pr-2 align-top select-none ${interactive ? 'cursor-pointer hover:text-ink' : ''} ${stickyTimeColumn ? 'sticky left-0 bg-canvas z-10' : ''}`}
              title={interactive ? 'Click to toggle this entire row' : undefined}
            >
              {/* P2 simplification: time label uses dateIdx=0; cross-TZ DST or date-line shifts may cause minor mismatch with later columns. */}
              <span className={interactive ? 'inline-block bg-raised border border-line rounded-[8px] px-1.5 py-0.5 active:bg-primary/20 select-none' : undefined}>
                {formatSlotTimeLabel(event, timeIdx, viewerTimezone)}
              </span>
            </td>
            {visibleColumns.map((col) => {
              if (col.eventDateIdx === -1) {
                // Greyed out-of-range cell
                return (
                  <td
                    key={`${col.dateStr}-${timeIdx}`}
                    aria-disabled="true"
                    className={`${CELL_CLASS[zoom]} border border-line bg-line/40`}
                  />
                )
              }
              const dateIdx = col.eventDateIdx
              const slotIdx = dateIdx * spd + timeIdx
              const mine = myDisplayBits[slotIdx]
              const bg = mineColor(mine)
              return (
                <td
                  key={slotIdx}
                  role="gridcell"
                  tabIndex={interactive && slotIdx === focusedSlot ? 0 : -1}
                  aria-selected={mine}
                  aria-label={`${formatSlotDateLabel(event, dateIdx, viewerTimezone)} ${formatSlotTimeLabel(event, timeIdx, viewerTimezone)} — ${mine ? 'available' : 'unavailable'}`}
                  data-slot-idx={interactive ? slotIdx : undefined}
                  onFocus={interactive ? () => setFocusedSlot(slotIdx) : undefined}
                  onPointerDown={interactive ? handlePointerDown(slotIdx) : undefined}
                  onPointerEnter={interactive ? handlePointerEnter(slotIdx) : () => setTooltipSlot(slotIdx)}
                  onPointerLeave={handlePointerLeave}
                  style={{
                    backgroundColor: bg,
                    touchAction: interactive && effectivePaintMode ? 'none' : 'auto',
                  }}
                  className={`${CELL_CLASS[zoom]} border border-line relative focus:outline-2 focus:outline-primary focus:outline-offset-[-2px] ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {tooltipSlot === slotIdx && !draftBits && (
                    <CellTooltip
                      names={participants
                        .filter((p) => unpack(p.availability, event.slotCount)[slotIdx])
                        .map((p) => p.name)}
                    />
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="pt-2">
      {interactive && (
      <div className="flex justify-center gap-1 sm:gap-2 mb-3 flex-wrap">
        {isMobile && (
          <SegmentedControl
            options={[
              { value: '7', label: 'Week' },
              { value: '31', label: 'Month' },
            ]}
            value={String(pageSize) as '7' | '31'}
            onChange={(v) => { setPageSize(Number(v) as 7 | 31); setPageIdx(0) }}
          />
        )}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => void setAllAvailable()}
        >
          Mark all available
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => void setAllUnavailable()}
        >
          Clear all
        </Button>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => void undo()}
            disabled={undoStack.length === 0}
            title={`Undo (${UNDO_HOTKEY_LABEL})`}
            aria-label={`Undo (${UNDO_HOTKEY_LABEL})`}
            className="w-9 h-9 rounded-full border border-line bg-surface text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => void redo()}
            disabled={redoStack.length === 0}
            title={`Redo (${REDO_HOTKEY_LABEL})`}
            aria-label={`Redo (${REDO_HOTKEY_LABEL})`}
            className="w-9 h-9 rounded-full border border-line bg-surface text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↻
          </button>
        </div>
      </div>
      )}
      <div className="overflow-x-auto">
        {renderTable()}
      </div>
      <div className="flex justify-center gap-1 sm:gap-2 mt-3 flex-wrap">
        <Button variant="secondary" size="sm" aria-label="Zoom out" disabled={zoom === 'sm'} onClick={() => changeZoom(-1)}>
          −
        </Button>
        <Button variant="secondary" size="sm" aria-label="Zoom in" disabled={zoom === 'lg'} onClick={() => changeZoom(1)}>
          +
        </Button>
        {isMobile && (
          <Button
            variant={eventDaysOnly ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={eventDaysOnly}
            onClick={() => setEventDaysOnly((v) => !v)}
          >
            Event days only
          </Button>
        )}
      </div>
      {interactive && showPaintToggle && (
        <div className="flex justify-center mt-3">
          <Button
            variant={paintMode ? 'primary' : 'secondary'}
            size="sm"
            type="button"
            onClick={() => setPaintMode(!paintMode)}
            aria-pressed={paintMode}
            title={
              paintMode
                ? 'Turn off paint mode (touch will scroll the grid)'
                : 'Turn on paint mode (touch will paint cells)'
            }
          >
            {paintMode ? 'Paint Mode: On' : 'Paint Mode: Off — tap to paint'}
          </Button>
        </div>
      )}
      {interactive && isMobile && totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-3 pb-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
            disabled={pageIdx === 0}
            aria-label="Previous date page"
          >
            ← Prev
          </Button>
          <span className="text-sm text-ink-muted min-w-[120px] text-center whitespace-nowrap">
            {currentPageStart && (
              viewMode === 'week'
                ? `${format(currentPageStart, 'MMM d')} (${safePageIdx + 1}/${totalPages})`
                : `${format(currentPageStart, 'MMMM yyyy')} (${safePageIdx + 1}/${totalPages})`
            )}
          </span>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setPageIdx((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIdx >= totalPages - 1}
            aria-label="Next date page"
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
