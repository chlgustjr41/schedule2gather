import { describe, expect, it, beforeEach } from 'vitest'
import { resolveTheme, useThemeStore } from '@/stores/themeStore'

describe('resolveTheme', () => {
  it('passes through explicit light/dark', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })
  it('resolves system to light when matchMedia is unavailable or light', () => {
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ preference: 'system' })
  })
  it('toggle flips resolved theme, persists, and stamps data-theme', () => {
    useThemeStore.getState().init()
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().preference).toBe('dark')
    expect(localStorage.getItem('s2g-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().preference).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
  it('init reads stored preference', () => {
    localStorage.setItem('s2g-theme', 'dark')
    useThemeStore.getState().init()
    expect(useThemeStore.getState().preference).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
