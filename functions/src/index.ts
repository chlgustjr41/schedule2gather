import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { mintSlug } from './lib/slug'
import { validateCreateEventInput, ValidationError, computeSlotCount } from './lib/validate'

initializeApp()

const SLUG_RETRY_LIMIT = 5
const EXPIRY_DAYS = 90

export const createEvent = onCall(
  { region: 'us-central1' },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'must be authenticated')
    }

    const input: unknown = req.data
    try {
      validateCreateEventInput(input)
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new HttpsError('invalid-argument', err.message)
      }
      throw err
    }
    // After validateCreateEventInput, `input` is narrowed to CreateEventInput.

    const slotCount = computeSlotCount(input)

    const db = getFirestore()

    let slug: string | null = null
    for (let attempt = 0; attempt < SLUG_RETRY_LIMIT; attempt++) {
      const candidate = mintSlug()
      const snap = await db.collection('events').doc(candidate).get()
      if (!snap.exists) {
        slug = candidate
        break
      }
    }

    if (!slug) {
      throw new HttpsError('internal', 'failed to mint unique slug after retries')
    }

    const now = Timestamp.now()
    const expiresAt = Timestamp.fromMillis(now.toMillis() + EXPIRY_DAYS * 86_400_000)

    await db.collection('events').doc(slug).set({
      name: input.name.trim(),
      createdAt: now,
      expiresAt,
      ownerUid: req.auth.uid,
      mode: input.mode,
      dates: input.dates,
      timeRange: input.timeRange,
      slotMinutes: input.slotMinutes,
      timezone: input.timezone,
      slotCount,
    })

    return { slug }
  },
)

export { cleanupExpiredEvents } from './cleanupExpiredEvents'
