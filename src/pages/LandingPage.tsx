import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '@/components/AppHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import TextField from '@/components/ui/TextField'
import { normalizeCode } from '@/lib/joinCode'
import { getEvent } from '@/services/eventService'

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
      <AppHeader className="max-w-2xl" />
      <main className="max-w-2xl mx-auto px-4 pb-16">
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
      </main>
    </div>
  )
}
