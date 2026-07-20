import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker, type DateRange, type WeekNumberProps } from 'react-day-picker'
import 'react-day-picker/style.css'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { createEvent } from '@/services/eventService'
import { useAuthStore } from '@/stores/authStore'
import { COMMON_TIMEZONES, detectTimezone, formatTimezoneLabel } from '@/lib/timezones'
import { mergeRangeIntoDates, toggleDays } from '@/lib/dateRange'
import { clampTimeRange } from '@/lib/timeRange'
import { useIsMobile } from '@/hooks/useIsMobile'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ScrollSelect from '@/components/ui/ScrollSelect'
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
  const [datesOnly, setDatesOnly] = useState(false)

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

  // Toggle every occurrence of a given weekday (0=Sun..6=Sat) within `month`.
  const toggleWeekday = (month: Date, weekday: number) => {
    const candidates = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).filter(
      (day) => getDay(day) === weekday && day >= today,
    )
    setSelectedDates((prev) => toggleDays(prev, candidates))
  }

  // Toggle every day in a calendar week (from a week-number cell click).
  const toggleWeek = (weekDates: Date[]) => {
    const candidates = weekDates.filter((day) => day >= today)
    setSelectedDates((prev) => toggleDays(prev, candidates))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (selectedDates.length === 0) {
        throw new Error('Pick at least one date')
      }
      if (!datesOnly && startHour >= endHour) {
        throw new Error('Latest must be after earliest')
      }
      const dates = [...selectedDates]
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) => format(d, 'yyyy-MM-dd'))
      const { slug } = await createEvent({
        name,
        mode: 'specific_dates',
        dates,
        timeRange: datesOnly ? { start: 0, end: 24 } : { start: startHour, end: endHour },
        slotMinutes: datesOnly ? 60 : slotMinutes,
        timezone,
        datesOnly,
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
    <div key={anchor.getTime()} className="flex items-center gap-2 text-xs flex-wrap">
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
      {selectedDates.some((d) => isSameMonth(d, anchor)) && (
        <button
          type="button"
          onClick={() => setSelectedDates((prev) => prev.filter((d) => !isSameMonth(d, anchor)))}
          className="text-danger font-bold hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  )

  // Clickable Mon–Sun titles inside the calendar itself. v9 passes no date
  // context to `components.Weekday`, so the column (position among header
  // cells, offset by the week-number column) and the month (position among
  // rendered .rdp-month blocks) are derived from the DOM at click time.
  const WeekdayHeader = (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th {...props}>
      <button
        type="button"
        title="Select every one of this weekday in the month"
        aria-label={`Toggle this weekday for the whole month`}
        className="w-full min-w-[34px] text-[11px] font-extrabold text-ink-muted bg-raised border border-line rounded-[6px] py-1 hover:bg-primary/15 active:bg-primary/25"
        onClick={(e) => {
          const th = e.currentTarget.closest('th')
          const row = th?.parentElement
          const monthEl = th?.closest('.rdp-month')
          if (!th || !row || !monthEl) return
          const monthIdx = [...document.querySelectorAll('.rdp-month')].indexOf(monthEl)
          const cells = [...row.children]
          const col = cells.indexOf(th) - (cells.length - 7)
          const month = visibleMonths[monthIdx]
          if (month && col >= 0) toggleWeekday(month, col)
        }}
      >
        {props.children}
      </button>
    </th>
  )

  // v9's `onWeekNumberClick` prop is declared in the types (deprecated, typed
  // `any`) but is never read anywhere in DayPicker.js — it's dead. The
  // supported v9 hook is overriding the `WeekNumber` component, which DOES
  // receive `week: CalendarWeek` (with `.days: CalendarDay[]`, each carrying
  // `.date`) — confirmed in node_modules/react-day-picker/dist/esm/classes/CalendarWeek.d.ts
  // and the `showWeekNumber && <components.WeekNumber week={week} .../>` call site.
  // ISO week numbers (27, 28, …) confused users — render a select-row glyph
  // instead (explicit children override the spread's week-number children).
  const WeekNumberCell = ({ week, ...thProps }: WeekNumberProps) => (
    <th
      {...thProps}
      onClick={() => toggleWeek(week.days.map((d) => d.date))}
      role="button"
      title="Select this whole week"
      aria-label="Select this whole week"
    >
      »
    </th>
  )

  const summaryLabel = datesOnly
    ? `Dates only · ${timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone}`
    : `${formatHour(startHour)} – ${formatHour(endHour)} · ${slotMinutes} min · ${
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
        <div className={`mb-1 ${isMobile ? 'flex justify-center' : 'grid grid-cols-2'}`}>
          {visibleMonths.map((m) => (
            <div key={m.getTime()} className="flex justify-center">
              {renderQuickRow(m)}
            </div>
          ))}
        </div>
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
              showWeekNumber
              components={{ WeekNumber: WeekNumberCell, Weekday: WeekdayHeader }}
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
                  // One-shot: a completed range hands control back to individual-day picking.
                  setPickMode('days')
                } else {
                  setRangeDraft(range)
                }
              }}
              disabled={{ before: today }}
              startMonth={today}
              showWeekNumber
              components={{ WeekNumber: WeekNumberCell, Weekday: WeekdayHeader }}
            />
          )}
        </div>
        {pickMode === 'range' && (
          <p className="text-xs text-ink-muted mt-1">
            Tap a start date, then an end date — the whole span is added to your selection.
          </p>
        )}
      </Card>

      {selectedDates.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">
              Selected dates · {selectedDates.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedDates([])
                setRangeDraft(undefined)
              }}
              className="text-xs text-ink-muted underline hover:text-ink"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-40 overflow-y-auto pr-1 divide-y divide-line">
            {[...selectedDates]
              .sort((a, b) => a.getTime() - b.getTime())
              .map((d) => (
                <li key={d.toDateString()} className="flex items-center justify-between gap-2 pl-1 pr-3 py-1 text-sm">
                  <span className="font-bold">{format(d, 'EEE, MMM d')}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${format(d, 'MMM d')}`}
                    onClick={() =>
                      setSelectedDates((prev) => prev.filter((x) => x.toDateString() !== d.toDateString()))
                    }
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-base text-ink-muted hover:text-danger hover:bg-raised"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <div className="bg-line/40 rounded-[12px]">
        <div className="flex justify-end px-4 pt-2">
          <button
            type="button"
            onClick={() => setDatesOnly((v) => !v)}
            aria-pressed={datesOnly}
            title={
              datesOnly
                ? 'Voters mark which days they’re free — no hourly grid. Tap to bring back time selection.'
                : 'Skip hourly time selection — voters just mark which days work'
            }
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-[8px] border-[1.5px] transition ${
              datesOnly
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface text-ink-muted border-line hover:bg-raised'
            }`}
          >
            📅 Date only
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          disabled={datesOnly}
          aria-expanded={advancedOpen}
          title={datesOnly ? 'Not needed for date-only events' : undefined}
          className={`w-full flex items-center justify-between px-4 py-1.5 text-sm font-bold text-ink-muted ${
            datesOnly ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span>⚙ {summaryLabel}</span>
          <span aria-hidden="true">{advancedOpen ? '▴' : '▾'}</span>
        </button>
        {advancedOpen && !datesOnly && (
          <div className="px-4 pb-4 space-y-3">
            {
              isMobile ? (
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
                      <ScrollSelect
                        id="start-hour"
                        ariaLabel="Earliest hour"
                        options={HOURS_START}
                        value={startHour}
                        onChange={(v) => changeHours('start', v)}
                      />
                    </div>
                    <div>
                      <label htmlFor="end-hour" className="block text-xs font-bold text-ink-muted mb-1">Latest</label>
                      <ScrollSelect
                        id="end-hour"
                        ariaLabel="Latest hour"
                        options={HOURS_END}
                        value={endHour}
                        onChange={(v) => changeHours('end', v)}
                      />
                    </div>
                  </div>
                  {rangeHint && (
                    <p className="text-xs text-ink-muted mt-1">
                      Adjusted — the window must be at least 1 hour.
                    </p>
                  )}
                </div>
              )
            }
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
