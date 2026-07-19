import { httpsCallable, getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  getCountFromServer,
  type Unsubscribe,
} from 'firebase/firestore'
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

/** One-shot fetch (join-by-code validation). Null when the event doesn't exist. */
export async function getEvent(slug: string): Promise<EventDoc | null> {
  const snap = await getDoc(doc(db, 'events', slug))
  return snap.exists() ? (snap.data() as EventDoc) : null
}

export interface MyEvent extends EventDoc {
  slug: string
}

/** Events created by this uid, newest first. Single-field where — no composite index. */
export async function listMyEvents(uid: string): Promise<MyEvent[]> {
  const snap = await getDocs(query(collection(db, 'events'), where('ownerUid', '==', uid)))
  return snap.docs
    .map((d) => ({ slug: d.id, ...(d.data() as EventDoc) }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

/** Server-side aggregate counts — no participant documents are downloaded. */
export async function countParticipants(
  slug: string,
): Promise<{ joined: number; painted: number | null }> {
  const col = collection(db, 'events', slug, 'participants')
  const joinedSnap = await getCountFromServer(col)
  let painted: number | null = null
  try {
    const paintedSnap = await getCountFromServer(query(col, where('availability', '!=', '')))
    painted = paintedSnap.data().count
  } catch {
    painted = null // != aggregate can fail without an index — hide the figure instead
  }
  return { joined: joinedSnap.data().count, painted }
}

/** Owner-only, enforced server-side by the deleteEvent callable. */
export async function deleteEventRemote(slug: string): Promise<void> {
  const callable = httpsCallable<{ slug: string }, { ok: boolean }>(
    getFunctionsClient(),
    'deleteEvent',
  )
  await callable({ slug })
}
