import { httpsCallable, getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { app, db } from '@/services/firebase'

let functionsInstance: Functions | null = null

function getFunctionsClient(): Functions {
  if (functionsInstance) return functionsInstance
  functionsInstance = getFunctions(app, 'us-central1')
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001)
  }
  return functionsInstance
}

export interface CreateEventInput {
  name: string
  mode: 'specific_dates' | 'weekdays_in_range' | 'weekdays_recurring'
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
}

export interface CreateEventResult {
  slug: string
}

/**
 * Calls the createEvent Cloud Function. Throws on validation errors or network failures.
 */
export async function createEvent(input: CreateEventInput): Promise<CreateEventResult> {
  const callable = httpsCallable<CreateEventInput, CreateEventResult>(getFunctionsClient(), 'createEvent')
  const result = await callable(input)
  return result.data
}

export interface EventDoc {
  name: string
  createdAt: { seconds: number; nanoseconds: number }
  expiresAt: { seconds: number; nanoseconds: number }
  ownerUid: string
  ownerEmail?: string
  mode: 'specific_dates' | 'weekdays_in_range' | 'weekdays_recurring'
  dates: string[]
  timeRange: { start: number; end: number }
  slotMinutes: 15 | 30 | 60
  timezone: string
  slotCount: number
}

/**
 * Subscribe to live updates of an event doc. Calls cb with the doc data, or null if not found.
 * Returns the unsubscribe function.
 */
export function subscribeToEvent(slug: string, cb: (event: EventDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'events', slug), (snap) => {
    cb(snap.exists() ? (snap.data() as EventDoc) : null)
  })
}

/**
 * Writes the ownerEmail field on the event document (merge: true, so all other fields are preserved).
 * Called when the host signs in with Google on their own event page.
 */
export async function setOwnerEmail(slug: string, email: string): Promise<void> {
  const ref = doc(db, 'events', slug)
  await setDoc(ref, { ownerEmail: email }, { merge: true })
}
