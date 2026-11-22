import { useLiveQuery } from '../../hooks/useLiveQuery'
import { supabase } from '../../lib/supabase'
import type { Offer, Prospect } from '../../lib/types'
import { invokeAiFunction } from '../recipes/importLink'

export const STORES = ['Lidl', 'Netto', 'Marktkauf', 'Rewe'] as const

const MAX_PAGES = 120
const MAX_FILE_BYTES = 150 * 1024 * 1024
const TARGET_CHUNK_BYTES = 12 * 1024 * 1024
const MAX_PAGES_PER_CHUNK = 6
// Jeder Teil ist ein KI-Aufruf, am Tag gibt es 50.
const MAX_CHUNKS = 30

export function useProspects(householdId: string) {
  return useLiveQuery<Prospect[]>({
    householdId,
    key: 'prospects',
    tables: ['prospects'],
    fetcher: async () => {
      const { data, error } = await supabase
        .from('prospects')
        .select('id, household_id, store, file_name, valid_from, valid_to, status, error, chunks_total, chunks_done, offer_count, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Prospect[]
    },
  })
}

export function useOffers(householdId: string) {
  return useLiveQuery<Offer[]>({
    householdId,
    key: 'offers',
    tables: ['offers'],
    fetcher: async () => {
      const rows: Offer[] = []
      // Supabase liefert hoechstens 1000 Zeilen am Stueck.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('offers').select('*').eq('household_id', householdId).range(from, from + 999)
        if (error) throw error
        rows.push(...(data as Offer[]).map((offer) => ({ ...offer, price: Number(offer.price), original_price: offer.original_price === null ? null : Number(offer.original_price) })))
        if (data.length < 1000) break
      }
      return rows
    },
  })
}

/** Teilt das PDF auf dem Handy in kleine Stuecke, damit die KI sie einzeln und parallel lesen kann. */
async function splitPdf(file: File, onProgress: (text: string) => void): Promise<Uint8Array[]> {
  // Erst hier laden: Die PDF-Bibliothek ist gross und wird nur fuer den Upload gebraucht.
  const { PDFDocument } = await import('pdf-lib')
  onProgress('PDF wird vorbereitet …')
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const pageCount = source.getPageCount()
  if (pageCount === 0) throw new Error('Das PDF hat keine Seiten.')
  if (pageCount > MAX_PAGES) throw new Error(`Das PDF hat ${pageCount} Seiten. Mehr als ${MAX_PAGES} gehen nicht auf einmal.`)
  const perChunk = Math.max(1, Math.min(MAX_PAGES_PER_CHUNK, Math.floor(TARGET_CHUNK_BYTES / (file.size / pageCount))))
  const chunks: Uint8Array[] = []
  for (let start = 0; start < pageCount; start += perChunk) {
    onProgress(`Seiten ${start + 1} bis ${Math.min(start + perChunk, pageCount)} von ${pageCount} werden vorbereitet …`)
    const part = await PDFDocument.create()
    const indices = Array.from({ length: Math.min(perChunk, pageCount - start) }, (_, offset) => start + offset)
    for (const page of await part.copyPages(source, indices)) part.addPage(page)
    chunks.push(await part.save())
  }
  if (chunks.length > MAX_CHUNKS) throw new Error(`Das PDF ist zu groß für einmal Auslesen (${chunks.length} Teile). Lade bitte nur einen Teil der Seiten hoch.`)
  return chunks
}

export async function uploadProspect(options: {
  householdId: string
  store: string
  file: File
  validFrom: string | null
  validTo: string | null
  onProgress: (text: string) => void
}): Promise<void> {
  const { householdId, store, file, validFrom, validTo, onProgress } = options
  if (file.type && file.type !== 'application/pdf') throw new Error('Bitte wähle eine PDF-Datei.')
  if (file.size > MAX_FILE_BYTES) throw new Error('Das PDF ist zu groß, höchstens 150 MB.')

  let chunks: Uint8Array[]
  try {
    chunks = await splitPdf(file, onProgress)
  } catch (err) {
    throw new Error((err as Error).message.startsWith('Das PDF') ? (err as Error).message : 'Das PDF konnte nicht gelesen werden. Ist es geschützt oder beschädigt?')
  }

  const id = crypto.randomUUID()
  const { error: insertError } = await supabase.from('prospects').insert({
    id,
    household_id: householdId,
    store,
    file_name: file.name.slice(0, 120),
    valid_from: validFrom,
    valid_to: validTo,
  })
  if (insertError) throw insertError

  const paths: string[] = []
  for (let index = 0; index < chunks.length; index++) {
    onProgress(`Teil ${index + 1} von ${chunks.length} wird hochgeladen …`)
    const path = `${householdId}/${id}/teil-${String(index + 1).padStart(3, '0')}.pdf`
    const { error } = await supabase.storage.from('prospects').upload(path, chunks[index], { contentType: 'application/pdf' })
    if (error) {
      await supabase.from('prospects').delete().eq('id', id)
      throw new Error(navigator.onLine ? `Hochladen fehlgeschlagen: ${error.message}` : 'Dafür brauchst du eine Internetverbindung.')
    }
    paths.push(path)
  }
  const { error: updateError } = await supabase.from('prospects').update({ chunk_paths: paths, chunks_total: paths.length }).eq('id', id)
  if (updateError) throw updateError

  onProgress('Wird an die KI übergeben …')
  await startReading(id)
}

export function startReading(prospectId: string) {
  return invokeAiFunction({ action: 'prospect', prospect_id: prospectId })
}

export async function deleteProspect(prospect: Prospect) {
  const { data: files } = await supabase.storage.from('prospects').list(`${prospect.household_id}/${prospect.id}`)
  if (files?.length) {
    await supabase.storage.from('prospects').remove(files.map((file) => `${prospect.household_id}/${prospect.id}/${file.name}`))
  }
  const { error } = await supabase.from('prospects').delete().eq('id', prospect.id)
  if (error) throw error
}

export async function updateValidity(prospectId: string, validFrom: string | null, validTo: string | null) {
  const { error } = await supabase.from('prospects').update({ valid_from: validFrom, valid_to: validTo }).eq('id', prospectId)
  if (error) throw error
}
