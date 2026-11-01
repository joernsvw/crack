import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { RecipeDraft } from './data'

export interface ImportedDraft extends Omit<RecipeDraft, 'tagNames'> {
  tags: string[]
}

/** Geteilter Text enthaelt oft mehr als den Link, TikTok schickt zum Beispiel "Schau dir das an! https://..." */
export function extractFirstUrl(text: string | null | undefined): string | null {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text ?? '')
  return match ? match[0].replace(/[),.;!?]+$/, '') : null
}

export async function importRecipeFromLink(url: string): Promise<ImportedDraft> {
  const { data, error } = await supabase.functions.invoke('import-recipe', { body: { url } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null)
      throw new Error(body?.error ?? 'Der Import ist fehlgeschlagen. Bitte versuche es noch einmal.')
    }
    throw new Error(navigator.onLine ? 'Der Import ist fehlgeschlagen. Bitte versuche es noch einmal.' : 'Dafür brauchst du eine Internetverbindung.')
  }
  return data.draft as ImportedDraft
}
