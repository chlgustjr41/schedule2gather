import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary font-extrabold shadow-[var(--s2g-shadow-primary)] hover:brightness-105 active:brightness-95',
  secondary: 'bg-surface text-ink border-[1.5px] border-line font-bold hover:bg-raised',
  ghost: 'text-primary font-bold hover:bg-primary/10',
  danger: 'bg-danger text-on-primary font-extrabold hover:brightness-105',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-3 w-full',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    />
  )
}
