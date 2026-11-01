import { describe, expect, it } from 'vitest'
import { extractFirstUrl } from './importLink'

describe('extractFirstUrl', () => {
  it('findet den Link in geteiltem Text', () => {
    expect(extractFirstUrl('Schau dir das an! https://vm.tiktok.com/abc/ #lecker')).toBe('https://vm.tiktok.com/abc/')
  })
  it('entfernt Satzzeichen am Ende', () => {
    expect(extractFirstUrl('Hier: https://example.com/rezept.')).toBe('https://example.com/rezept')
  })
  it('gibt ohne Link null zurueck', () => {
    expect(extractFirstUrl('kein link hier')).toBeNull()
    expect(extractFirstUrl(null)).toBeNull()
  })
})
