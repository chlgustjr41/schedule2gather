import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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
    const now = Timestamp.now()
    const expiredSnap = await db.collection('events').where('expiresAt', '<', now).get()

    logger.info(`cleanupExpiredEvents: found ${expiredSnap.size} expired events`)

    let deleted = 0
    let failed = 0
    for (const eventDoc of expiredSnap.docs) {
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
