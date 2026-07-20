/**
 * Normalize user input into an event code. Accepts a bare code ("6w3wrh")
 * or a pasted share URL ("https://…/e/6w3wrh?x=1") and returns the
 * lowercase slug with any character outside [a-z0-9-] removed.
 */
export function normalizeCode(raw: string): string {
  let s = raw.trim().toLowerCase()
  const fromUrl = s.match(/\/e\/([a-z0-9-]+)/)
  if (fromUrl) s = fromUrl[1]
  return s.replace(/[^a-z0-9-]/g, '')
}
