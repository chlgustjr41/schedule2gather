import { useEffect, type ReactNode } from 'react'

interface BottomSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet on mobile; centered modal ≥640px. Closes on backdrop click or Escape. */
export default function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-surface w-full sm:max-w-sm rounded-t-[20px] sm:rounded-[20px] p-5 pb-8 sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}
