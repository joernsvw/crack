import { useState } from 'react'
import { ImageOff, X } from 'lucide-react'
import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useImageUrl } from '../recipes/data'
import { NOTE_BUCKET } from './noteImages'

function NoteImageView({ node, deleteNode, selected, editor }: ReactNodeViewProps) {
  const path = node.attrs.path as string
  const url = useImageUrl(path, NOTE_BUCKET)
  const [failed, setFailed] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  return (
    <NodeViewWrapper className="note-image" data-drag-handle>
      <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${selected ? 'ring-2 ring-primary' : ''}`}>
        {url && !failed ? (
          <img
            src={url}
            alt=""
            className="block max-h-[70vh] w-full cursor-zoom-in object-contain"
            onError={() => setFailed(true)}
            onClick={() => setZoomed(true)}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-muted">
            {failed ? <ImageOff size={28} aria-label="Bild nicht verfügbar" /> : <span className="text-sm">Bild wird geladen …</span>}
          </div>
        )}
        {editor.isEditable && (
          <button
            type="button"
            className="icon-btn absolute right-2 top-2 !h-9 !w-9 bg-black/55 !text-white"
            aria-label="Bild entfernen"
            onClick={() => {
              if (window.confirm('Bild aus der Notiz entfernen?')) deleteNode()
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {zoomed && url && (
        <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setZoomed(false)} role="dialog" aria-label="Bild groß">
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
          <button type="button" className="icon-btn safe-top absolute right-3 top-3 !text-white" aria-label="Schließen">
            <X size={26} />
          </button>
        </div>
      )}
    </NodeViewWrapper>
  )
}

/** Ein Bild als eigener Block. Gespeichert wird nur der Pfad im privaten Speicher, nie ein Link. */
export const NoteImage = Node.create({
  name: 'noteImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { path: { default: null } }
  },

  parseHTML() {
    return [{ tag: 'img[data-note-image]', getAttrs: (element) => ({ path: (element as HTMLElement).getAttribute('data-note-image') }) }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes({ 'data-note-image': HTMLAttributes.path, alt: '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView)
  },
})
