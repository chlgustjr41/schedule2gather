import { useState } from 'react'

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
      // Clipboard API can fail on insecure origins or older browsers; user can copy manually.
    }
  }

  return (
    <div className="max-w-5xl mx-auto bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between gap-4 mb-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-indigo-900">Share this link with your group</p>
        <p className="text-sm text-indigo-700 truncate font-mono mt-1">{url}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded shrink-0"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  )
}
