interface CellTooltipProps {
  names: string[]
}

export default function CellTooltip({ names }: CellTooltipProps) {
  return (
    <div className="absolute z-30 left-full top-0 ml-2 bg-ink text-canvas text-xs rounded-[8px] px-2 py-1 whitespace-nowrap pointer-events-none">
      {names.length === 0 ? (
        <span className="text-canvas/60">No one available</span>
      ) : (
        <ul>
          {names.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
