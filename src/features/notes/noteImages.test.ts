import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

const { imagePaths } = await import('./noteImages')

describe('imagePaths', () => {
  it('findet Bilder auch in Listen', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'noteImage', attrs: { path: 'h/n/a.jpg' } },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'noteImage', attrs: { path: 'h/n/b.jpg' } }] }] },
        { type: 'noteImage', attrs: { path: null } },
      ],
    }
    expect(imagePaths(doc)).toEqual(['h/n/a.jpg', 'h/n/b.jpg'])
    expect(imagePaths(null)).toEqual([])
  })
})
