import { useMemo } from 'react'
import { AlarmClock, ImageOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Recipe } from '../../lib/types'
import { useImageUrl, useRecipes } from '../recipes/data'
import { dueRecipes } from '../recipes/overview'
import { StarsDisplay } from '../recipes/Stars'

/** Eure eigenen Lieblinge, die laut Sternen mal wieder dran waeren. Ohne KI und ohne Kosten. */
export function DueSection({ householdId }: { householdId: string }) {
  const { data: recipes } = useRecipes(householdId)
  const due = useMemo(() => dueRecipes(recipes ?? []), [recipes])
  if (due.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-bold">
        <AlarmClock size={18} className="text-primary" aria-hidden /> Mal wieder fällig
      </h2>
      <ul className="card divide-y divide-line">
        {due.map(({ recipe, daysSince }) => (
          <DueRow key={recipe.id} recipe={recipe} daysSince={daysSince} />
        ))}
      </ul>
    </section>
  )
}

function DueRow({ recipe, daysSince }: { recipe: Recipe; daysSince: number | null }) {
  const imageUrl = useImageUrl(recipe.image_path)
  return (
    <li>
      <Link to={`/rezepte/${recipe.id}`} className="flex items-center gap-3 p-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-muted">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff size={18} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{recipe.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <StarsDisplay value={recipe.rating} size={12} />
            {daysSince === null ? 'noch nie gekocht' : `zuletzt vor ${daysSince} ${daysSince === 1 ? 'Tag' : 'Tagen'}`}
          </span>
        </span>
      </Link>
    </li>
  )
}
