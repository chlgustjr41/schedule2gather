import { useState } from 'react'

interface DualRangeSliderProps {
  min: number
  max: number
  step: number
  startValue: number
  endValue: number
  onStartChange: (v: number) => void
  onEndChange: (v: number) => void
  ariaLabelStart?: string
  ariaLabelEnd?: string
}

const THUMB_CLASS =
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface ' +
  '[&::-webkit-slider-thumb]:shadow-[var(--s2g-shadow-card)] [&::-webkit-slider-thumb]:cursor-pointer ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 ' +
  '[&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[var(--s2g-shadow-card)] ' +
  '[&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent'

/**
 * Two native range inputs stacked on one track (the standard CSS trick for a
 * dual-thumb slider without a library): each input is transparent/full-width
 * with `pointer-events: none`, and only its thumb opts back into pointer
 * events, so dragging one thumb never fights the other. Whichever thumb was
 * last interacted with gets a higher z-index so it stays grabbable when the
 * two values are close together.
 */
export default function DualRangeSlider({
  min,
  max,
  step,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  ariaLabelStart = 'Start',
  ariaLabelEnd = 'End',
}: DualRangeSliderProps) {
  const [active, setActive] = useState<'start' | 'end'>('end')
  const startPct = ((startValue - min) / (max - min)) * 100
  const endPct = ((endValue - min) / (max - min)) * 100

  return (
    <div className="relative h-6 flex items-center">
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-line" />
      <div
        className="absolute h-1.5 rounded-full bg-primary"
        style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={startValue}
        onPointerDown={() => setActive('start')}
        onChange={(e) => onStartChange(Math.min(Number(e.target.value), endValue - step))}
        aria-label={ariaLabelStart}
        style={{ zIndex: active === 'start' ? 2 : 1 }}
        className={`absolute inset-x-0 w-full h-6 appearance-none bg-transparent pointer-events-none ${THUMB_CLASS}`}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={endValue}
        onPointerDown={() => setActive('end')}
        onChange={(e) => onEndChange(Math.max(Number(e.target.value), startValue + step))}
        aria-label={ariaLabelEnd}
        style={{ zIndex: active === 'end' ? 2 : 1 }}
        className={`absolute inset-x-0 w-full h-6 appearance-none bg-transparent pointer-events-none ${THUMB_CLASS}`}
      />
    </div>
  )
}
