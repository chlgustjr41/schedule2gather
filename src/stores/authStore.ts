import { create } from 'zustand'
import {
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '@/services/firebase'

interface AuthState {
  user: User | null
  loading: boolean
  init: () => () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((setState) => ({
  user: null,
  loading: true,

  init: () => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setState({ user, loading: false })
      } else {
        try {
          await signInAnonymously(auth)
          // onAuthStateChanged will fire again with the new user
        } catch (err) {
          console.error('Anonymous sign-in failed:', err)
          setState({ user: null, loading: false })
        }
      }
    })
    return unsub
  },

  signInWithGoogle: async () => {
    const current = auth.currentUser
    if (current && current.isAnonymous) {
      try {
        await linkWithPopup(current, googleProvider)
        return
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
          // Fall through to sign-in
        } else {
          throw err
        }
      }
    }
    await signInWithPopup(auth, googleProvider)
  },

  signOut: async () => {
    await fbSignOut(auth)
    // The auth listener will fire onAuthStateChanged with null and re-trigger anonymous sign-in.
  },
}))
