interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  title?: string
  id?: string
}

export default function Switch({ checked, onChange, label, title, id }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      {label && <span className="text-xs font-bold text-ink-muted">{label}</span>}
      <span
        className={`relative inline-flex w-11 h-6 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
