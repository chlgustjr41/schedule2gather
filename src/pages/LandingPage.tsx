import CreateEventForm from '@/components/CreateEventForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen py-8">
      <h1 className="text-3xl font-semibold text-center">schedule2gather</h1>
      <p className="text-center text-gray-500 mt-2">Find a time to meet, fast.</p>
      <CreateEventForm />
    </div>
  )
}
