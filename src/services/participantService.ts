import {
  collection,
  doc,
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
 * Creates the Firestore doc if absent.
 */
export async function getOrCreateParticipant(
  slug: string,
  name: string,
  uid: string,
): Promise<ParticipantDoc> {
  const participantId = getOrCreateParticipantId(slug, name)
  const ref = doc(db, 'events', slug, 'participants', participantId)
  const initial: Omit<ParticipantDoc, 'lastUpdated'> = {
    participantId,
    name: name.trim(),
    uid,
    availability: '',
  }
  // Use merge:true so re-creating a participant by the same name doesn't blow away an existing bitmap.
  await setDoc(
    ref,
    { ...initial, lastUpdated: serverTimestamp() },
    { merge: true },
  )
  // Round-trip: build optimistic doc to return immediately. The real one arrives via subscribeToParticipants.
  return {
    ...initial,
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
