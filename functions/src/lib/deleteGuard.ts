export type DeleteVerdict = 'ok' | 'unauthenticated' | 'not-found' | 'permission-denied'

/** Pure ownership check for deleteEvent — kept separate for unit testing. */
export function assertDeletable(
  data: { ownerUid?: string } | undefined,
  uid: string | undefined,
): DeleteVerdict {
  if (!uid) return 'unauthenticated'
  if (!data) return 'not-found'
  if (data.ownerUid !== uid) return 'permission-denied'
  return 'ok'
}
