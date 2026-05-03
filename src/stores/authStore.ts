import { create } from 'zustand'
import {
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/services/firebase'

interface AuthState {
  user: User | null
  loading: boolean
  init: () => () => void
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
}))
