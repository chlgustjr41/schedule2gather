import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { createEvent, type CreateEventInput } from '@/services/eventService'

type Tab = 'specific' | 'weekdays'
type WeekdaySubmode = 'recurring' | 'in_range'
const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export default function CreateEventForm() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('specific')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(17)
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30)
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)

  const [selectedDates, setSelectedDates] = useState<Date[]>([])

  const [weekdaySubmode, setWeekdaySubmode] = useState<WeekdaySubmode>('recurring')
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<string>>(new Set(['mon', 'wed', 'fri']))
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined)
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined)

  const toggleWeekday = (w: string) => {
    setSelectedWeekdays((prev) => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      let input: CreateEventInput

      if (tab === 'specific') {
        if (selectedDates.length === 0) {
          throw new Error('Pick at least one date')
        }
        const dates = [...selectedDates]
          .sort((a, b) => a.getTime() - b.getTime())
          .map((d) => format(d, 'yyyy-MM-dd'))
        input = {
          name,
          mode: 'specific_dates',
          dates,
          timeRange: { start: startHour, end: endHour },
          slotMinutes,
          timezone,
        }
      } else if (weekdaySubmode === 'recurring') {
        if (selectedWeekdays.size === 0) {
          throw new Error('Pick at least one weekday')
        }
        const dates = WEEKDAY_NAMES.filter((w) => selectedWeekdays.has(w))
        input = {
          name,
          mode: 'weekdays_recurring',
          dates: [...dates],
          timeRange: { start: startHour, end: endHour },
          slotMinutes,
          timezone,
        }
      } else {
        if (!rangeFrom || !rangeTo) {
          throw new Error('Pick a date range')
        }
        if (selectedWeekdays.size === 0) {
          throw new Error('Pick at least one weekday')
        }
        const allDates = eachDayOfInterval({ start: rangeFrom, end: rangeTo })
        const dates = allDates
          .filter((d) => selectedWeekdays.has(WEEKDAY_NAMES[getDay(d)]))
          .map((d) => format(d, 'yyyy-MM-dd'))
        if (dates.length === 0) {
          throw new Error('No dates match those weekdays in the chosen range')
        }
        input = {
          name,
          mode: 'weekdays_in_range',
          dates,
          timeRange: { start: startHour, end: endHour },
          slotMinutes,
          timezone,
        }
      }

      const { slug } = await createEvent(input)
      navigate(`/e/${slug}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium">Event name</label>
        <input
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="Team standup"
        />
      </div>

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab('specific')}
          className={`px-4 py-2 ${tab === 'specific' ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-500'}`}
        >
          Specific dates
        </button>
        <button
          type="button"
          onClick={() => setTab('weekdays')}
          className={`px-4 py-2 ${tab === 'weekdays' ? 'border-b-2 border-indigo-600 font-medium' : 'text-gray-500'}`}
        >
          Days of week
        </button>
      </div>

      {tab === 'specific' && (
        <div>
          <label className="block text-sm font-medium mb-2">Pick dates</label>
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={(dates) => setSelectedDates(dates ?? [])}
          />
          <p className="mt-2 text-sm text-gray-500">{selectedDates.length} selected</p>
        </div>
      )}

      {tab === 'weekdays' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={weekdaySubmode === 'recurring'}
                onChange={() => setWeekdaySubmode('recurring')}
              />
              Recurring (no dates)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={weekdaySubmode === 'in_range'}
                onChange={() => setWeekdaySubmode('in_range')}
              />
              Within date range
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pick weekdays</label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAY_NAMES.map((w) => (
                <label key={w} className="flex items-center gap-1 px-3 py-1 border rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWeekdays.has(w)}
                    onChange={() => toggleWeekday(w)}
                  />
                  {w.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {weekdaySubmode === 'in_range' && (
            <div>
              <label className="block text-sm font-medium mb-2">Date range</label>
              <DayPicker
                mode="range"
                selected={{ from: rangeFrom, to: rangeTo }}
                onSelect={(range) => {
                  setRangeFrom(range?.from)
                  setRangeTo(range?.to)
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Start hour</label>
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
          <label className="block text-sm font-medium">End hour</label>
          <input
            type="number"
            min={1}
            max={24}
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Slot size</label>
        <select
          value={slotMinutes}
          onChange={(e) => setSlotMinutes(Number(e.target.value) as 15 | 30 | 60)}
          className="mt-1 w-full border rounded px-3 py-2"
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Time zone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          placeholder="America/New_York"
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
