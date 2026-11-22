import { supabase } from '../../lib/supabase'
import { compressImage } from '../recipes/data'

export const NOTE_BUCKET = 'note-images'
/** Frisch hochgeladene Bilder sind evtl. noch nicht gespeichert, zum Beispiel beim anderen Handy. Erst danach aufraeumen. */
const ORPHAN_GRACE_MS = 60 * 60 * 1000

interface DocNode {
  type?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
}

/** Alle Bildpfade, die in einer Notiz vorkommen. */
export function imagePaths(doc: DocNode | null | undefined): string[] {
  const paths: string[] = []
  const walk = (node: DocNode) => {
    if (node.type === 'noteImage' && typeof node.attrs?.path === 'string') paths.push(node.attrs.path)
    node.content?.forEach(walk)
  }
  if (doc) walk(doc)
  return paths
}

export async function uploadNoteImage(householdId: string, noteId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Das ist kein Bild.')
  let image: Blob
  try {
    image = await compressImage(file)
  } catch {
    throw new Error('Das Bild konnte nicht gelesen werden. Versuche ein JPG oder PNG.')
  }
  const path = `${householdId}/${noteId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(NOTE_BUCKET).upload(path, image, { contentType: 'image/jpeg' })
  if (error) throw new Error(navigator.onLine ? `Hochladen fehlgeschlagen: ${error.message}` : 'Für Bilder brauchst du eine Internetverbindung.')
  return path
}

/** Loescht Bilder, die in der Notiz nicht mehr vorkommen. Ganz neue bleiben, falls sie noch gespeichert werden. */
export async function removeUnusedImages(householdId: string, noteId: string, doc: DocNode | null, all = false) {
  const folder = `${householdId}/${noteId}`
  const { data: files } = await supabase.storage.from(NOTE_BUCKET).list(folder)
  if (!files?.length) return
  const used = new Set(imagePaths(doc))
  const unused = files
    .filter((file) => all || (!used.has(`${folder}/${file.name}`) && Date.now() - new Date(file.created_at ?? 0).getTime() > ORPHAN_GRACE_MS))
    .map((file) => `${folder}/${file.name}`)
  if (unused.length) await supabase.storage.from(NOTE_BUCKET).remove(unused)
}
