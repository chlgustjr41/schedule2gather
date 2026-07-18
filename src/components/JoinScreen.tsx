import { useState } from 'react'
import { useEventStore } from '@/stores/eventStore'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import TextField from '@/components/ui/TextField'

interface JoinScreenProps {
  priorNames: string[]
  error: string | null
  onSubmit: (name: string) => void
}

/** Full-page invitee landing: event context + social proof + one name field. */
export default function JoinScreen({ priorNames, error, onSubmit }: JoinScreenProps) {
  const event = useEventStore((s) => s.event)
  const participants = useEventStore((s) => s.participants)
  const [name, setName] = useState('')

  if (!event) return null
  const painted = participants.filter((p) => p.availability !== '').length

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <div className="max-w-sm mx-auto mt-6">
      <p className="text-sm text-ink-muted">You&rsquo;re invited to</p>
      <h1 className="text-2xl font-extrabold break-words">{event.name}</h1>
      <p className="text-sm text-ink-muted mt-0.5">
        {event.dates.length} {event.mode === 'weekdays_recurring' ? 'weekdays' : 'dates'} · {event.slotMinutes} min slots
      </p>
      {participants.length > 0 && (
        <div className="flex items-center mt-3">
          {participants.slice(0, 5).map((p) => (
            <span key={p.participantId} className="-ml-1.5 first:ml-0">
              <Avatar name={p.name} size={26} />
            </span>
          ))}
          {participants.length > 5 && (
            <span className="text-xs text-ink-muted font-bold ml-2">+{participants.length - 5}</span>
          )}
        </div>
      )}
      {painted > 0 && (
        <p className="text-xs text-ink-muted mt-1">
          {painted} {painted === 1 ? 'person has' : 'people have'} painted their times
        </p>
      )}
      <Card className="mt-4">
        <form onSubmit={handle}>
          <TextField
            id="join-name"
            label="Join in"
            type="text"
            autoFocus
            required
            maxLength={79}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          {priorNames.length > 0 && (
            <p className="text-xs text-ink-muted mt-2">
              On this device:{' '}
              {priorNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setName(n)}
                  className="text-primary font-bold underline mr-1.5"
                >
                  {n}
                </button>
              ))}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <Button size="lg" type="submit" disabled={name.trim().length === 0} className="mt-4">
            Join &amp; paint my times
          </Button>
          <p className="text-xs text-ink-muted text-center mt-3">
            No account needed. Come back with the same name to edit.
          </p>
        </form>
      </Card>
    </div>
  )
}
