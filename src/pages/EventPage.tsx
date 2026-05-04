import { useParams } from 'react-router-dom'

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Event {slug}</h1>
        <p className="mt-4 text-sm text-gray-400">Phase 1 — grid lands in next tasks</p>
      </div>
    </div>
  )
}
