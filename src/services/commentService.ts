import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/services/firebase'

export interface CommentDoc {
  id: string
  text: string
  authorName: string
  uid: string
  participantId: string
  createdAt: { seconds: number; nanoseconds: number } | null
}

/**
 * Subscribe to all comments on an event, ordered newest first.
 */
export function subscribeToComments(
  slug: string,
  cb: (comments: CommentDoc[]) => void,
): Unsubscribe {
  const ref = collection(db, 'events', slug, 'comments')
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const list: CommentDoc[] = snap.docs.map((d) => {
      const data = d.data() as Omit<CommentDoc, 'id'>
      return { id: d.id, ...data }
    })
    cb(list)
  })
}

/**
 * Post a new comment. authorName / participantId come from the local participant.
 */
export async function addComment(
  slug: string,
  text: string,
  authorName: string,
  uid: string,
  participantId: string,
): Promise<void> {
  const trimmed = text.trim()
  if (trimmed.length === 0) throw new Error('Comment cannot be empty')
  if (trimmed.length > 500) throw new Error('Comment too long (max 500 chars)')
  const ref = collection(db, 'events', slug, 'comments')
  await addDoc(ref, {
    text: trimmed,
    authorName,
    uid,
    participantId,
    createdAt: serverTimestamp(),
  })
}

export async function deleteComment(slug: string, commentId: string): Promise<void> {
  const ref = doc(db, 'events', slug, 'comments', commentId)
  await deleteDoc(ref)
}
