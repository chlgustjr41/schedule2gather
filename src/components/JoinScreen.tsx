import { useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import TextField from '@/components/ui/TextField'

/** Claim an existing name (passcode-verified server-side when protected) or create a new one. */
export default function JoinScreen() {
  const event = useEventStore((s) => s.event)
  const participants = useEventStore((s) => s.participants)
  const join = useEventStore((s) => s.join)

  const [claimTarget, setClaimTarget] = useState<string | null>(null)
  const [claimPasscode, setClaimPasscode] = useState('')
  const [newName, setNewName] = useState('')
  const [newPasscode, setNewPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!event) return null

  const friendly = (err: unknown): string => {
    const code = (err as { code?: string })?.code ?? ''
    if (code.includes('already-exists')) return 'That name is taken — tap it above to claim it.'
    if (code.includes('permission-denied')) return 'Wrong passcode — try again.'
    if (code.includes('failed-precondition')) return 'Voting is closed for this event.'
    if (code.includes('not-found')) return 'That name no longer exists — refresh and try again.'
    if (code.includes('invalid-argument')) return 'Passcode must be 4–12 letters or numbers.'
    return 'Couldn’t join — check your connection and try again.'
  }

  const doJoin = async (input: { name?: string; passcode?: string; claimParticipantId?: string }) => {
    setBusy(true)
    setError(null)
    try {
      await join(input)
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  const handleClaim = (p: { participantId: string; protected?: boolean }) => {
    if (p.protected) {
      setClaimTarget((cur) => (cur === p.participantId ? null : p.participantId))
      setClaimPasscode('')
      setError(null)
    } else {
      void doJoin({ claimParticipantId: p.participantId })
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6">
      <p className="text-sm text-ink-muted">You&rsquo;re invited to</p>
      <h1 className="text-2xl font-extrabold break-words">{event.name}</h1>
      <p className="text-sm text-ink-muted mt-0.5">
        {event.dates.length} {event.mode === 'weekdays_recurring' ? 'weekdays' : 'dates'} ·{' '}
        {event.slotMinutes} min slots
      </p>

      {participants.length > 0 && (
        <Card className="mt-4">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-2">
            Continue as
          </div>
          <ul className="divide-y divide-line">
            {participants.map((p) => (
              <li key={p.participantId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleClaim(p)}
                  className="w-full flex items-center gap-2 py-2 text-left hover:bg-raised rounded-[8px] px-1 disabled:opacity-50"
                >
                  <Avatar name={p.name} size={26} />
                  <span className="font-bold text-sm flex-1">{p.name}</span>
                  {p.protected && <span aria-label="Passcode protected">🔒</span>}
                </button>
                {claimTarget === p.participantId && (
                  <form
                    className="flex gap-2 pb-2 px-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void doJoin({ claimParticipantId: p.participantId, passcode: claimPasscode })
                    }}
                  >
                    <TextField
                      id={`claim-passcode-${p.participantId}`}
                      value={claimPasscode}
                      onChange={(e) => setClaimPasscode(e.target.value)}
                      placeholder="Passcode"
                      autoFocus
                    />
                    <Button size="sm" type="submit" disabled={busy || claimPasscode.length < 4}>
                      Unlock
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = newName.trim()
            if (trimmed) {
              void doJoin({ name: trimmed, passcode: newPasscode.length > 0 ? newPasscode : undefined })
            }
          }}
        >
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-2">
            {participants.length > 0 ? 'Or join as a new name' : 'Join in'}
          </div>
          <TextField
            id="join-name"
            type="text"
            required
            maxLength={79}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Your name"
          />
          <div className="mt-2">
            <TextField
              id="join-passcode"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              placeholder="Optional passcode (4–12 letters/numbers)"
            />
            <p className="text-xs text-ink-muted mt-1">
              A passcode lets you reclaim this name from another device — and stops others from
              taking it.
            </p>
          </div>
          <Button size="lg" type="submit" disabled={busy || newName.trim().length === 0} className="mt-4">
            {busy ? 'Joining…' : 'Join & paint my times'}
          </Button>
        </form>
      </Card>

      {error && <p className="mt-3 text-sm text-danger text-center">{error}</p>}
      <p className="text-xs text-ink-muted text-center mt-3">No account needed.</p>
    </div>
  )
}
