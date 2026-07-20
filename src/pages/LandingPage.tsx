import CreateEventForm from '@/components/CreateEventForm'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Wordmark from '@/components/ui/Wordmark'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="max-w-2xl mx-auto px-4 pt-4 flex items-center justify-between">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="max-w-2xl mx-auto px-4 pb-16">
        <h1 className="text-3xl font-extrabold text-center mt-8">Find a time to meet, fast.</h1>
        <p className="text-center text-ink-muted mt-2 text-sm">
          Pick dates, share a link, see when everyone&rsquo;s free. No sign-ups.
        </p>
        <CreateEventForm />
      </main>
    </div>
  )
}
