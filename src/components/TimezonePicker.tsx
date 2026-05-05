import { useMemo } from 'react'
import { COMMON_TIMEZONES, detectTimezone, formatTimezoneLabel } from '@/lib/timezones'

interface TimezonePickerProps {
  value: string
  onChange: (tz: string) => void
}

export default function TimezonePicker({ value, onChange }: TimezonePickerProps) {
  const detected = useMemo(() => detectTimezone(), [])
  const options = useMemo(() => {
    const tzs = COMMON_TIMEZONES as readonly string[]
    const list = tzs.includes(detected) ? [...tzs] : [detected, ...tzs]
    if (!list.includes(value)) list.unshift(value)
    return list
  }, [detected, value])

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-gray-500 whitespace-nowrap" htmlFor="viewer-tz">
        Viewing in:
      </label>
      <select
        id="viewer-tz"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-1 text-sm max-w-[260px]"
      >
        {options.map((tz) => (
          <option key={tz} value={tz}>
            {formatTimezoneLabel(tz)}
            {tz === detected ? ' — your timezone' : ''}
          </option>
        ))}
      </select>
      {value !== detected && (
        <button
          type="button"
          onClick={() => onChange(detected)}
          className="text-xs text-indigo-600 hover:text-indigo-700 underline"
          title="Reset to your detected timezone"
        >
          Reset
        </button>
      )}
    </div>
  )
}
