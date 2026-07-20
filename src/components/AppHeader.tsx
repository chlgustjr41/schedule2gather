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
  const isGoogleUser = useAuthStore((s) => s.isGoogleUser)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const signOut = useAuthStore((s) => s.signOut)

  return (
    <div className="bg-primary/10 border-b border-line mb-2">
      <header className={`${className} mx-auto px-4 py-3 flex items-center justify-between gap-3`}>
        <Wordmark />
        <div className="flex items-center gap-2">
          {isGoogleUser ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-bold text-primary hover:underline"
                title="See and manage your events"
              >
                Dashboard
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void signOut()}
                title="Sign out of your account"
              >
                Sign out
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signInWithGoogle().catch(() => {})}
              title="Sign in with Google to manage your events"
            >
              Sign in
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>
    </div>
  )
}
