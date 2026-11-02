import { useEffect, useState } from 'react'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { readCache, writeCache } from '../../lib/cache'
import { supabase } from '../../lib/supabase'
import type { Category, Recipe, Tag } from '../../lib/types'

export const BUCKET = 'recipe-images'
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60
const SIGNED_URL_RENEW_MS = 6 * 24 * 60 * 60 * 1000

export function useRecipes(householdId: string) {
  return useLiveQuery<Recipe[]>({
    householdId,
    key: 'recipes',
    tables: ['recipes', 'recipe_ingredients', 'recipe_tags', 'recipe_ratings', 'cook_history'],
    fetcher: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(*), recipe_tags(tag_id), recipe_ratings(*), cook_history(id, cooked_at)')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Recipe[]).map((recipe) => ({
        ...recipe,
        recipe_ingredients: [...recipe.recipe_ingredients].sort((a, b) => a.sort_order - b.sort_order),
        cook_history: [...recipe.cook_history].sort((a, b) => b.cooked_at.localeCompare(a.cooked_at)),
      }))
    },
  })
}

export function useCategories(householdId: string) {
  return useLiveQuery<Category[]>({
    householdId,
    key: 'categories',
    tables: ['categories'],
    fetcher: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order')
      if (error) throw error
      return data as Category[]
    },
  })
}

export function useTags(householdId: string) {
  return useLiveQuery<Tag[]>({
    householdId,
    key: 'tags',
    tables: ['tags'],
    fetcher: async () => {
      const { data, error } = await supabase.from('tags').select('*').eq('household_id', householdId).order('name')
      if (error) throw error
      return data as Tag[]
    },
  })
}

export function averageRating(recipe: Recipe): number | null {
  const ratings = recipe.recipe_ratings
  if (ratings.length === 0) return null
  return ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length
}

export interface RecipeDraft {
  title: string
  description: string | null
  steps: string[]
  servings: number | null
  total_minutes: number | null
  category_id: string | null
  source_url: string | null
  image_path: string | null
  ingredients: { name: string; quantity: string | null; unit: string | null; metric?: string | null }[]
  tagNames: string[]
}

/** Speichert ein Rezept. Neue Zeilen kommen vor dem Loeschen der alten: Ein Abbruch verliert so keine Daten. */
export async function saveRecipe(householdId: string, id: string, draft: RecipeDraft, existing: Recipe | null) {
  const { ingredients, tagNames, ...fields } = draft
  const { error: recipeError } = await supabase.from('recipes').upsert({ id, household_id: householdId, ...fields })
  if (recipeError) throw recipeError

  if (ingredients.length > 0) {
    const { error } = await supabase.from('recipe_ingredients').insert(
      ingredients.map((ingredient, index) => ({
        ...ingredient,
        household_id: householdId,
        recipe_id: id,
        sort_order: index,
      })),
    )
    if (error) throw error
  }
  const oldIds = existing?.recipe_ingredients.map((ingredient) => ingredient.id!) ?? []
  if (oldIds.length > 0) {
    const { error } = await supabase.from('recipe_ingredients').delete().in('id', oldIds)
    if (error) throw error
  }

  let tagIds: string[] = []
  if (tagNames.length > 0) {
    const { error: tagError } = await supabase
      .from('tags')
      .upsert(tagNames.map((name) => ({ household_id: householdId, name })), {
        onConflict: 'household_id,name',
        ignoreDuplicates: true,
      })
    if (tagError) throw tagError
    const { data, error } = await supabase.from('tags').select('id').eq('household_id', householdId).in('name', tagNames)
    if (error) throw error
    tagIds = data.map((tag) => tag.id as string)
  }
  const { error: deleteError } = await supabase.from('recipe_tags').delete().eq('recipe_id', id)
  if (deleteError) throw deleteError
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('recipe_tags')
      .insert(tagIds.map((tagId) => ({ household_id: householdId, recipe_id: id, tag_id: tagId })))
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Bilder
// ---------------------------------------------------------------------------

/** Verkleinert Fotos vor dem Upload: Handybilder sind oft 5 MB und mehr, der Gratis-Speicher ist begrenzt. */
export async function compressImage(file: File, maxSize = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht verarbeitet werden'))), 'image/jpeg', 0.82)
  })
}

export async function uploadRecipeImage(householdId: string, recipeId: string, image: Blob): Promise<string> {
  const path = `${householdId}/${recipeId}-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, image, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

/** Der Bucket ist privat. Die signierte URL wird gemerkt, damit der Browser das Bild aus seinem Cache nehmen kann. */
export function useImageUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    const cacheKey = `img:${path}`
    const cached = readCache<{ url: string; at: number }>(cacheKey)
    if (cached && Date.now() - cached.at < SIGNED_URL_RENEW_MS) {
      setUrl(cached.url)
      return
    }
    let active = true
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS)
      .then(({ data }) => {
        if (!data || !active) return
        writeCache(cacheKey, { url: data.signedUrl, at: Date.now() })
        setUrl(data.signedUrl)
      })
    return () => {
      active = false
    }
  }, [path])

  return url
}
