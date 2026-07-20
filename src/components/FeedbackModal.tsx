import { useState } from 'react'
import { submitFeedback, type SubmitFeedbackResult } from '@/services/feedbackService'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import SegmentedControl from '@/components/ui/SegmentedControl'
import TextField from '@/components/ui/TextField'

interface FeedbackModalProps {
  onClose: () => void
}

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'feature'>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitFeedbackResult | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitFeedback({ type, title: title.trim(), description: description.trim() })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet title="Report a bug or suggest a feature" onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-success font-bold">
            Thanks! Your {type === 'bug' ? 'bug report' : 'feature suggestion'} was filed.
          </p>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline font-bold"
          >
            View issue #{result.number} ↗
          </a>
          <Button variant="secondary" size="md" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <SegmentedControl<'bug' | 'feature'>
            options={[
              { value: 'bug', label: '🐛 Bug' },
              { value: 'feature', label: '💡 Feature idea' },
            ]}
            value={type}
            onChange={setType}
          />
          <TextField
            id="feedback-title"
            label={type === 'bug' ? 'What went wrong?' : 'What would you like to see?'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Short summary"
          />
          <div>
            <label
              htmlFor="feedback-description"
              className="block text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-1.5"
            >
              Details
            </label>
            <textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Steps to reproduce, or details about what you'd like…"
              className="w-full bg-raised border-[1.5px] border-line rounded-[12px] px-4 py-3 text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-primary resize-none"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            size="lg"
            disabled={submitting || !title.trim() || !description.trim()}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}
