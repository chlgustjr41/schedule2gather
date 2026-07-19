import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Wordmark from '@/components/ui/Wordmark'

interface AppHeaderProps {
  /** Width constraint matching the page body, e.g. "max-w-2xl" | "max-w-5xl". */
  className?: string
}

export default function AppHeader({ className = 'max-w-5xl' }: AppHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const googleUser = user !== null && !user.isAnonymous

  return (
    <header className={`${className} mx-auto px-4 pt-4 flex items-center justify-between gap-3`}>
      <Wordmark />
      <div className="flex items-center gap-2">
        {googleUser ? (
          <Link to="/dashboard" className="text-sm font-bold text-primary hover:underline">
            Dashboard
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signInWithGoogle().catch(() => {})}
          >
            Sign in
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
