import { Link } from 'react-router-dom'

export default function EventNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Event not found</h1>
        <p className="mt-2 text-ink-muted">This event link is invalid or has expired.</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">
          Create a new event
        </Link>
      </div>
    </div>
  )
}
