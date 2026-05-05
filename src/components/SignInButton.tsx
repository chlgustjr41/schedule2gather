import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

interface SignInButtonProps {
  /** Optional callback fired AFTER a successful sign-in. Useful for the host page to write ownerEmail. */
  onSignedIn?: (email: string | null) => void
}

export default function SignInButton({ onSignedIn }: SignInButtonProps) {
  const user = useAuthStore((s) => s.user)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signOutFn = useAuthStore((s) => s.signOut)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      // After link, currentUser still references the same User instance with new providerData.
      const fresh = useAuthStore.getState().user
      onSignedIn?.(fresh?.email ?? null)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User dismissed the popup — silent.
      } else {
        const msg = err instanceof Error ? err.message : 'Sign-in failed'
        setError(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    try {
      await signOutFn()
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  const isAnonymous = user.isAnonymous
  const email = user.email

  if (isAnonymous) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="text-sm bg-white border rounded px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
          title="Sign in with Google to keep ownership across devices"
        >
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600 truncate max-w-[200px]" title={email ?? ''}>
        {email ?? 'Signed in'}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
      >
        Sign out
      </button>
    </div>
  )
}
