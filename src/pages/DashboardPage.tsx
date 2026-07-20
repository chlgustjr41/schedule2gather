import { useEffect, useReducer, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuthStore } from '@/stores/authStore'
import {
  countParticipants,
  deleteEventRemote,
  listMyEvents,
  reopenEvent,
  type MyEvent,
} from '@/services/eventService'
import AppHeader from '@/components/AppHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

type Counts = Record<string, { joined: number; painted: number | null }>
type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; events: MyEvent[] }

// Action-typed updates apply against the LATEST state, so overlapping actions
// (e.g. a reopen racing a delete) can never clobber each other's rows.
type LoadAction =
  | { type: 'loading' }
  | { type: 'error' }
  | { type: 'ready'; events: MyEvent[] }
  | { type: 'remove'; slug: string }
  | { type: 'removeMany'; slugs: string[] }
  | { type: 'reopen'; slug: string }

function reduceLoad(state: LoadState, action: LoadAction): LoadState {
  switch (action.type) {
    case 'loading':
      return { phase: 'loading' }
    case 'error':
      return { phase: 'error' }
    case 'ready':
      return { phase: 'ready', events: action.events }
    case 'remove':
      return state.phase === 'ready'
        ? { phase: 'ready', events: state.events.filter((ev) => ev.slug !== action.slug) }
        : state
    case 'removeMany': {
      const set = new Set(action.slugs)
      return state.phase === 'ready'
        ? { phase: 'ready', events: state.events.filter((ev) => !set.has(ev.slug)) }
        : state
    }
    case 'reopen':
      return state.phase === 'ready'
        ? {
            phase: 'ready',
            events: state.events.map((ev) =>
              ev.slug === action.slug ? { ...ev, finalized: null } : ev,
            ),
          }
        : state
  }
}

function dateRangeLabel(ev: MyEvent): string {
  if (ev.mode === 'weekdays_recurring') return 'Weekly'
  const first = ev.dates[0]
  const last = ev.dates[ev.dates.length - 1]
  if (!first) return ''
  const f = new Date(first + 'T00:00:00')
  const l = new Date((last ?? first) + 'T00:00:00')
  return first === last ? format(f, 'MMM d') : `${format(f, 'MMM d')} – ${format(l, 'MMM d')}`
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const navigate = useNavigate()
  const googleUser = useAuthStore((s) => s.isGoogleUser)
  const uid = googleUser && user ? user.uid : null

  // useReducer keeps the repo's strict set-state-in-effect lint rule happy.
  const [state, dispatch] = useReducer(reduceLoad, { phase: 'idle' })
  const [counts, setCounts] = useState<Counts>({})
  const [confirmDelete, setConfirmDelete] = useState<MyEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const toggleSelect = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    setBulkError(null)
    const slugs = [...selected]
    const results = await Promise.allSettled(slugs.map((s) => deleteEventRemote(s)))
    const succeeded = slugs.filter((_, i) => results[i].status === 'fulfilled')
    const failedCount = slugs.length - succeeded.length
    dispatch({ type: 'removeMany', slugs: succeeded })
    setCounts((prev) => {
      const next = { ...prev }
      for (const s of succeeded) delete next[s]
      return next
    })
    setSelected(new Set())
    setBulkConfirm(false)
    setBulkDeleting(false)
    if (failedCount > 0) {
      setBulkError(`Couldn't delete ${failedCount} event${failedCount === 1 ? '' : 's'} — try again.`)
    }
  }

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    dispatch({ type: 'loading' })
    listMyEvents(uid)
      .then((events) => {
        if (cancelled) return
        dispatch({ type: 'ready', events })
        for (const ev of events) {
          void countParticipants(ev.slug)
            .then((c) => {
              if (!cancelled) setCounts((prev) => ({ ...prev, [ev.slug]: c }))
            })
            .catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [uid, reloadKey])

  const handleCopy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`)
      setCopiedSlug(slug)
      window.setTimeout(() => setCopiedSlug(null), 2000)
    } catch {
      setActionError('Couldn’t copy — copy the link from the event page instead.')
    }
  }

  const handleReopen = async (slug: string) => {
    setActionError(null)
    try {
      await reopenEvent(slug)
      dispatch({ type: 'reopen', slug })
    } catch {
      setActionError('Couldn’t reopen — try again.')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteEventRemote(confirmDelete.slug)
      dispatch({ type: 'remove', slug: confirmDelete.slug })
      setCounts((prev) => {
        const next = { ...prev }
        delete next[confirmDelete.slug]
        return next
      })
      setConfirmDelete(null)
    } catch {
      setActionError('Couldn’t delete — try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 pb-16">
        <h1 className="text-2xl font-extrabold mt-6 mb-4">Your events</h1>

        {!googleUser ? (
          <Card className="max-w-sm mx-auto mt-8 text-center">
            <p className="text-sm text-ink-muted">
              See and manage every event you&rsquo;ve created — sign in and they follow you across
              devices.
            </p>
            <Button size="lg" className="mt-4" onClick={() => void signInWithGoogle().catch(() => {})}>
              Sign in with Google
            </Button>
          </Card>
        ) : state.phase === 'loading' || state.phase === 'idle' ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="h-20 animate-pulse bg-raised" />
            ))}
          </div>
        ) : state.phase === 'error' ? (
          <Card className="text-center">
            <p className="text-sm text-danger">Couldn&rsquo;t load your events.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </Card>
        ) : state.events.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-ink-muted">Nothing yet — create your first event.</p>
            <Link to="/new" className="inline-block mt-3">
              <Button size="sm">Create an event</Button>
            </Link>
          </Card>
        ) : (
          <>
            {actionError && <p className="text-sm text-danger mb-2">{actionError}</p>}
            {selected.size > 0 && (
              <div className="flex items-center justify-between gap-2 mb-3 bg-raised border border-line rounded-[12px] px-4 py-2">
                <span className="text-sm font-bold">{selected.size} selected</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} title="Clear selection">
                    Clear
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setBulkConfirm(true)}
                    title="Delete all selected events"
                  >
                    Delete selected
                  </Button>
                </div>
              </div>
            )}
            <ul className="space-y-3">
              {state.events.map((ev) => {
                const c = counts[ev.slug]
                return (
                  <li key={ev.slug}>
                    <Card
                      className="cursor-pointer hover:bg-raised transition"
                      onClick={() => navigate(`/e/${ev.slug}`)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(ev.slug)}
                          onChange={() => toggleSelect(ev.slug)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${ev.name} for bulk actions`}
                          title="Select for bulk actions"
                          className="mt-1 mr-1 w-4 h-4 accent-[var(--s2g-primary)] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-extrabold break-words">
                            {ev.name}{' '}
                            {ev.finalized && (
                              <span className="text-success text-xs font-extrabold">✅ Finalized</span>
                            )}
                          </div>
                          <div className="text-xs text-ink-muted mt-0.5">
                            {dateRangeLabel(ev)} · {ev.slotMinutes} min slots
                            {c && (
                              <>
                                {' '}· {c.joined} joined
                                {c.painted !== null && <> · {c.painted} voted</>}
                              </>
                            )}
                            {ev.createdAt && (
                              <> · created {format(new Date(ev.createdAt.seconds * 1000), 'MMM d')}</>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-2 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            title="Copy the invite link"
                            onClick={() => void handleCopy(ev.slug)}
                          >
                            {copiedSlug === ev.slug ? 'Copied ✓' : 'Copy link'}
                          </Button>
                          {ev.finalized ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              title="Reopen voting for this event"
                              onClick={() => void handleReopen(ev.slug)}
                            >
                              Reopen
                            </Button>
                          ) : (
                            <Link to={`/e/${ev.slug}`}>
                              <Button variant="ghost" size="sm" title="Pick a final time for this event">
                                Finalize…
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger"
                            title="Delete this event"
                            onClick={() => setConfirmDelete(ev)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {confirmDelete && (
          <BottomSheet title={`Delete “${confirmDelete.name}”?`} onClose={() => setConfirmDelete(null)}>
            <p className="text-sm text-ink-muted">
              All votes and comments are removed permanently. This can&rsquo;t be undone.
            </p>
            {actionError && <p className="text-sm text-danger mt-2">{actionError}</p>}
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Keep it
              </Button>
              <Button variant="danger" size="md" className="flex-1" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? 'Deleting…' : 'Delete event'}
              </Button>
            </div>
          </BottomSheet>
        )}

        {bulkConfirm && (
          <BottomSheet
            title={`Delete ${selected.size} event${selected.size === 1 ? '' : 's'}?`}
            onClose={() => setBulkConfirm(false)}
          >
            <p className="text-sm text-ink-muted">
              All votes and comments for these events are removed permanently. This can&rsquo;t be undone.
            </p>
            {bulkError && <p className="text-sm text-danger mt-2">{bulkError}</p>}
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setBulkConfirm(false)}>
                Keep them
              </Button>
              <Button
                variant="danger"
                size="md"
                className="flex-1"
                disabled={bulkDeleting}
                onClick={() => void handleBulkDelete()}
              >
                {bulkDeleting ? 'Deleting…' : 'Delete events'}
              </Button>
            </div>
          </BottomSheet>
        )}
      </main>
    </div>
  )
}
