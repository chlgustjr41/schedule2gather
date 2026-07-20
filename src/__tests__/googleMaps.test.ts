import { describe, expect, it } from 'vitest'
import { googleMapsSearchUrl } from '@/lib/googleMaps'

describe('googleMapsSearchUrl', () => {
  it('builds a maps search URL with the address URL-encoded', () => {
    const url = googleMapsSearchUrl('Joe’s Pizza, 123 Main St')
    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true)
    expect(url).toContain(encodeURIComponent('Joe’s Pizza, 123 Main St'))
  })

  it('encodes special characters like & and spaces', () => {
    const url = googleMapsSearchUrl('5th & Main, Suite #2')
    expect(url).not.toContain(' ')
    expect(url).toContain('%26')
  })
})
