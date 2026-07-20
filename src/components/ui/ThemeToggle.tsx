import { resolveTheme, useThemeStore } from '@/stores/themeStore'

export default function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference)
  const toggle = useThemeStore((s) => s.toggle)
  const isDark = resolveTheme(preference) === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 rounded-full border border-line bg-surface text-sm flex items-center justify-center hover:bg-raised"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
