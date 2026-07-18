import { httpsCallable, getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
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

export interface FinalizedWindow {
  startSlot: number
  endSlot: number
  finalizedAt: { seconds: number; nanoseconds: number }
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
  finalized?: FinalizedWindow | null
  lastVisitedAt?: { seconds: number; nanoseconds: number } | null
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

/** Host-only (enforced by rules): lock the vote to a final window. */
export async function finalizeEvent(
  slug: string,
  window: { startSlot: number; endSlot: number },
): Promise<void> {
  const ref = doc(db, 'events', slug)
  await setDoc(ref, { finalized: { ...window, finalizedAt: serverTimestamp() } }, { merge: true })
}

/** Host-only (enforced by rules): reopen voting. */
export async function reopenEvent(slug: string): Promise<void> {
  const ref = doc(db, 'events', slug)
  await setDoc(ref, { finalized: null }, { merge: true })
}

const VISIT_THROTTLE_MS = 24 * 60 * 60 * 1000

/**
 * Best-effort visit tracking for garbage collection. Writes at most once per
 * 24h per event (client-side throttle) and swallows all failures.
 */
export async function touchLastVisited(
  slug: string,
  current: { seconds: number } | null,
): Promise<void> {
  if (current && Date.now() - current.seconds * 1000 < VISIT_THROTTLE_MS) return
  try {
    await setDoc(doc(db, 'events', slug), { lastVisitedAt: serverTimestamp() }, { merge: true })
  } catch {
    // best-effort — GC falls back to createdAt
  }
}
