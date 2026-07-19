import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'
import { assertDeletable } from './lib/deleteGuard'

/** Owner-only recursive delete of an event and all its participant/comment data. */
export const deleteEvent = onCall({ region: 'us-central1' }, async (req) => {
  const slug: unknown = req.data?.slug
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,40}$/.test(slug)) {
    throw new HttpsError('invalid-argument', 'Invalid event code')
  }

  const db = getFirestore()
  const ref = db.doc(`events/${slug}`)
  const snap = await ref.get()
  const verdict = assertDeletable(
    snap.exists ? (snap.data() as { ownerUid?: string }) : undefined,
    req.auth?.uid,
  )
  if (verdict === 'unauthenticated') throw new HttpsError('unauthenticated', 'Sign in required')
  if (verdict === 'not-found') throw new HttpsError('not-found', 'Event not found')
  if (verdict === 'permission-denied') {
    throw new HttpsError('permission-denied', 'Only the host can delete this event')
  }

  await db.recursiveDelete(ref)

  try {
    await getDatabase().ref(`presence/${slug}`).remove()
  } catch {
    // RTDB may be unprovisioned — presence cleanup is best-effort.
  }

  return { ok: true }
})
