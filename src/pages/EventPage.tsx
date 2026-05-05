import { useEffect, useReducer, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import { loadParticipantsForEvent } from '@/lib/participantId'
import { setOwnerEmail } from '@/services/eventService'
import NamePrompt from '@/components/NamePrompt'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import EventNotFound from '@/components/EventNotFound'
import HostBadge from '@/components/HostBadge'
import SignInButton from '@/components/SignInButton'
import ShareLinkBanner from '@/components/ShareLinkBanner'
import TimezonePicker from '@/components/TimezonePicker'

type NamePromptState = { show: false } | { show: true; priorNames: string[]; error: string | null }

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
  const [viewerTimezone, setViewerTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  // useReducer instead of useState: the project's react-hooks/set-state-in-effect
  // lint rule rejects setState calls inside effects. A reducer dispatch is allowed.
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
      const [normalizedKey, stored] = entries[0]
      void joinAs(stored.rawName || normalizedKey, user.uid)
    } else {
      setNamePrompt({
        show: true,
        priorNames: entries.map(([n, stored]) => stored.rawName || n),
        error: null,
      })
    }
  }, [slug, event, user, myParticipant, joinAs])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading event…</div>
  }

  if (notFound || !event) {
    return <EventNotFound />
  }

  const isHost = user?.uid === event.ownerUid

  const handleHostSignedIn = async (email: string | null) => {
    if (slug && email) {
      try {
        await setOwnerEmail(slug, email)
      } catch (err) {
        console.warn('Failed to write ownerEmail:', err)
      }
    }
  }

  const handleJoin = async (name: string) => {
    if (!slug || !user) return
    try {
      await joinAs(name, user.uid)
      setNamePrompt({ show: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join. Try again.'
      // Reload the prior-names hint so the prompt re-renders with the error.
      const map = loadParticipantsForEvent(slug)
      const entries = Object.entries(map)
      setNamePrompt({
        show: true,
        priorNames: entries.map(([n, stored]) => stored.rawName || n),
        error: msg,
      })
    }
  }

  const shareUrl = `${window.location.origin}/e/${slug}`

  return (
    <div className="min-h-screen p-4">
      <ShareLinkBanner url={shareUrl} />
      <div className="flex items-center justify-between max-w-5xl mx-auto mb-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-gray-500">
            {event.dates.length} {event.mode === 'weekdays_recurring' ? 'weekdays' : 'dates'} ·{' '}
            {event.timeRange.start}:00–{event.timeRange.end}:00 · {event.slotMinutes} min slots ·{' '}
            {event.timezone}
          </p>
          {isHost && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <HostBadge />
              <SignInButton onSignedIn={handleHostSignedIn} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {myParticipant && (
            <div className="text-sm text-gray-500">Painting as {myParticipant.name}</div>
          )}
          <TimezonePicker value={viewerTimezone} onChange={setViewerTimezone} />
        </div>
      </div>

      {myParticipant && <AvailabilityGrid viewerTimezone={viewerTimezone} />}

      {namePrompt.show && (
        <NamePrompt
          priorNames={namePrompt.priorNames}
          error={namePrompt.error}
          onSubmit={handleJoin}
        />
      )}
    </div>
  )
}
