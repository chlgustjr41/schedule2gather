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
  isGoogleUser: boolean
  init: () => () => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((setState) => ({
  user: null,
  loading: true,
  isGoogleUser: false,

  init: () => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setState({ user, loading: false, isGoogleUser: !user.isAnonymous })
      } else {
        try {
          await signInAnonymously(auth)
          // onAuthStateChanged will fire again with the new user
        } catch (err) {
          console.error('Anonymous sign-in failed:', err)
          setState({ user: null, loading: false, isGoogleUser: false })
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
        const linkedUser = auth.currentUser
        setState({ user: linkedUser, isGoogleUser: linkedUser !== null && !linkedUser.isAnonymous })
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
    const signedInUser = auth.currentUser
    setState({ user: signedInUser, isGoogleUser: signedInUser !== null && !signedInUser.isAnonymous })
  },

  signOut: async () => {
    setState({ isGoogleUser: false })
    await fbSignOut(auth)
    // The auth listener will fire onAuthStateChanged with null and re-trigger anonymous sign-in.
  },
}))
