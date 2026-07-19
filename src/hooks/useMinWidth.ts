import { useEffect, useState } from 'react'

/** True when viewport width ≥ px. Re-renders on resize. */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= px
  })
  useEffect(() => {
    const onResize = () => setMatches(window.innerWidth >= px)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [px])
  return matches
}
