import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  type Database,
} from 'firebase/database'
import { app } from '@/services/firebase'

// Presence is best-effort: if RTDB is not provisioned/configured, every function
// here becomes a no-op and the UI simply shows no presence dots.
let db: Database | null | undefined

function getRtdb(): Database | null {
  if (db !== undefined) return db
  try {
    db = getDatabase(app)
  } catch {
    db = null
  }
  return db
}

/**
 * Mark this participant present on the event page. Server removes the node on
 * disconnect (tab close, phone lock). Returns a cleanup function for unmount.
 */
export function registerPresence(slug: string, participantId: string, name: string): () => void {
  const rtdb = getRtdb()
  if (!rtdb) return () => {}
  const nodeRef = ref(rtdb, `presence/${slug}/${participantId}`)
  void set(nodeRef, { name, lastSeen: serverTimestamp() }).catch(() => {})
  void onDisconnect(nodeRef).remove().catch(() => {})
  return () => {
    void remove(nodeRef).catch(() => {})
  }
}

/**
 * Subscribe to the set of present participantIds. Never calls cb synchronously.
 * Returns an unsubscribe function.
 */
export function subscribeToPresence(slug: string, cb: (presentIds: Set<string>) => void): () => void {
  const rtdb = getRtdb()
  if (!rtdb) return () => {}
  const eventRef = ref(rtdb, `presence/${slug}`)
  return onValue(
    eventRef,
    (snap) => {
      const val = (snap.val() ?? {}) as Record<string, unknown>
      cb(new Set(Object.keys(val)))
    },
    () => cb(new Set()),
  )
}
