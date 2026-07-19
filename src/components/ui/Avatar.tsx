import { avatarColor, avatarInitials } from '@/lib/avatarColor'

interface AvatarProps {
  name: string
  present?: boolean
  size?: number
}

export default function Avatar({ name, present = false, size = 30 }: AvatarProps) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full font-extrabold text-white border-2 border-canvas select-none"
      style={{ width: size, height: size, fontSize: size * 0.36, backgroundColor: avatarColor(name) }}
      title={name}
    >
      {avatarInitials(name)}
      {present && (
        <span
          aria-label={`${name} is here now`}
          className="absolute -right-0.5 -bottom-0.5 rounded-full bg-success border-2 border-canvas"
          style={{ width: Math.round(size * 0.32), height: Math.round(size * 0.32) }}
        />
      )}
    </span>
  )
}
