import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export default function App() {
  const init = useAuthStore((s) => s.init)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    const unsub = init()
    return unsub
  }, [init])

  useEffect(() => {
    if (user) {
      // TODO(p1): remove — needed for P0 acceptance only
      console.log('Anonymous UID:', user.uid)
    }
  }, [user])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">schedule2gather</h1>
        <p className="mt-2 text-gray-500">Phase 0 — Foundation</p>
        <p className="mt-4 text-sm">
          {loading ? 'Signing in…' : user ? `Signed in: ${user.uid.slice(0, 8)}…` : 'Not signed in'}
        </p>
      </div>
    </div>
  )
}
