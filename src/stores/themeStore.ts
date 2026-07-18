import { create } from 'zustand'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 's2g-theme'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref)
}

interface ThemeState {
  preference: ThemePreference
  init: () => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',

  init: () => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      // localStorage unavailable (private mode) — fall back to system.
    }
    const pref: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system'
    set({ preference: pref })
    applyTheme(pref)
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get().preference === 'system') applyTheme('system')
      })
    }
  },

  toggle: () => {
    const next: ThemePreference = resolveTheme(get().preference) === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // persistence is best-effort
    }
    set({ preference: next })
    applyTheme(next)
  },
}))
