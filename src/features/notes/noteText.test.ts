import { describe, expect, it } from 'vitest'
import { deriveTitleAndPreview } from './noteText'

describe('Bilder in Notizen', () => {
  const image = { type: 'noteImage', attrs: { path: 'h/n/a.jpg' } }
  it('gibt einer Notiz nur mit Bildern einen Titel', () => {
    expect(deriveTitleAndPreview({ type: 'doc', content: [image, image] })).toEqual({ title: '2 Bilder', preview: '' })
  })
  it('nennt Bilder in der Vorschau', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Einkauf' }] }, image] }
    expect(deriveTitleAndPreview(doc)).toEqual({ title: 'Einkauf', preview: '1 Bild' })
  })
})

describe('deriveTitleAndPreview', () => {
  it('nimmt die erste Zeile als Titel und den Rest als Vorschau', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Urlaub' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Koffer ' }, { type: 'text', text: 'packen' }] },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pass' }] }],
            },
          ],
        },
      ],
    }
    expect(deriveTitleAndPreview(doc)).toEqual({ title: 'Urlaub', preview: 'Koffer packen Pass' })
  })

  it('kommt mit einer leeren Notiz zurecht', () => {
    expect(deriveTitleAndPreview({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual({ title: '', preview: '' })
  })
})
