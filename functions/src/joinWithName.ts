import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { decideClaim, decideCreate } from './lib/joinLogic'
import { hashPasscode, verifyPasscode, type PasscodeRecord } from './lib/passcodeHash'

/**
 * Server-authoritative join: create a new named participant (optionally
 * passcode-protected) or claim an existing one. Passcode hashes live in the
 * client-inaccessible `secrets` subcollection.
 */
export const joinWithName = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required')

  const { slug, name, passcode, claimParticipantId } = (req.data ?? {}) as Record<string, unknown>
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,40}$/.test(slug)) {
    throw new HttpsError('invalid-argument', 'Invalid event code')
  }
  const creating = typeof name === 'string'
  const claiming = typeof claimParticipantId === 'string'
  if (creating === claiming) {
    throw new HttpsError('invalid-argument', 'Provide exactly one of name or claimParticipantId')
  }
  if (passcode !== undefined && (typeof passcode !== 'string' || !/^[a-zA-Z0-9]{4,12}$/.test(passcode))) {
    throw new HttpsError('invalid-argument', 'Passcode must be 4–12 letters/numbers')
  }

  const db = getFirestore()
  const eventRef = db.doc(`events/${slug}`)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found')
  const finalized = (eventSnap.data()?.finalized ?? null) !== null

  if (creating) {
    const trimmed = (name as string).trim()
    if (trimmed.length === 0 || trimmed.length >= 80) {
      throw new HttpsError('invalid-argument', 'Name must be 1–79 characters')
    }
    const partsSnap = await eventRef.collection('participants').get()
    const existing = partsSnap.docs.map((d) => ({
      participantId: d.id,
      name: (d.data().name as string) ?? '',
    }))
    const decision = decideCreate(finalized, trimmed, existing)
    if (decision.kind === 'closed') throw new HttpsError('failed-precondition', 'Voting is closed')
    if (decision.kind === 'duplicate') {
      // Message carries the participantId so the client can offer claiming it.
      throw new HttpsError('already-exists', decision.participantId)
    }
    const pRef = eventRef.collection('participants').doc()
    await pRef.set({
      participantId: pRef.id,
      name: trimmed,
      uid,
      availability: '',
      protected: passcode !== undefined,
      lastUpdated: Timestamp.now(),
    })
    if (passcode !== undefined) {
      await eventRef.collection('secrets').doc(pRef.id).set(hashPasscode(passcode as string))
    }
    return { participantId: pRef.id, name: trimmed }
  }

  const pid = claimParticipantId as string
  const pRef = eventRef.collection('participants').doc(pid)
  const [pSnap, sSnap] = await Promise.all([
    pRef.get(),
    eventRef.collection('secrets').doc(pid).get(),
  ])
  const decision = decideClaim(finalized, pSnap.exists, sSnap.exists)
  if (decision.kind === 'closed') throw new HttpsError('failed-precondition', 'Voting is closed')
  if (decision.kind === 'missing') throw new HttpsError('not-found', 'That name no longer exists')
  if (decision.kind === 'claim-protected') {
    if (typeof passcode !== 'string' || !verifyPasscode(passcode, sSnap.data() as PasscodeRecord)) {
      throw new HttpsError('permission-denied', 'Wrong passcode')
    }
  }
  await pRef.set({ uid, lastUpdated: Timestamp.now() }, { merge: true })
  return { participantId: pid, name: (pSnap.data()?.name as string) ?? '' }
})
