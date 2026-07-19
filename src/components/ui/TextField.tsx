import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function TextField({ label, id, className = '', ...rest }: TextFieldProps) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-[10px] font-extrabold uppercase tracking-widest text-ink-muted mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        {...rest}
        className={`w-full bg-raised border-[1.5px] border-line rounded-[12px] px-4 py-3 text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-primary ${className}`}
      />
    </div>
  )
}
