import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getOrCreateParticipantId } from '@/lib/participantId'

export interface ParticipantDoc {
  participantId: string
  name: string
  uid: string
  availability: string
  lastUpdated: { seconds: number; nanoseconds: number }
}

/**
 * Subscribe to live updates of all participants for an event.
 */
export function subscribeToParticipants(
  slug: string,
  cb: (participants: ParticipantDoc[]) => void,
): Unsubscribe {
  const ref = collection(db, 'events', slug, 'participants')
  return onSnapshot(ref, (snap) => {
    const list = snap.docs.map((d) => d.data() as ParticipantDoc)
    cb(list)
  })
}

/**
 * Resolve or create the local participant for this (event, name).
 *
 * If the participant doc already exists, only `name`, `uid`, and `lastUpdated` are
 * updated; `availability` is preserved. (Including `availability` in a `merge:true`
 * setDoc would still overwrite the existing field — `merge` only protects fields
 * absent from the write payload.)
 */
export async function getOrCreateParticipant(
  slug: string,
  name: string,
  uid: string,
): Promise<ParticipantDoc> {
  const participantId = getOrCreateParticipantId(slug, name)
  const ref = doc(db, 'events', slug, 'participants', participantId)
  const trimmedName = name.trim()

  const snap = await getDoc(ref)

  if (snap.exists()) {
    const existing = snap.data() as ParticipantDoc
    await setDoc(
      ref,
      { name: trimmedName, uid, lastUpdated: serverTimestamp() },
      { merge: true },
    )
    return {
      participantId,
      name: trimmedName,
      uid,
      availability: existing.availability ?? '',
      lastUpdated: existing.lastUpdated ?? { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    }
  }

  await setDoc(ref, {
    participantId,
    name: trimmedName,
    uid,
    availability: '',
    lastUpdated: serverTimestamp(),
  })
  return {
    participantId,
    name: trimmedName,
    uid,
    availability: '',
    lastUpdated: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
  }
}

/**
 * Update a participant's availability bitmap.
 */
export async function updateAvailability(
  slug: string,
  participantId: string,
  availability: string,
): Promise<void> {
  const ref = doc(db, 'events', slug, 'participants', participantId)
  await setDoc(ref, { availability, lastUpdated: serverTimestamp() }, { merge: true })
}
