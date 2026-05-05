import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfDay,
  getDay,
} from 'date-fns'
import { createEvent } from '@/services/eventService'
import { COMMON_TIMEZONES, detectTimezone, formatTimezoneLabel } from '@/lib/timezones'
import { useIsMobile } from '@/hooks/useIsMobile'

type DayCategory = 'all' | 'weekdays' | 'weekends'

export default function CreateEventForm() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(17)
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30)
  const detectedTz = useMemo(() => detectTimezone(), [])
  const [timezone, setTimezone] = useState(detectedTz)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])

  const today = useMemo(() => startOfDay(new Date()), [])
  const nextMonth = useMemo(() => addMonths(today, 1), [today])

  const tzOptions = useMemo(() => {
    const tzs = COMMON_TIMEZONES as readonly string[]
    if (tzs.includes(detectedTz)) return tzs
    return [detectedTz, ...tzs]
  }, [detectedTz])

  const selectInMonth = (anchor: Date, category: DayCategory) => {
    const allDays = eachDayOfInterval({
      start: startOfMonth(anchor),
      end: endOfMonth(anchor),
    })
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
      <span className="text-gray-500 w-16 shrink-0">{format(anchor, 'MMMM')}:</span>
      <button
        type="button"
        onClick={() => selectInMonth(anchor, 'all')}
        className="text-indigo-600 hover:text-indigo-700 underline"
      >
        All
      </button>
      <button
        type="button"
        onClick={() => selectInMonth(anchor, 'weekdays')}
        className="text-indigo-600 hover:text-indigo-700 underline"
      >
        Weekdays
      </button>
      <button
        type="button"
        onClick={() => selectInMonth(anchor, 'weekends')}
        className="text-indigo-600 hover:text-indigo-700 underline"
      >
        Weekends
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2">When could the event happen?</label>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-6 gap-y-2 mb-3">
          {renderQuickRow(today)}
          {renderQuickRow(nextMonth)}
          {selectedDates.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDates([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline sm:ml-auto self-start sm:self-auto"
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
        <p className="mt-1 text-xs text-gray-500">{selectedDates.length} selected</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">From (hour)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">To (hour)</label>
          <input
            type="number"
            min={1}
            max={24}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Slot</label>
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value) as 15 | 30 | 60)}
            className="mt-1 w-full border rounded px-3 py-2"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Time zone</label>
        <div className="flex gap-2 mt-1">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {formatTimezoneLabel(tz)}
                {tz === detectedTz ? ' — your timezone' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setTimezone(detectedTz)}
            className="text-sm border rounded px-3 py-2 hover:bg-gray-50"
            title="Reset to auto-detected timezone"
          >
            Detect
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Event name</label>
        <input
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="Coffee with the team"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-indigo-600 text-white py-3 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}
