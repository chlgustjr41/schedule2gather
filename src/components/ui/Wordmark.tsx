import { Link } from 'react-router-dom'

export default function Wordmark() {
  return (
    <Link to="/" className="font-extrabold text-sm text-ink tracking-tight">
      schedule<span className="text-primary">2</span>gather
    </Link>
  )
}
