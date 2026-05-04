import { useEffect, useReducer } from 'react'
import { useParams } from 'react-router-dom'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import { loadParticipantsForEvent, countNamesForEvent } from '@/lib/participantId'
import NamePrompt from '@/components/NamePrompt'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import EventNotFound from '@/components/EventNotFound'
import HostBadge from '@/components/HostBadge'

type NamePromptState = { show: false } | { show: true; priorNames: string[] }

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)
  const event = useEventStore((s) => s.event)
  const myParticipant = useEventStore((s) => s.myParticipant)
  const loading = useEventStore((s) => s.loading)
  const notFound = useEventStore((s) => s.notFound)
  const loadEvent = useEventStore((s) => s.loadEvent)
  const joinAs = useEventStore((s) => s.joinAs)
  const reset = useEventStore((s) => s.reset)
  const [namePrompt, setNamePrompt] = useReducer(
    (_: NamePromptState, next: NamePromptState) => next,
    { show: false }
  )

  useEffect(() => {
    if (!slug) return
    loadEvent(slug)
    return () => reset()
  }, [slug, loadEvent, reset])

  useEffect(() => {
    if (!slug || !event || !user || myParticipant) return
    const map = loadParticipantsForEvent(slug)
    const entries = Object.entries(map)
    if (entries.length === 1) {
      const [normalizedName] = entries[0]
      void joinAs(normalizedName, user.uid)
    } else {
      setNamePrompt({ show: true, priorNames: entries.map(([n]) => n) })
    }
  }, [slug, event, user, myParticipant, joinAs])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading event…</div>
  }

  if (notFound || !event) {
    return <EventNotFound />
  }

  const isHost = user?.uid === event.ownerUid

  const handleJoin = async (name: string) => {
    if (!slug || !user) return
    await joinAs(name, user.uid)
    setNamePrompt({ show: false })
    countNamesForEvent(slug)
  }

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-gray-500">
            {event.dates.length} {event.mode === 'weekdays_recurring' ? 'weekdays' : 'dates'} ·{' '}
            {event.timeRange.start}:00–{event.timeRange.end}:00 · {event.slotMinutes} min slots ·{' '}
            {event.timezone}
          </p>
          {isHost && <div className="mt-2"><HostBadge /></div>}
        </div>
        <div className="text-sm text-gray-500">
          {myParticipant ? `Painting as ${myParticipant.name}` : ''}
        </div>
      </div>

      {myParticipant && <AvailabilityGrid />}

      {namePrompt.show && <NamePrompt priorNames={namePrompt.priorNames} onSubmit={handleJoin} />}
    </div>
  )
}
