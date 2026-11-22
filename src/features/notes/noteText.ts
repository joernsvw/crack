interface DocNode {
  type?: string
  text?: string
  content?: DocNode[]
}

function textOf(node: DocNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(textOf).join('')
}

/** Wie bei Apple Notizen: Die erste Zeile ist der Titel, der Rest die Vorschau. */
export function deriveTitleAndPreview(doc: DocNode): { title: string; preview: string } {
  const lines: string[] = []
  const walk = (node: DocNode) => {
    const isLeafBlock = node.type === 'paragraph' || node.type === 'heading'
    if (isLeafBlock) {
      const text = textOf(node).trim()
      if (text) lines.push(text)
      return
    }
    node.content?.forEach(walk)
  }
  let images = 0
  const count = (node: DocNode) => {
    if (node.type === 'noteImage') images++
    node.content?.forEach(count)
  }
  walk(doc)
  count(doc)
  const imageText = images === 0 ? '' : images === 1 ? '1 Bild' : `${images} Bilder`
  // Eine Notiz nur mit Bildern ist nicht leer und bekommt einen Titel, sonst wuerde sie beim Verlassen geloescht.
  if (lines.length === 0) return { title: imageText, preview: '' }
  const preview = [lines.slice(1).join(' '), imageText].filter(Boolean).join(' · ')
  return { title: lines[0].slice(0, 200), preview: preview.slice(0, 200) }
}
