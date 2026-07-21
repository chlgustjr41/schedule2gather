import { create } from 'zustand'

interface PaintState {
  origin: number | null
  visited: Set<number>
  draftBits: boolean[] | null
  /** "on" means the drag is filling cells true; "off" means clearing. Null when not painting. */
  mode: 'on' | 'off' | null
  paintMode: boolean
  /**
   * The viewer's own availability, already translated for Group overlap's
   * purposes — or null when no translation is needed (raw committed data is
   * fine as-is). AvailabilityGrid computes this SYNCHRONOUSLY, from purely
   * local values, every time it writes availability while "not available"
   * mode is involved, and pushes the finished array here in the same tick as
   * the write. GroupHeatmap just reads it — it never derives a translation
   * itself from the mode flag plus the (separately, asynchronously arriving)
   * committed data, which is what caused a real one-frame flicker: those two
   * signals don't always land in the same React commit, so briefly reading
   * one new + one stale produced a fully-inverted-from-correct frame.
   */
  myOverlapOverride: boolean[] | null

  startPaint: (slotIdx: number, currentBits: boolean[]) => void
  dragTo: (slotIdx: number, currentBits: boolean[]) => void
  commitPaint: () => boolean[] | null
  setPaintMode: (on: boolean) => void
  setMyOverlapOverride: (bits: boolean[] | null) => void
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

  myOverlapOverride: null,
  setMyOverlapOverride: (bits) => {
    set({ myOverlapOverride: bits })
  },
}))
