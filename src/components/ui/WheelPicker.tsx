import { useEffect, useRef } from 'react'

const ITEM_H = 40
const VISIBLE_ROWS = 5
const PAD = (ITEM_H * (VISIBLE_ROWS - 1)) / 2

interface WheelPickerProps {
  options: { value: number; label: string }[]
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}

/**
 * Snap-scrolling picker column (touch-first). Commits the centered option when
 * scrolling settles (`scrollend` where supported, 150ms idle fallback); tapping
 * an option selects it directly. Controlled: external value changes re-align
 * the wheel without re-emitting onChange.
 */
export default function WheelPicker({ options, value, onChange, ariaLabel }: WheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const suppress = useRef(false)

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  // Re-align on controlled value change (e.g., sibling auto-push).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 1) {
      suppress.current = true
      el.scrollTo({ top: target, behavior: 'smooth' })
      window.setTimeout(() => {
        suppress.current = false
      }, 400)
    }
  }, [index])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const commit = () => {
      if (suppress.current) return
      const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      const opt = options[i]
      if (opt && opt.value !== value) onChange(opt.value)
    }
    const onScrollEnd = () => commit()
    el.addEventListener('scrollend', onScrollEnd)
    return () => el.removeEventListener('scrollend', onScrollEnd)
  })

  const onScroll = () => {
    if (suppress.current) return
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const el = scrollRef.current
      if (!el || suppress.current) return
      const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      const opt = options[i]
      if (opt && opt.value !== value) onChange(opt.value)
    }, 150)
  }

  if (options.length === 0) return null

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={ariaLabel}
        title={`Scroll to choose ${ariaLabel.toLowerCase()}`}
        onScroll={onScroll}
        className="h-[200px] overflow-y-auto snap-y snap-mandatory overscroll-contain rounded-[14px] bg-surface border border-line"
        style={{ scrollbarWidth: 'none' }}
      >
        <div style={{ height: PAD }} />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            onClick={() => onChange(o.value)}
            className={`w-full snap-center flex items-center justify-center text-sm ${
              o.value === value ? 'font-extrabold text-ink' : 'text-ink-muted'
            }`}
            style={{ height: ITEM_H }}
          >
            {o.label}
          </button>
        ))}
        <div style={{ height: PAD }} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[40px] border-y border-line bg-primary/5" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[var(--s2g-surface)] to-transparent rounded-t-[14px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--s2g-surface)] to-transparent rounded-b-[14px]" />
    </div>
  )
}
