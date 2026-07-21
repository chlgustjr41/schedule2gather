import { create } from 'zustand'

interface PaintState {
  origin: number | null
  visited: Set<number>
  draftBits: boolean[] | null
  /** "on" means the drag is filling cells true; "off" means clearing. Null when not painting. */
  mode: 'on' | 'off' | null
  paintMode: boolean
  /**
   * Whether the viewer's own AvailabilityGrid is currently in "not available"
   * paint mode, and exactly which slot indices are sitting in the
   * toggle-inverted state because of it. Shared via this store (rather than
   * local component state) so GroupHeatmap can translate the viewer's own
   * bits back to their real meaning for those specific slots — otherwise the
   * group overlap would misread "marked busy" (bit=true while inverted) as
   * "available" until the mode is turned back off.
   */
  notAvailableMode: boolean
  notAvailableSlotIndices: number[]

  startPaint: (slotIdx: number, currentBits: boolean[]) => void
  dragTo: (slotIdx: number, currentBits: boolean[]) => void
  commitPaint: () => boolean[] | null
  setPaintMode: (on: boolean) => void
  setNotAvailableMode: (on: boolean, slotIndices: number[]) => void
}

export const usePaintStore = create<PaintState>((set, get) => ({
  origin: null,
  visited: new Set<number>(),
  draftBits: null,
  mode: null,
  // On mobile this drives the "Paint Mode" toggle (desktop ignores it — painting
  // is always on there). Defaulting to true skips a tap most mobile users expect anyway.
  paintMode: true,

  startPaint: (slotIdx, currentBits) => {
    const startState = currentBits[slotIdx] ?? false
    // Paint-by-example: drag turns cells to the OPPOSITE of the start cell's state.
    const mode: 'on' | 'off' = startState ? 'off' : 'on'
    const visited = new Set<number>([slotIdx])
    const draftBits = [...currentBits]
    draftBits[slotIdx] = mode === 'on'
    set({ origin: slotIdx, visited, draftBits, mode })
  },

  /**
   * Paintbrush behavior: each cell the cursor enters during the drag is added to the
   * visited set and painted. Re-entering an already-visited cell is a no-op (mode is
   * locked to whatever the start cell determined).
   */
  dragTo: (slotIdx, currentBits) => {
    const state = get()
    if (state.origin === null || state.mode === null) return
    if (state.visited.has(slotIdx)) return
    const visited = new Set(state.visited)
    visited.add(slotIdx)
    const value = state.mode === 'on'
    const draftBits = [...currentBits]
    for (const idx of visited) draftBits[idx] = value
    set({ visited, draftBits })
  },

  commitPaint: () => {
    const state = get()
    const draft = state.draftBits
    set({ origin: null, visited: new Set<number>(), draftBits: null, mode: null })
    return draft
  },

  setPaintMode: (on) => {
    set({ paintMode: on })
  },

  notAvailableMode: false,
  notAvailableSlotIndices: [],
  setNotAvailableMode: (on, slotIndices) => {
    set({ notAvailableMode: on, notAvailableSlotIndices: on ? slotIndices : [] })
  },
}))
