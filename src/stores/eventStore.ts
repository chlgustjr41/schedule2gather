import { create } from 'zustand'
import { subscribeToEvent, type EventDoc } from '@/services/eventService'
import {
  subscribeToParticipants,
  getOrCreateParticipant,
  updateAvailability,
  type ParticipantDoc,
} from '@/services/participantService'

interface EventState {
  slug: string | null
  event: EventDoc | null
  myParticipant: ParticipantDoc | null
  participants: ParticipantDoc[]
  loading: boolean
  notFound: boolean

  _eventUnsub: (() => void) | null
  _participantsUnsub: (() => void) | null

  loadEvent: (slug: string) => void
  joinAs: (name: string, uid: string) => Promise<void>
  updateMyAvailability: (availability: string) => Promise<void>
  reset: () => void
}

export const useEventStore = create<EventState>((set, get) => ({
  slug: null,
  event: null,
  myParticipant: null,
  participants: [],
  loading: true,
  notFound: false,
  _eventUnsub: null,
  _participantsUnsub: null,

  loadEvent: (slug) => {
    const state = get()
    state._eventUnsub?.()
    state._participantsUnsub?.()

    set({
      slug,
      event: null,
      myParticipant: null,
      participants: [],
      loading: true,
      notFound: false,
    })

    const eventUnsub = subscribeToEvent(slug, (event) => {
      if (event === null) {
        set({ event: null, notFound: true, loading: false })
      } else {
        set({ event, notFound: false, loading: false })
      }
    })

    const participantsUnsub = subscribeToParticipants(slug, (participants) => {
      set({ participants })
      const current = get().myParticipant
      if (current) {
        const fresh = participants.find((p) => p.participantId === current.participantId)
        if (fresh) {
          set({ myParticipant: fresh })
        }
      }
    })

    set({ _eventUnsub: eventUnsub, _participantsUnsub: participantsUnsub })
  },

  joinAs: async (name, uid) => {
    const state = get()
    if (!state.slug) throw new Error('joinAs called before loadEvent')
    const participant = await getOrCreateParticipant(state.slug, name, uid)
    set({ myParticipant: participant })
  },

  updateMyAvailability: async (availability) => {
    const state = get()
    if (!state.slug || !state.myParticipant) {
      throw new Error('updateMyAvailability called without slug + myParticipant')
    }
    set({ myParticipant: { ...state.myParticipant, availability } })
    await updateAvailability(state.slug, state.myParticipant.participantId, availability)
  },

  reset: () => {
    const state = get()
    state._eventUnsub?.()
    state._participantsUnsub?.()
    set({
      slug: null,
      event: null,
      myParticipant: null,
      participants: [],
      loading: true,
      notFound: false,
      _eventUnsub: null,
      _participantsUnsub: null,
    })
  },
}))
