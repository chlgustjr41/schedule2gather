import { useEffect, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  subscribeToComments,
  addComment,
  deleteComment,
  type CommentDoc,
} from '@/services/commentService'

interface CommentsPanelProps {
  slug: string
  /** The current viewer's participant info (for posting). Null if not joined. */
  myParticipant: { participantId: string; name: string; uid: string } | null
  /** True if the viewer is the event host (allows deleting any comment). */
  isHost: boolean
  /** The viewer's Firebase UID (for "is this my comment" check on the delete button). */
  viewerUid: string | null
}

function formatRelative(seconds: number | undefined): string {
  if (!seconds) return 'just now'
  try {
    return formatDistanceToNow(new Date(seconds * 1000), { addSuffix: true })
  } catch {
    return ''
  }
}

function formatExactTime(seconds: number | undefined): string {
  if (!seconds) return ''
  try {
    return format(new Date(seconds * 1000), 'MMM d, HH:mm')
  } catch {
    return ''
  }
}

export default function CommentsPanel({ slug, myParticipant, isHost, viewerUid }: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentDoc[]>([])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToComments(slug, setComments)
    return unsub
  }, [slug])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!myParticipant) {
      setError('Enter your name first to post.')
      return
    }
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    setPosting(true)
    try {
      await addComment(slug, trimmed, myParticipant.name, myParticipant.uid, myParticipant.participantId)
      setText('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post'
      setError(msg)
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(slug, commentId)
    } catch {
      // Silent — could surface in a future iteration
    }
  }

  return (
    <section className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-lg font-semibold mb-3">Comments</h2>

      <form onSubmit={handlePost} className="mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={2}
          disabled={!myParticipant || posting}
          placeholder={myParticipant ? 'Leave a quick note…' : 'Enter your name to post a comment'}
          className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{text.length}/500</span>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              type="submit"
              disabled={!myParticipant || posting || text.trim().length === 0}
              className="text-sm bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No comments yet — say hi!</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const canDelete = isHost || (viewerUid !== null && c.uid === viewerUid)
            return (
              <li key={c.id} className="bg-white border border-gray-200 rounded p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-medium">{c.authorName}</div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs text-gray-400 whitespace-nowrap"
                      title={formatExactTime(c.createdAt?.seconds)}
                    >
                      {formatRelative(c.createdAt?.seconds)}
                      {c.createdAt?.seconds && (
                        <span className="text-gray-300"> · {formatExactTime(c.createdAt.seconds)}</span>
                      )}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(c.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                        title="Delete comment"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{c.text}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
