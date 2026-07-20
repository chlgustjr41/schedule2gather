/** Mirror of the client's nameNormalize: lowercase, trim, collapse whitespace. */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export type JoinDecision =
  | { kind: 'create' }
  | { kind: 'duplicate'; participantId: string }
  | { kind: 'claim-open' }
  | { kind: 'claim-protected' }
  | { kind: 'closed' }
  | { kind: 'missing' }

export function decideCreate(
  finalized: boolean,
  requestedName: string,
  existing: { participantId: string; name: string }[],
): JoinDecision {
  if (finalized) return { kind: 'closed' }
  const norm = normalizeName(requestedName)
  const dup = existing.find((p) => normalizeName(p.name) === norm)
  return dup ? { kind: 'duplicate', participantId: dup.participantId } : { kind: 'create' }
}

export function decideClaim(
  finalized: boolean,
  participantExists: boolean,
  hasSecret: boolean,
): JoinDecision {
  if (finalized) return { kind: 'closed' }
  if (!participantExists) return { kind: 'missing' }
  return hasSecret ? { kind: 'claim-protected' } : { kind: 'claim-open' }
}
