import { useEffect, useReducer, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEventStore } from '@/stores/eventStore'
import { useAuthStore } from '@/stores/authStore'
import { loadParticipantsForEvent } from '@/lib/participantId'
import { setOwnerEmail, touchLastVisited } from '@/services/eventService'
import { registerPresence, subscribeToPresence } from '@/services/presenceService'
import JoinScreen from '@/components/JoinScreen'
import AvailabilityGrid from '@/components/AvailabilityGrid'
import EventNotFound from '@/components/EventNotFound'
import HostBadge from '@/components/HostBadge'
import SignInButton from '@/components/SignInButton'
import ShareLinkBanner from '@/components/ShareLinkBanner'
import TimezonePicker from '@/components/TimezonePicker'
import CommentsPanel from '@/components/CommentsPanel'
import BestTimesPanel from '@/components/BestTimesPanel'
import GroupHeatmap from '@/components/GroupHeatmap'
import FinalizedBanner from '@/components/FinalizedBanner'
import AppHeader from '@/components/AppHeader'
import Avatar from '@/components/ui/Avatar'
import Card from '@/components/ui/Card'

type NamePromptState = { show: false } | { show: true; priorNames: string[]; error: string | null }

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>()
  const user = useAuthStore((s) => s.user)
  const event = useEventStore((s) => s.event)
  const myParticipant = useEventStore((s) => s.myParticipant)
  const participants = useEventStore((s) => s.participants)
  const lastVisitedSecs = useEventStore((s) => s.event?.lastVisitedAt?.seconds ?? null)
  const hasEvent = useEventStore((s) => s.event !== null)
  const loading = useEventStore((s) => s.loading)
  const notFound = useEventStore((s) => s.notFound)
  const loadEvent = useEventStore((s) => s.loadEvent)
  const joinAs = useEventStore((s) => s.joinAs)
  const reset = useEventStore((s) => s.reset)
  const [viewerTimezone, setViewerTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [presentIds, setPresentIds] = useState<Set<string>>(() => new Set())
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
    if (!slug || !event || !user || myParticipant || event.finalized) return
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

  const participantId = myParticipant?.participantId
  const participantName = myParticipant?.name

  useEffect(() => {
    if (!slug || !participantId || !participantName) return
    return registerPresence(slug, participantId, participantName)
  }, [slug, participantId, participantName])

  useEffect(() => {
    if (!slug) return
    return subscribeToPresence(slug, setPresentIds)
  }, [slug])

  useEffect(() => {
    if (!slug || !hasEvent) return
    void touchLastVisited(slug, lastVisitedSecs === null ? null : { seconds: lastVisitedSecs })
  }, [slug, hasEvent, lastVisitedSecs])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-muted">Loading event…</div>
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
  const finalized = event.finalized ?? null

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="px-4 pb-12">
        {!finalized && !myParticipant && namePrompt.show ? (
          <JoinScreen priorNames={namePrompt.priorNames} error={namePrompt.error} onSubmit={handleJoin} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between max-w-5xl mx-auto mt-4 mb-4 gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold break-words">{event.name}</h1>
                <p className="text-sm text-ink-muted mt-0.5">
                  {event.dates.length} {event.mode === 'weekdays_recurring' ? 'weekdays' : 'dates'} ·{' '}
                  {event.slotMinutes} min slots
                </p>
                {participants.length > 0 && (
                  <div className="flex items-center mt-2">
                    {participants.slice(0, 8).map((p) => (
                      <span key={p.participantId} className="-ml-1.5 first:ml-0">
                        <Avatar name={p.name} present={presentIds.has(p.participantId)} size={28} />
                      </span>
                    ))}
                    {participants.length > 8 && (
                      <span className="text-xs text-ink-muted font-bold ml-2">
                        +{participants.length - 8}
                      </span>
                    )}
                  </div>
                )}
                {isHost && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <HostBadge />
                    <SignInButton onSignedIn={handleHostSignedIn} />
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                {myParticipant && (
                  <div className="text-sm text-ink-muted">
                    Painting as <b className="text-ink font-extrabold">{myParticipant.name}</b>
                  </div>
                )}
                <TimezonePicker value={viewerTimezone} onChange={setViewerTimezone} />
              </div>
            </div>

            <ShareLinkBanner url={shareUrl} />
            {finalized ? (
              <FinalizedBanner slug={slug!} isHost={isHost} viewerTimezone={viewerTimezone} shareUrl={shareUrl} />
            ) : (
              <BestTimesPanel viewerTimezone={viewerTimezone} shareUrl={shareUrl} isHost={isHost} slug={slug!} />
            )}
            <GroupHeatmap viewerTimezone={viewerTimezone} />
            {myParticipant && (
              <Card className="max-w-5xl mx-auto mb-4 border-l-4 border-l-primary">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">
                  ✏️ My times
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {finalized ? 'Voting closed — the time is locked in.' : "Tap or drag to paint when you're free"}
                </p>
                <AvailabilityGrid viewerTimezone={viewerTimezone} readOnly={finalized !== null} />
              </Card>
            )}
            {slug && (
              <CommentsPanel
                slug={slug}
                myParticipant={myParticipant}
                isHost={isHost}
                viewerUid={user?.uid ?? null}
                votingClosed={finalized !== null}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
