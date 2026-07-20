import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

const KEY = 's2g-last-activity'
const IDLE_MS = 60 * 60_000
const WRITE_THROTTLE_MS = 30_000

/**
 * Signs Google users out after 1h without interaction. Activity is shared
 * across tabs via localStorage; anonymous voting identity is never touched.
 * Inert when localStorage is unavailable.
 */
export function useAutoLogoff(): void {
  const signOut = useAuthStore((s) => s.signOut)

  useEffect(() => {
    let lastWrite = 0
    const touch = () => {
      const now = Date.now()
      if (now - lastWrite < WRITE_THROTTLE_MS) return
      lastWrite = now
      try {
        localStorage.setItem(KEY, String(now))
      } catch {
        // inert without storage
      }
    }
    const check = () => {
      if (!useAuthStore.getState().isGoogleUser) return
      let last: number
      try {
        const raw = localStorage.getItem(KEY)
        if (raw === null) {
          localStorage.setItem(KEY, String(Date.now()))
          return
        }
        last = Number(raw)
      } catch {
        return
      }
      if (Number.isFinite(last) && Date.now() - last > IDLE_MS) void signOut()
    }
    touch()
    check()
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    const interval = window.setInterval(check, 60_000)
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      window.clearInterval(interval)
    }
  }, [signOut])
}
