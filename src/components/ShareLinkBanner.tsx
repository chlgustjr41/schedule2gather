import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

interface ShareLinkBannerProps {
  url: string
}

export default function ShareLinkBanner({ url }: ShareLinkBannerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail on insecure origins; the URL is visible for manual copy.
    }
  }

  return (
    <Card className="max-w-5xl mx-auto flex items-center justify-between gap-4 mb-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold">Share this link with your group</p>
        <p className="text-xs text-ink-muted truncate font-mono mt-0.5">{url}</p>
      </div>
      <Button size="sm" onClick={() => void handleCopy()} className="shrink-0">
        {copied ? 'Copied ✓' : 'Copy link'}
      </Button>
    </Card>
  )
}
