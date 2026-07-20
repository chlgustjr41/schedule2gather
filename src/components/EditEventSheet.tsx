import { useState } from 'react'
import { updateEventText } from '@/services/eventService'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'

interface EditEventSheetProps {
  slug: string
  name: string
  location: string
  description: string
  onClose: () => void
}

/** Open to anyone (not just the host) — see firestore.rules. */
export default function EditEventSheet({ slug, name, location, description, onClose }: EditEventSheetProps) {
  const [nameVal, setNameVal] = useState(name)
  const [locationVal, setLocationVal] = useState(location)
  const [descriptionVal, setDescriptionVal] = useState(description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const trimmedName = nameVal.trim()
    if (!trimmedName) {
      setError('Event name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateEventText(slug, {
        name: trimmedName,
        location: locationVal.trim(),
        description: descriptionVal.trim(),
      })
      onClose()
    } catch {
      setError("Couldn't save — try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet title="Edit event details" onClose={onClose}>
      <div className="space-y-3">
        <TextField
          id="edit-event-name"
          label="Event name"
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          maxLength={80}
        />
        <TextField
          id="edit-event-location"
          label="📍 Location (optional)"
          value={locationVal}
          onChange={(e) => setLocationVal(e.target.value)}
          placeholder="Where's it happening? (optional)"
          maxLength={200}
        />
        <div>
          <label
            htmlFor="edit-event-description"
            className="block text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-1.5"
          >
            📝 Description (optional)
          </label>
          <textarea
            id="edit-event-description"
            value={descriptionVal}
            onChange={(e) => setDescriptionVal(e.target.value)}
            placeholder="Any extra details voters should know…"
            maxLength={1000}
            rows={3}
            className="w-full bg-raised border-[1.5px] border-line rounded-[12px] px-4 py-3 text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-primary resize-none"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button size="lg" onClick={() => void handleSave()} disabled={saving} className="mt-2">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </BottomSheet>
  )
}
