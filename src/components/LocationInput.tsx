import { useEffect, useRef, useState } from 'react'
import { searchAddress, resolveAddress, type AddressSuggestion } from '@/services/placesService'
import { googleMapsSearchUrl } from '@/lib/googleMaps'

interface LocationInputProps {
  value: string
  onChange: (value: string) => void
  /** True once the value was confirmed via a Places selection — only then does it render as a map link. */
  isMapLink: boolean
  onIsMapLinkChange: (v: boolean) => void
}

/**
 * Location field with two modes: plain Text (freeform, never linked) and
 * Search (Places autocomplete; selecting a suggestion confirms a real
 * address and flips `isMapLink` so callers render it as a Google Maps link).
 * Typing after a confirmed selection un-confirms it until a suggestion is
 * picked again.
 */
export default function LocationInput({ value, onChange, isMapLink, onIsMapLinkChange }: LocationInputProps) {
  const [mode, setMode] = useState<'text' | 'search'>(isMapLink ? 'search' : 'text')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  useEffect(() => () => window.clearTimeout(debounceRef.current), [])

  const runSearch = (text: string) => {
    window.clearTimeout(debounceRef.current)
    if (!text.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      searchAddress(text)
        .then((results) => {
          setSuggestions(results)
          setOpen(results.length > 0)
        })
        .catch((err: unknown) => {
          setSuggestions([])
          setOpen(false)
          setError(err instanceof Error ? err.message : 'Search failed')
        })
        .finally(() => setLoading(false))
    }, 300)
  }

  const handleInputChange = (text: string) => {
    onChange(text)
    if (isMapLink) onIsMapLinkChange(false)
    if (mode === 'search') runSearch(text)
  }

  const handleSelect = (s: AddressSuggestion) => {
    setOpen(false)
    setSuggestions([])
    setLoading(true)
    setError(null)
    resolveAddress(s.placeId)
      .then((formatted) => {
        onChange(formatted || s.text)
        onIsMapLinkChange(true)
      })
      .catch(() => {
        onChange(s.text)
        onIsMapLinkChange(false)
        setError("Couldn't confirm that address — try again.")
      })
      .finally(() => setLoading(false))
  }

  const switchMode = (next: 'text' | 'search') => {
    setMode(next)
    setOpen(false)
    setSuggestions([])
    setError(null)
    if (next === 'text' && isMapLink) onIsMapLinkChange(false)
  }

  return (
    <div ref={rootRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label
          htmlFor="location-input"
          className="block text-[10px] font-extrabold uppercase tracking-widest text-ink-muted"
        >
          📍 Location (optional)
        </label>
        <div className="flex bg-line/60 rounded-full p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => switchMode('text')}
            title="Plain text — no map link"
            className={`px-2.5 py-1 rounded-full font-bold transition ${
              mode === 'text' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => switchMode('search')}
            title="Search Google Maps for a real address"
            className={`px-2.5 py-1 rounded-full font-bold transition ${
              mode === 'search' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            🔍 Search
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          id="location-input"
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          maxLength={200}
          placeholder={mode === 'search' ? 'Search for an address…' : "Where's it happening? (optional)"}
          className="w-full bg-raised border-[1.5px] border-line rounded-[12px] px-4 py-3 text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-primary"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted" aria-hidden="true">
            …
          </span>
        )}
        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Address suggestions"
            className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-[12px] border border-line bg-surface shadow-lg py-1"
          >
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-raised"
                >
                  {s.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {mode === 'search' && isMapLink && value && (
        <a
          href={googleMapsSearchUrl(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-primary hover:underline font-bold mt-1"
        >
          ✅ Confirmed — view on Google Maps ↗
        </a>
      )}
    </div>
  )
}
