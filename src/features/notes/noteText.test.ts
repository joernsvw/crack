import { describe, expect, it } from 'vitest'
import { deriveTitleAndPreview } from './noteText'

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
