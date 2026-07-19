import { describe, expect, it } from 'vitest'
import { AVATAR_COLORS, avatarColor, avatarInitials } from '@/lib/avatarColor'

describe('avatarColor', () => {
  it('is deterministic and drawn from the warm palette', () => {
    expect(avatarColor('Sam')).toBe(avatarColor('Sam'))
    expect(AVATAR_COLORS).toContain(avatarColor('Sam'))
    expect(AVATAR_COLORS).toContain(avatarColor('가나다'))
  })
})

describe('avatarInitials', () => {
  it('uses first+last word initials, uppercased', () => {
    expect(avatarInitials('Jacob Choi')).toBe('JC')
    expect(avatarInitials('sam')).toBe('SA')
    expect(avatarInitials('Mary Jane Watson')).toBe('MW')
    expect(avatarInitials('  ')).toBe('?')
  })
})
