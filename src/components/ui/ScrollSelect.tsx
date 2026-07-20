import { useEffect, useRef, useState } from 'react'

interface ScrollSelectOption {
  value: number
  label: string
}

interface ScrollSelectProps {
  id?: string
  options: ScrollSelectOption[]
  value: number
  onChange: (value: number) => void
  ariaLabel: string
  className?: string
}

/**
 * Compact desktop dropdown whose open panel is an explicit scrollable listbox
 * (max-height + overflow-y-auto) instead of relying on the browser's native
 * <select> popup, so long option lists (e.g. 24 hours) are reliably and
 * visibly scrollable across browsers. Closes on outside click, Escape, or
 * selection; scrolls the current value into view when opened.
 */
export default function ScrollSelect({
  id,
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: ScrollSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDocPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-raised border-[1.5px] border-line rounded-[12px] px-3 py-2 text-sm text-ink text-left flex items-center justify-between"
      >
        <span>{selected?.label ?? '—'}</span>
        <span aria-hidden="true" className="text-ink-muted text-xs ml-2">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-[12px] border border-line bg-surface shadow-lg py-1"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm ${
                  o.value === value ? 'bg-primary/15 text-ink font-bold' : 'text-ink hover:bg-raised'
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
