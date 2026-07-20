import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN')
const REPO = 'chlgustjr41/schedule2gather'
const COOLDOWN_MS = 60_000

const FEEDBACK_TYPES = ['bug', 'feature'] as const
type FeedbackType = (typeof FEEDBACK_TYPES)[number]

interface SubmitFeedbackInput {
  type: FeedbackType
  title: string
  description: string
}

function validate(input: unknown): asserts input is SubmitFeedbackInput {
  if (!input || typeof input !== 'object') {
    throw new HttpsError('invalid-argument', 'input must be an object')
  }
  const i = input as Record<string, unknown>
  if (!FEEDBACK_TYPES.includes(i.type as FeedbackType)) {
    throw new HttpsError('invalid-argument', `type must be one of: ${FEEDBACK_TYPES.join(', ')}`)
  }
  if (typeof i.title !== 'string' || i.title.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'title is required')
  }
  if (i.title.trim().length > 120) {
    throw new HttpsError('invalid-argument', 'title must be 120 chars or fewer')
  }
  if (typeof i.description !== 'string' || i.description.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'description is required')
  }
  if (i.description.trim().length > 2000) {
    throw new HttpsError('invalid-argument', 'description must be 2000 chars or fewer')
  }
}

/** Signed-in users only (anonymous auth is fine): opens a GitHub issue from an in-app bug/feature report. */
export const submitFeedback = onCall(
  { region: 'us-central1', secrets: [GITHUB_TOKEN] },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'must be authenticated')
    }
    validate(req.data)
    const { type, title, description } = req.data

    const db = getFirestore()
    const limitRef = db.doc(`feedbackLimits/${req.auth.uid}`)
    const limitSnap = await limitRef.get()
    const lastSubmittedAt = (limitSnap.data()?.lastSubmittedAt as Timestamp | undefined)?.toMillis()
    if (lastSubmittedAt && Date.now() - lastSubmittedAt < COOLDOWN_MS) {
      throw new HttpsError('resource-exhausted', 'Please wait a moment before submitting again.')
    }

    const label = type === 'bug' ? 'bug' : 'enhancement'
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN.value()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'schedule2gather-feedback-bot',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[${type === 'bug' ? 'Bug' : 'Feature'}] ${title.trim()}`,
        body: `${description.trim()}\n\n---\nSubmitted via the in-app feedback form.`,
        labels: [label, 'user-submitted'],
      }),
    })

    if (!res.ok) {
      throw new HttpsError('internal', `GitHub responded ${res.status} — couldn't file the issue.`)
    }
    const issue = (await res.json()) as { html_url: string; number: number }

    await limitRef.set({ lastSubmittedAt: Timestamp.now() })

    return { url: issue.html_url, number: issue.number }
  },
)
