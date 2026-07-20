import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '@/components/AppHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import TextField from '@/components/ui/TextField'
import { normalizeCode } from '@/lib/joinCode'
import { getEvent } from '@/services/eventService'

const HOW_IT_WORKS = [
  {
    title: 'Create',
    body: 'Pick your dates — or just the days — and get a shareable link. No account required.',
  },
  {
    title: 'Share',
    body: 'Send the link. Everyone paints their availability on the grid — no sign-up needed.',
  },
  {
    title: 'See the best time',
    body: 'Watch the group heatmap fill in, then finalize the winning time and lock it in.',
  },
]

const FEATURES = [
  {
    emoji: '🔗',
    title: 'No sign-up to vote',
    body: 'Anyone with the link can join and mark their availability. Only the host needs an account.',
  },
  {
    emoji: '🎨',
    title: 'Paint your availability',
    body: 'Drag or tap across the grid to mark when you’re free — works with mouse, touch, or keyboard.',
  },
  {
    emoji: '👥',
    title: 'Group heatmap',
    body: 'See everyone’s overlap at a glance — the darker the cell, the more people are free.',
  },
  {
    emoji: '✨',
    title: 'Best times, ranked automatically',
    body: 'The app surfaces the top time windows for you — no manual comparing required.',
  },
  {
    emoji: '⤓',
    title: 'One-tap calendar export',
    body: 'Add the winning time to Google Calendar, download an .ics, or copy a shareable summary.',
  },
  {
    emoji: '📅',
    title: 'Dates-only mode',
    body: 'Skip the hourly grid entirely and just ask which days work — simpler polls, faster answers.',
  },
  {
    emoji: '🔒',
    title: 'Claim your name & protect it',
    body: 'Pick your name from the list next time instead of creating a duplicate — passcode optional.',
  },
  {
    emoji: '🌙',
    title: 'Mobile-first, dark mode',
    body: 'Pinch-to-zoom, swipeable week views, and a full dark theme, built in.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const slug = normalizeCode(code)
    if (!slug) return
    setChecking(true)
    setError(null)
    try {
      const event = await getEvent(slug)
      if (event) {
        navigate(`/e/${slug}`)
      } else {
        setError('No event found with that code — check for typos.')
      }
    } catch {
      setError("Couldn't check the code — are you online?")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader className="max-w-4xl" />
      <main className="max-w-4xl mx-auto px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center mt-12">Find a time to meet, fast.</h1>
          <p className="text-center text-ink-muted mt-3">
            Pick dates, share a link, see when everyone&rsquo;s free. No sign-ups needed to vote.
          </p>
          <div className="max-w-sm mx-auto mt-8">
            <Link to="/new">
              <Button size="lg">Create an event</Button>
            </Link>
          </div>
          <Card className="max-w-sm mx-auto mt-6">
            <form onSubmit={handleJoin}>
              <TextField
                id="join-code"
                label="Have an event code?"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 6w3wrh — or paste the link"
              />
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
              <Button
                variant="secondary"
                size="lg"
                type="submit"
                className="mt-3"
                disabled={checking || normalizeCode(code).length === 0}
              >
                {checking ? 'Checking…' : 'Join event'}
              </Button>
            </form>
          </Card>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-extrabold text-center">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            {HOW_IT_WORKS.map((step, i) => (
              <Card key={step.title}>
                <div className="w-9 h-9 rounded-full bg-primary text-on-primary font-extrabold flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="font-extrabold mt-3">{step.title}</h3>
                <p className="text-sm text-ink-muted mt-1">{step.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-extrabold text-center">Everything you need to plan together</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <p className="font-extrabold">
                  <span aria-hidden="true">{feature.emoji}</span> {feature.title}
                </p>
                <p className="text-sm text-ink-muted mt-1">{feature.body}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
