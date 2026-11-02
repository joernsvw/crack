import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { compressImage, type RecipeDraft } from './data'

export interface ImportedDraft extends Omit<RecipeDraft, 'tagNames'> {
  tags: string[]
}

/** Geteilter Text enthaelt oft mehr als den Link, TikTok schickt zum Beispiel "Schau dir das an! https://..." */
export function extractFirstUrl(text: string | null | undefined): string | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text ?? '')
  return match ? match[0].replace(/[),.;!?]+$/, '') : null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

export function importRecipeFromLink(url: string): Promise<ImportedDraft> {
  return callRecipeFunction({ url })
}

function prepareScreenshots(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      try {
        return { type: 'image/jpeg', data: await blobToBase64(await compressImage(file)) }
      } catch {
        throw new Error(`„${file.name}“ konnte nicht gelesen werden. Bitte nimm einen normalen Screenshot.`)
      }
    }),
  )
}

/** Liefert einen Vorschlag fuer das ganze Rezept. Gespeichert wird erst im Formular. */
export async function proposeRecipeEdit(recipeId: string, instruction: string, files: File[]): Promise<ImportedDraft> {
  return callRecipeFunction({ recipe_id: recipeId, instruction, screenshots: await prepareScreenshots(files) })
}

export async function draftFromScreenshots(files: File[]): Promise<ImportedDraft> {
  return callRecipeFunction({ action: 'screenshots', screenshots: await prepareScreenshots(files) })
}

async function callRecipeFunction(body: Record<string, unknown>): Promise<ImportedDraft> {
  return (await invokeAiFunction<{ draft: ImportedDraft }>(body)).draft
}

export async function invokeAiFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('import-recipe', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null)
      throw new Error(body?.error ?? 'Das hat nicht geklappt. Bitte versuche es noch einmal.')
    }
    // Das iPhone trennt die Verbindung, sobald man die App verlaesst, zum Beispiel um zu TikTok zu wechseln.
    throw new Error(
      navigator.onLine
        ? 'Die Verbindung wurde unterbrochen. Lass Crack beim Einlesen geöffnet und versuche es noch einmal.'
        : 'Dafür brauchst du eine Internetverbindung.',
    )
  }
  return data as T
}
