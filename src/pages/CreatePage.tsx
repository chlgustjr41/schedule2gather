import AppHeader from '@/components/AppHeader'
import CreateEventForm from '@/components/CreateEventForm'

export default function CreatePage() {
  return (
    <div className="min-h-screen">
      <AppHeader className="max-w-3xl" />
      <main className="max-w-3xl mx-auto px-4 pb-16">
        <h1 className="text-3xl font-extrabold text-center mt-8">Create an event</h1>
        <p className="text-center text-ink-muted mt-2 text-sm">
          Pick dates, share a link, see when everyone&rsquo;s free. No sign-ups.
        </p>
        <CreateEventForm />
      </main>
    </div>
  )
}
