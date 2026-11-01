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
  walk(doc)
  return { title: lines[0]?.slice(0, 200) ?? '', preview: lines.slice(1).join(' ').slice(0, 200) }
}
