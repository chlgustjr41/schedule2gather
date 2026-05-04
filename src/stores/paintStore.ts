import { create } from 'zustand'
import { setRectangle } from '@/lib/bitmap'

interface PaintState {
  origin: number | null
  current: number | null
  draftBits: boolean[] | null
  /** "on" means the drag is filling cells true; "off" means clearing. Null when not painting. */
  mode: 'on' | 'off' | null

  startPaint: (slotIdx: number, currentBits: boolean[]) => void
  dragTo: (slotIdx: number, currentBits: boolean[], slotsPerDay: number) => void
  commitPaint: () => boolean[] | null
}

export const usePaintStore = create<PaintState>((set, get) => ({
  origin: null,
  current: null,
  draftBits: null,
  mode: null,

  startPaint: (slotIdx, currentBits) => {
    const startState = currentBits[slotIdx] ?? false
    // Paint-by-example: drag turns cells to the OPPOSITE of the start cell's state.
    const mode: 'on' | 'off' = startState ? 'off' : 'on'
    set({
      origin: slotIdx,
      current: slotIdx,
      mode,
      // Initial draft is currentBits with the start cell flipped to mode (single-cell rectangle).
      draftBits: setRectangle(currentBits, slotIdx, slotIdx, mode === 'on', 1),
    })
  },

  dragTo: (slotIdx, currentBits, slotsPerDay) => {
    const state = get()
    if (state.origin === null || state.mode === null) return
    const value = state.mode === 'on'
    const draftBits = setRectangle(currentBits, state.origin, slotIdx, value, slotsPerDay)
    set({ current: slotIdx, draftBits })
  },

  commitPaint: () => {
    const state = get()
    const draft = state.draftBits
    set({ origin: null, current: null, draftBits: null, mode: null })
    return draft
  },
}))
