import { useEffect, type ReactNode } from 'react'
import { motion } from 'motion/react'

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
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-surface w-full sm:max-w-sm rounded-t-[20px] sm:rounded-[20px] p-5 pb-8 sm:pb-5"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <h2 className="text-lg font-extrabold mb-4">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  )
}
