import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { createEvent } from '@/services/eventService'
import { COMMON_TIMEZONES, detectTimezone, formatTimezoneLabel } from '@/lib/timezones'

export default function CreateEventForm() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(17)
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30)
  const detectedTz = useMemo(() => detectTimezone(), [])
  const [timezone, setTimezone] = useState(detectedTz)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])

  const today = useMemo(() => new Date(), [])
  const nextMonth = useMemo(() => addMonths(today, 1), [today])

  const tzOptions = useMemo(() => {
    const tzs = COMMON_TIMEZONES as readonly string[]
    if (tzs.includes(detectedTz)) return tzs
    return [detectedTz, ...tzs]
  }, [detectedTz])

  const selectAllInMonth = (anchor: Date) => {
    const days = eachDayOfInterval({
      start: startOfMonth(anchor),
      end: endOfMonth(anchor),
    })
    setSelectedDates((prev) => {
      const existing = new Set(prev.map((d) => d.toDateString()))
      const merged = [...prev]
      for (const d of days) {
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

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2">When could the event happen?</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => selectAllInMonth(today)}
            className="text-xs text-indigo-600 hover:text-indigo-700 underline"
          >
            Select all of {format(today, 'MMMM')}
          </button>
          <button
            type="button"
            onClick={() => selectAllInMonth(nextMonth)}
            className="text-xs text-indigo-600 hover:text-indigo-700 underline"
          >
            Select all of {format(nextMonth, 'MMMM')}
          </button>
          {selectedDates.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDates([])}
              className="text-xs text-gray-500 hover:text-gray-700 underline ml-auto"
            >
              Clear
            </button>
          )}
        </div>
        <DayPicker
          mode="multiple"
          numberOfMonths={2}
          selected={selectedDates}
          onSelect={(dates) => setSelectedDates(dates ?? [])}
        />
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
