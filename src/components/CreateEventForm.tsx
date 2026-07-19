import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { createEvent } from '@/services/eventService'
import { useAuthStore } from '@/stores/authStore'
import { COMMON_TIMEZONES, detectTimezone, formatTimezoneLabel } from '@/lib/timezones'
import { mergeRangeIntoDates } from '@/lib/dateRange'
import { clampTimeRange } from '@/lib/timeRange'
import { useIsMobile } from '@/hooks/useIsMobile'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SegmentedControl from '@/components/ui/SegmentedControl'
import TextField from '@/components/ui/TextField'
import WheelPicker from '@/components/ui/WheelPicker'

type DayCategory = 'all' | 'weekdays' | 'weekends'

function formatHour(h: number): string {
  const norm = h % 24
  const suffix = norm < 12 ? 'AM' : 'PM'
  const display = norm % 12 === 0 ? 12 : norm % 12
  return `${display} ${suffix}`
}

const HOURS_START = Array.from({ length: 24 }, (_, h) => ({ value: h, label: formatHour(h) }))
const HOURS_END = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: formatHour(i + 1) }))

export default function CreateEventForm() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // Anonymous sign-in runs on app load; creating an event before it resolves
  // would hit the callable unauthenticated (401). Gate the CTA until ready.
  const authedUser = useAuthStore((s) => s.user)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(21)
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30)
  const detectedTz = useMemo(() => detectTimezone(), [])
  const [timezone, setTimezone] = useState(detectedTz)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [rangeHint, setRangeHint] = useState(false)
  const [pickMode, setPickMode] = useState<'days' | 'range'>('days')
  const [rangeDraft, setRangeDraft] = useState<DateRange | undefined>(undefined)

  const today = useMemo(() => startOfDay(new Date()), [])
  // Controlled calendar month so the per-month quick-select rows track whatever
  // months are actually on screen as the user pages through the calendar.
  const [displayMonth, setDisplayMonth] = useState<Date>(today)
  const visibleMonths = isMobile ? [displayMonth] : [displayMonth, addMonths(displayMonth, 1)]

  const tzOptions = useMemo(() => {
    const tzs = COMMON_TIMEZONES as readonly string[]
    if (tzs.includes(detectedTz)) return tzs
    return [detectedTz, ...tzs]
  }, [detectedTz])

  const changeHours = (changed: 'start' | 'end', value: number) => {
    const next = clampTimeRange(
      changed === 'start' ? value : startHour,
      changed === 'end' ? value : endHour,
      changed,
    )
    const pushed = changed === 'start' ? next.end !== endHour : next.start !== startHour
    setStartHour(next.start)
    setEndHour(next.end)
    if (pushed) {
      setRangeHint(true)
      window.setTimeout(() => setRangeHint(false), 2500)
    }
  }

  const selectInMonth = (anchor: Date, category: DayCategory) => {
    const allDays = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) })
    const isWeekend = (d: Date) => {
      const dow = getDay(d)
      return dow === 0 || dow === 6
    }
    const filtered = allDays
      .filter((d) => d >= today)
      .filter((d) => {
        if (category === 'all') return true
        if (category === 'weekdays') return !isWeekend(d)
        return isWeekend(d)
      })
    setSelectedDates((prev) => {
      const existing = new Set(prev.map((d) => d.toDateString()))
      const merged = [...prev]
      for (const d of filtered) {
        if (!existing.has(d.toDateString())) merged.push(d)
      }
      return merged
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (selectedDates.length === 0) {
        throw new Error('Pick at least one date')
      }
      if (startHour >= endHour) {
        throw new Error('Latest must be after earliest')
      }
      const dates = [...selectedDates]
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) => format(d, 'yyyy-MM-dd'))
      const { slug } = await createEvent({
        name,
        mode: 'specific_dates',
        dates,
        timeRange: { start: startHour, end: endHour },
        slotMinutes,
        timezone,
      })
      navigate(`/e/${slug}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuickRow = (anchor: Date) => (
    <div key={anchor.getTime()} className="flex items-center gap-2 text-xs">
      <span className="text-ink-muted w-16 shrink-0">{format(anchor, 'MMMM')}:</span>
      {(['all', 'weekdays', 'weekends'] as const).map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => selectInMonth(anchor, cat)}
          className="text-primary font-bold hover:underline capitalize"
        >
          {cat}
        </button>
      ))}
    </div>
  )

  const summaryLabel = `${formatHour(startHour)} – ${formatHour(endHour)} · ${slotMinutes} min · ${
    timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone
  }`

  const hourSelectClass =
    'w-full bg-raised border-[1.5px] border-line rounded-[12px] px-3 py-2 text-sm text-ink'

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <TextField
        id="event-name"
        label="What’s the occasion?"
        type="text"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Pizza night, team sync, book club…"
      />

      <Card>
        <SegmentedControl
          className="max-w-[260px] mb-3"
          options={[
            { value: 'days', label: 'Pick days' },
            { value: 'range', label: 'Date range' },
          ]}
          value={pickMode}
          onChange={(v) => {
            setPickMode(v)
            setRangeDraft(undefined)
          }}
        />
        {/* One quick-select row per VISIBLE month, aligned above its month column. */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className={`flex-1 ${isMobile ? 'flex justify-center' : 'grid grid-cols-2'}`}>
            {visibleMonths.map((m) => (
              <div key={m.getTime()} className="flex justify-center">
                {renderQuickRow(m)}
              </div>
            ))}
          </div>
          <div className="shrink-0 text-xs text-ink-muted text-right">
            {selectedDates.length} selected
            {selectedDates.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDates([])
                  setRangeDraft(undefined)
                }}
                className="ml-2 underline hover:text-ink"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        {selectedDates.length > 0 && (
          <ul className="mb-2 max-h-40 overflow-y-auto divide-y divide-line rounded-[12px] border border-line bg-raised/40">
            {[...selectedDates]
              .sort((a, b) => a.getTime() - b.getTime())
              .map((d) => (
                <li key={d.toDateString()} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="font-bold">{format(d, 'EEE, MMM d')}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${format(d, 'MMM d')}`}
                    onClick={() =>
                      setSelectedDates((prev) => prev.filter((x) => x.toDateString() !== d.toDateString()))
                    }
                    className="text-ink-muted hover:text-danger px-1"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        )}
        <div className="rdp-side-by-side">
          {pickMode === 'days' ? (
            <DayPicker
              mode="multiple"
              numberOfMonths={isMobile ? 1 : 2}
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates ?? [])}
              disabled={{ before: today }}
              startMonth={today}
            />
          ) : (
            <DayPicker
              mode="range"
              numberOfMonths={isMobile ? 1 : 2}
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={rangeDraft}
              // Already-added days stay visibly highlighted while the next range is drafted.
              modifiers={{ picked: selectedDates }}
              modifiersClassNames={{ picked: 'day-picked' }}
              onSelect={(range) => {
                // day-picker v9 reports the FIRST click as {from: d, to: d} — a
                // range is only complete once the user picks a different end day.
                if (range?.from && range.to && range.from.getTime() !== range.to.getTime()) {
                  const from = range.from
                  const to = range.to
                  setSelectedDates((prev) => mergeRangeIntoDates(prev, from, to, today))
                  setRangeDraft(undefined)
                } else {
                  setRangeDraft(range)
                }
              }}
              disabled={{ before: today }}
              startMonth={today}
            />
          )}
        </div>
        {pickMode === 'range' && (
          <p className="text-xs text-ink-muted">
            Tap a start date, then an end date — the whole span is added to your selection.
          </p>
        )}
      </Card>

      <div className="bg-line/40 rounded-[12px]">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-ink-muted"
        >
          <span>⚙ {summaryLabel}</span>
          <span aria-hidden="true">{advancedOpen ? '▴' : '▾'}</span>
        </button>
        {advancedOpen && (
          <div className="px-4 pb-4 space-y-3">
            {isMobile ? (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs font-bold text-ink-muted mb-1 text-center">Earliest</span>
                    <WheelPicker
                      ariaLabel="Earliest hour"
                      options={HOURS_START}
                      value={startHour}
                      onChange={(v) => changeHours('start', v)}
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-ink-muted mb-1 text-center">Latest</span>
                    <WheelPicker
                      ariaLabel="Latest hour"
                      options={HOURS_END}
                      value={endHour}
                      onChange={(v) => changeHours('end', v)}
                    />
                  </div>
                </div>
                {rangeHint && (
                  <p className="text-xs text-ink-muted mt-1 text-center">
                    Adjusted — the window must be at least 1 hour.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="start-hour" className="block text-xs font-bold text-ink-muted mb-1">Earliest</label>
                    <select id="start-hour" value={startHour} onChange={(e) => changeHours('start', Number(e.target.value))} className={hourSelectClass}>
                      {HOURS_START.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="end-hour" className="block text-xs font-bold text-ink-muted mb-1">Latest</label>
                    <select id="end-hour" value={endHour} onChange={(e) => changeHours('end', Number(e.target.value))} className={hourSelectClass}>
                      {HOURS_END.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {rangeHint && (
                  <p className="text-xs text-ink-muted mt-1">
                    Adjusted — the window must be at least 1 hour.
                  </p>
                )}
              </div>
            )}
            <div>
              <span className="block text-xs font-bold text-ink-muted mb-1">Slot length</span>
              <SegmentedControl
                options={[
                  { value: '15', label: '15 min' },
                  { value: '30', label: '30 min' },
                  { value: '60', label: '1 hour' },
                ]}
                value={String(slotMinutes) as '15' | '30' | '60'}
                onChange={(v) => setSlotMinutes(Number(v) as 15 | 30 | 60)}
              />
            </div>
            <div>
              <label htmlFor="event-tz" className="block text-xs font-bold text-ink-muted mb-1">Time zone</label>
              <div className="flex gap-2">
                <select id="event-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={hourSelectClass}>
                  {tzOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {formatTimezoneLabel(tz)}
                      {tz === detectedTz ? ' — your timezone' : ''}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" type="button" onClick={() => setTimezone(detectedTz)}>
                  Detect
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button size="lg" type="submit" disabled={submitting || !authedUser}>
        {!authedUser ? 'Connecting…' : submitting ? 'Creating…' : 'Create event'}
      </Button>
    </form>
  )
}
