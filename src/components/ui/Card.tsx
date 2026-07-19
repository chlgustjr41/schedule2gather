import type { HTMLAttributes } from 'react'

export default function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`bg-surface border border-line rounded-[20px] shadow-[var(--s2g-shadow-card)] p-4 ${className}`}
    />
  )
}
