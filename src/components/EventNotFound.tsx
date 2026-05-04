import { Link } from 'react-router-dom'

export default function EventNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <p className="mt-2 text-gray-500">This event link is invalid or has expired.</p>
        <Link to="/" className="mt-6 inline-block text-indigo-600 underline">
          Create a new event
        </Link>
      </div>
    </div>
  )
}
