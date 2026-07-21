import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { DayPicker, type DateRange, type MonthCaptionProps, type WeekNumberProps } from 'react-day-picker'
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
import DualRangeSlider from '@/components/ui/DualRangeSlider'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Switch from '@/components/ui/Switch'
import TextField from '@/components/ui/TextField'
import WheelPicker from '@/components/ui/WheelPicker'

type DayCategory = 'all' | 'weekdays' | 'weekends'

/** `totalMinutes` is minutes-from-midnight, 0..1440 (1440 = end-of-day / 12 AM wrap). */
function formatMinutesLabel(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440
  const h24 = Math.floor(norm / 60)
  const m = norm % 60
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** "09:15" 24-hour format, for the native <input type="time"> desktop fields. */
function minutesToTimeInputValue(totalMinutes: number): string {
  const norm = Math.min(1439, Math.max(0, totalMinutes))
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeInputValueToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Hour-only label, 12-hour clock; `h` may be 24 (end-of-day wrap → "12 AM"). */
function formatHourOnly(h: number): string {
  const norm = h % 24
  const suffix = norm < 12 ? 'AM' : 'PM'
  const display = norm % 12 === 0 ? 12 : norm % 12
  return `${display} ${suffix}`
}

// Mobile's 4 wheels are hour + minute, kept separate so the minute wheel is
// always a short, fast scroll regardless of how wide the day's hour range is.
// Start hours are 0..23 ("12 AM".."11 PM"); end hours are 1..24, where 24 is
// the end-of-day wrap and also reads "12 AM" — mirrors how `startMinutes`/
// `endMinutes` (0..1440) already decompose via Math.floor(total / 60).
const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: formatHourOnly(h) }))
const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: i + 1, label: formatHourOnly(i + 1) }))

/** Minute-of-hour options at `step` increments (e.g. step=15 → 00/15/30/45). */
function buildMinuteOnlyOptions(step: number): { value: number; label: string }[] {
  const clampedStep = Math.min(step, 60)
  const opts = []
  for (let m = 0; m < 60; m += clampedStep) {
    opts.push({ value: m, label: String(m).padStart(2, '0') })
  }
  return opts
}

export default function CreateEventForm() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  // Anonymous sign-in runs on app load; creating an event before it resolves
  // would hit the callable unauthenticated (401). Gate the CTA until ready.
  const authedUser = useAuthStore((s) => s.user)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [startMinutes, setStartMinutes] = useState(9 * 60)
  const [endMinutes, setEndMinutes] = useState(21 * 60)
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(60)
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
  // DayPicker's built-in Nav is suppressed (components.Nav returns null below)
  // in favor of these, rendered on the Pick-days/Date-range toggle's row.
  const canGoPrevMonth = startOfMonth(displayMonth) > startOfMonth(today)
  const goToPrevMonth = () => setDisplayMonth((m) => addMonths(m, -1))
  const goToNextMonth = () => setDisplayMonth((m) => addMonths(m, 1))

  const tzOptions = useMemo(() => {
    const tzs = COMMON_TIMEZONES as readonly string[]
    if (tzs.includes(detectedTz)) return tzs
    return [detectedTz, ...tzs]
  }, [detectedTz])

  // Mobile's minute wheels, regenerated whenever the slot-length step changes
  // (hour wheels are fixed 24-entry constants, defined at module scope above).
  const minuteOnlyOptions = useMemo(() => buildMinuteOnlyOptions(slotMinutes), [slotMinutes])
  const startHourValue = Math.floor(startMinutes / 60)
  const startMinuteValue = startMinutes % 60
  const endHourValue = Math.floor(endMinutes / 60)
  const endMinuteValue = endMinutes % 60

  const changeMinutes = (changed: 'start' | 'end', value: number) => {
    const next = clampTimeRange(
      changed === 'start' ? value : startMinutes,
      changed === 'end' ? value : endMinutes,
      changed,
      slotMinutes,
    )
    const pushed = changed === 'start' ? next.end !== endMinutes : next.start !== startMinutes
    setStartMinutes(next.start)
    setEndMinutes(next.end)
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
      if (!datesOnly && startMinutes >= endMinutes) {
        throw new Error('Latest must be after earliest')
      }
      const dates = [...selectedDates]
        .sort((a, b) => a.getTime() - b.getTime())
        .map((d) => format(d, 'yyyy-MM-dd'))
      const { slug } = await createEvent({
        name,
        mode: 'specific_dates',
        dates,
        timeRange: datesOnly ? { start: 0, end: 24 } : { start: startMinutes / 60, end: endMinutes / 60 },
        slotMinutes: datesOnly ? 60 : slotMinutes,
        timezone,
        datesOnly,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      })
      navigate(`/e/${slug}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Merged into the same row as each month's bold "Month YYYY" caption
  // (react-day-picker v9's MonthCaption override), replacing the old
  // separate grey quick-select row above the calendar.
  const MonthCaption = ({ calendarMonth }: MonthCaptionProps) => {
    const anchor = calendarMonth.date
    return (
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-2 px-1">
        <span className="text-base font-extrabold">{format(anchor, 'MMMM yyyy')}</span>
        <div className="flex items-center gap-2 text-xs flex-wrap">
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
      </div>
    )
  }

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
    : `${formatMinutesLabel(startMinutes)} – ${formatMinutesLabel(endMinutes)} · ${slotMinutes} min · ${
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

      <div className="bg-line/40 rounded-[12px]">
        <button
          type="button"
          onClick={() => setOptionalOpen((v) => !v)}
          aria-expanded={optionalOpen}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-ink-muted"
        >
          <span>
            📍📝 Location &amp; description (optional)
            {(location.trim() || description.trim()) && (
              <span className="text-primary ml-1.5" aria-hidden="true">●</span>
            )}
          </span>
          <span aria-hidden="true">{optionalOpen ? '▴' : '▾'}</span>
        </button>
        <AnimatePresence initial={false}>
          {optionalOpen && (
            <motion.div
              key="optional-fields"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <TextField
                  id="event-location"
                  label="📍 Location (optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where's it happening? (optional)"
                  maxLength={200}
                />
                <div>
                  <label
                    htmlFor="event-description"
                    className="block text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-1.5"
                  >
                    📝 Description (optional)
                  </label>
                  <textarea
                    id="event-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Any extra details voters should know…"
                    maxLength={1000}
                    rows={3}
                    className="w-full bg-raised border-[1.5px] border-line rounded-[12px] px-4 py-3 text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-primary resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <Button
            type="button"
            variant={pickMode === 'range' ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={pickMode === 'range'}
            onClick={() => {
              setPickMode(pickMode === 'range' ? 'days' : 'range')
              setRangeDraft(undefined)
            }}
            title={
              pickMode === 'range'
                ? 'Pick a start and end date — reverts to single-day picking once the range is complete'
                : 'Turn on to select a whole date range in one go, instead of picking days one at a time'
            }
          >
            📆 Date range mode
          </Button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevMonth}
              disabled={!canGoPrevMonth}
              aria-label="Previous month"
              title="Previous month"
              className="w-8 h-8 rounded-full border border-line bg-surface text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              title="Next month"
              className="w-8 h-8 rounded-full border border-line bg-surface text-ink-muted hover:text-ink flex items-center justify-center"
            >
              ›
            </button>
          </div>
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
              components={{ WeekNumber: WeekNumberCell, Weekday: WeekdayHeader, MonthCaption, Nav: () => <></> }}
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
              components={{ WeekNumber: WeekNumberCell, Weekday: WeekdayHeader, MonthCaption, Nav: () => <></> }}
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
        <div className="flex justify-start px-4 pt-2">
          <Switch
            checked={datesOnly}
            onChange={setDatesOnly}
            label="📅 Date only"
            title={
              datesOnly
                ? 'Voters mark which days they’re free — no hourly grid. Tap to bring back time selection.'
                : 'Skip hourly time selection — voters just mark which days work'
            }
          />
        </div>
        {datesOnly && (
          <p className="px-4 pt-1 text-xs text-ink-muted">
            Time-slot voting is off — voters will only pick which days work.
          </p>
        )}
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
        <AnimatePresence initial={false}>
          {advancedOpen && !datesOnly && (
            <motion.div
              key="advanced-settings"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {isMobile ? (
                  <div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-xs font-bold text-ink-muted text-center">Earliest</span>
                      <span className="text-xs font-bold text-ink-muted text-center">Latest</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      <WheelPicker
                        ariaLabel="Earliest hour"
                        options={START_HOUR_OPTIONS}
                        value={startHourValue}
                        onChange={(h) => changeMinutes('start', h * 60 + startMinuteValue)}
                      />
                      <WheelPicker
                        ariaLabel="Earliest minute"
                        options={minuteOnlyOptions}
                        value={startMinuteValue}
                        onChange={(m) => changeMinutes('start', startHourValue * 60 + m)}
                      />
                      <WheelPicker
                        ariaLabel="Latest hour"
                        options={END_HOUR_OPTIONS}
                        value={endHourValue}
                        onChange={(h) => changeMinutes('end', h * 60 + endMinuteValue)}
                      />
                      <WheelPicker
                        ariaLabel="Latest minute"
                        options={minuteOnlyOptions}
                        value={endMinuteValue}
                        onChange={(m) => changeMinutes('end', endHourValue * 60 + m)}
                      />
                    </div>
                    {rangeHint && (
                      <p className="text-xs text-ink-muted mt-1 text-center">
                        Adjusted — the window must be at least {slotMinutes} min.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-ink-muted">Earliest – Latest</span>
                      <span className="text-xs font-bold text-ink">
                        {formatMinutesLabel(startMinutes)} – {formatMinutesLabel(endMinutes)}
                      </span>
                    </div>
                    <DualRangeSlider
                      min={0}
                      max={1440}
                      step={slotMinutes}
                      startValue={startMinutes}
                      endValue={endMinutes}
                      onStartChange={(v) => changeMinutes('start', v)}
                      onEndChange={(v) => changeMinutes('end', v)}
                      ariaLabelStart="Earliest time"
                      ariaLabelEnd="Latest time"
                    />
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label htmlFor="start-time-input" className="block text-xs font-bold text-ink-muted mb-1">
                          Earliest
                        </label>
                        <input
                          id="start-time-input"
                          type="time"
                          step={slotMinutes * 60}
                          value={minutesToTimeInputValue(startMinutes)}
                          onChange={(e) => {
                            const v = timeInputValueToMinutes(e.target.value)
                            if (v !== null) changeMinutes('start', v)
                          }}
                          className={hourSelectClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="end-time-input" className="block text-xs font-bold text-ink-muted mb-1">
                          Latest
                        </label>
                        <input
                          id="end-time-input"
                          type="time"
                          step={slotMinutes * 60}
                          value={minutesToTimeInputValue(endMinutes)}
                          onChange={(e) => {
                            const v = timeInputValueToMinutes(e.target.value)
                            if (v !== null) changeMinutes('end', v)
                          }}
                          className={hourSelectClass}
                        />
                      </div>
                    </div>
                    {rangeHint && (
                      <p className="text-xs text-ink-muted mt-1">
                        Adjusted — the window must be at least {slotMinutes} min.
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
                    onChange={(v) => {
                      const nextStep = Number(v) as 15 | 30 | 60
                      setSlotMinutes(nextStep)
                      // Re-snap both bounds so they stay valid under the new granularity
                      // (e.g. a 9:15 boundary set at 15-min slots isn't valid at 60-min slots).
                      const snap = (n: number) => Math.round(n / nextStep) * nextStep
                      setStartMinutes((prev) => Math.min(1440 - nextStep, Math.max(0, snap(prev))))
                      setEndMinutes((prev) => Math.max(nextStep, Math.min(1440, snap(prev))))
                    }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button size="lg" type="submit" disabled={submitting || !authedUser}>
        {!authedUser ? 'Connecting…' : submitting ? 'Creating…' : 'Create event'}
      </Button>
    </form>
  )
}
