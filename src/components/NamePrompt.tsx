import { useState } from 'react'

interface NamePromptProps {
  priorNames: string[]
  /** Optional: an error message to display (e.g., from a failed join attempt). */
  error?: string | null
  onSubmit: (name: string) => void
}

export default function NamePrompt({ priorNames, error, onSubmit }: NamePromptProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    setSubmitting(true)
    try {
      onSubmit(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form onSubmit={handle} className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-xl font-semibold mb-3">Enter your name</h2>
        {priorNames.length > 0 && (
          <p className="text-sm text-gray-500 mb-3">
            Prior names on this device:{' '}
            {priorNames.map((n, i) => (
              <span key={n}>
                <button
                  type="button"
                  onClick={() => setName(n)}
                  className="underline text-indigo-600"
                >
                  {n}
                </button>
                {i < priorNames.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
        <input
          type="text"
          autoFocus
          required
          maxLength={79}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="Alice"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || name.trim().length === 0}
          className="mt-4 w-full bg-indigo-600 text-white py-2 rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Joining…' : 'Join'}
        </button>
      </form>
    </div>
  )
}
