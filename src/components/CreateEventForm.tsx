import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker } from 'react-day-picker'
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
import { COMMON_TIMEZONES, detectTimezone, formatTimezoneLabel } from '@/lib/timezones'
import { useIsMobile } from '@/hooks/useIsMobile'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SegmentedControl from '@/components/ui/SegmentedControl'
import TextField from '@/components/ui/TextField'

type DayCategory = 'all' | 'weekdays' | 'weekends'

function formatHour(h: number): string {
  const norm = h % 24
  const suffix = norm < 12 ? 'AM' : 'PM'
  const display = norm % 12 === 0 ? 12 : norm % 12
  return `${display} ${suffix}`
}

export default function CreateEventForm() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
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

  const today = useMemo(() => startOfDay(new Date()), [])
  const nextMonth = useMemo(() => addMonths(today, 1), [today])

  const tzOptions = useMemo(() => {
    const tzs = COMMON_TIMEZONES as readonly string[]
    if (tzs.includes(detectedTz)) return tzs
    return [detectedTz, ...tzs]
  }, [detectedTz])

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
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-6 gap-y-2 mb-3">
          {renderQuickRow(today)}
          {renderQuickRow(nextMonth)}
          {selectedDates.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDates([])}
              className="text-xs text-ink-muted hover:text-ink underline sm:ml-auto self-start sm:self-auto"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="rdp-side-by-side">
          <DayPicker
            mode="multiple"
            numberOfMonths={isMobile ? 1 : 2}
            selected={selectedDates}
            onSelect={(dates) => setSelectedDates(dates ?? [])}
            disabled={{ before: today }}
            startMonth={today}
          />
        </div>
        <p className="mt-1 text-xs text-ink-muted">{selectedDates.length} selected</p>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-hour" className="block text-xs font-bold text-ink-muted mb-1">Earliest</label>
                <select id="start-hour" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={hourSelectClass}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="end-hour" className="block text-xs font-bold text-ink-muted mb-1">Latest</label>
                <select id="end-hour" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={hourSelectClass}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
            </div>
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

      <Button size="lg" type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create event'}
      </Button>
    </form>
  )
}
