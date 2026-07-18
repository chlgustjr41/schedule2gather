import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { shouldDeleteEvent, type GcEvent } from './lib/gc'

/**
 * Scheduled function that runs daily at 03:00 UTC.
 * Deletes events whose expiresAt has passed (createdAt + 90 days), along
 * with their participants and comments subcollections via recursiveDelete.
 *
 * For solo-launch traffic this deletes a few dozen events per day at most;
 * sequential per-event recursiveDelete is fine. If event volume grows past
 * ~1k expirations per day, batch with Promise.all chunks of 10.
 */
export const cleanupExpiredEvents = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'UTC',
    region: 'us-central1',
    timeoutSeconds: 540,
    retryCount: 1,
  },
  async () => {
    const db = getFirestore()
    // Full scan instead of the old expiresAt-only query: the idle rule needs
    // per-document evaluation. Fine at this scale (see note above).
    const nowMs = Timestamp.now().toMillis()
    const allSnap = await db.collection('events').get()
    const expired = allSnap.docs.filter((d) => shouldDeleteEvent(d.data() as GcEvent, nowMs))

    logger.info(`cleanupExpiredEvents: ${expired.length} of ${allSnap.size} events due for deletion`)

    let deleted = 0
    let failed = 0
    for (const eventDoc of expired) {
      try {
        // recursiveDelete handles the doc + all subcollections (participants, comments).
        await db.recursiveDelete(eventDoc.ref)
        deleted++
      } catch (err) {
        failed++
        logger.error(`cleanupExpiredEvents: failed to delete event ${eventDoc.id}`, err)
      }
    }

    logger.info(`cleanupExpiredEvents: deleted ${deleted}, failed ${failed}`)
  },
)
