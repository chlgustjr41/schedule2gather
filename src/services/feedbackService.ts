import { httpsCallable, getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'
import { app } from '@/services/firebase'

let functionsInstance: Functions | null = null

function getFunctionsClient(): Functions {
  if (functionsInstance) return functionsInstance
  functionsInstance = getFunctions(app, 'us-central1')
  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001)
  }
  return functionsInstance
}

export interface SubmitFeedbackInput {
  type: 'bug' | 'feature'
  title: string
  description: string
}

export interface SubmitFeedbackResult {
  url: string
  number: number
}

/** Calls the submitFeedback Cloud Function, which files a GitHub issue on the repo. */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const callable = httpsCallable<SubmitFeedbackInput, SubmitFeedbackResult>(
    getFunctionsClient(),
    'submitFeedback',
  )
  const result = await callable(input)
  return result.data
}
