import { useLiveQuery } from '../../hooks/useLiveQuery'
import { supabase } from '../../lib/supabase'
import type { Suggestion, TasteProfile } from '../../lib/types'
import { saveRecipe } from '../recipes/data'
import { invokeAiFunction } from '../recipes/importLink'

export function emptyProfile(householdId: string): TasteProfile {
  return { household_id: householdId, likes: [], avoids: [], diet: null, dismissed_hints: [] }
}

export function useTasteProfile(householdId: string) {
  return useLiveQuery<TasteProfile | null>({
    householdId,
    key: 'taste-profile',
    tables: ['taste_profile'],
    fetcher: async () => {
      const { data, error } = await supabase.from('taste_profile').select('*').eq('household_id', householdId).maybeSingle()
      if (error) throw error
      return data as TasteProfile | null
    },
  })
}

export async function saveTasteProfile(householdId: string, patch: Partial<TasteProfile>) {
  const { error } = await supabase
    .from('taste_profile')
    .upsert({ household_id: householdId, ...patch }, { onConflict: 'household_id' })
  if (error) throw error
}

interface CachedSuggestions {
  suggestions: Suggestion[]
  created_at: string | null
  feedback: string[]
}

/** Liest nur den Zwischenspeicher. Neue Vorschlaege kosten Guthaben und kommen deshalb nur auf Knopfdruck. */
export function useCachedSuggestions(householdId: string) {
  return useLiveQuery<CachedSuggestions>({
    householdId,
    key: 'suggestions',
    tables: ['suggestion_cache', 'suggestion_feedback'],
    fetcher: async () => {
      const [cache, feedback] = await Promise.all([
        supabase.from('suggestion_cache').select('suggestions, created_at').eq('household_id', householdId).maybeSingle(),
        supabase.from('suggestion_feedback').select('name').eq('household_id', householdId),
      ])
      if (cache.error) throw cache.error
      if (feedback.error) throw feedback.error
      return {
        suggestions: (cache.data?.suggestions ?? []) as Suggestion[],
        created_at: cache.data?.created_at ?? null,
        feedback: (feedback.data ?? []).map((entry) => entry.name as string),
      }
    },
  })
}

export async function requestSuggestions(): Promise<Suggestion[]> {
  return (await invokeAiFunction<{ suggestions: Suggestion[] }>({ action: 'suggest' })).suggestions
}

export async function requestLeftoverIdeas(leftovers: string[]): Promise<Suggestion[]> {
  return (await invokeAiFunction<{ suggestions: Suggestion[] }>({ action: 'leftovers', leftovers })).suggestions
}

export async function sendFeedback(householdId: string, name: string, verdict: 'saved' | 'dismissed') {
  const { error } = await supabase
    .from('suggestion_feedback')
    .upsert({ household_id: householdId, name, verdict }, { onConflict: 'household_id,name' })
  if (error) throw error
}

/** "Merken": Das Gericht landet direkt als Idee bei den Rezepten und laesst sich dort mit der KI ausbauen. */
export async function saveSuggestionAsRecipe(householdId: string, suggestion: Suggestion): Promise<string> {
  const id = crypto.randomUUID()
  await saveRecipe(
    householdId,
    id,
    {
      title: suggestion.name,
      description: suggestion.description || null,
      steps: [],
      servings: null,
      total_minutes: null,
      category_id: null,
      source_url: null,
      image_path: null,
      ingredients: suggestion.main_ingredients.map((name) => ({ name, quantity: null, unit: null })),
      tagNames: ['idee'],
    },
    null,
  )
  await sendFeedback(householdId, suggestion.name, 'saved')
  return id
}
