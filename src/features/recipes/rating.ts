/** Die Sterne sagen, wie oft ihr ein Gericht essen wollt. */
export const RATING_LABELS: Record<number, string> = {
  5: 'Könnte ich jede Woche essen',
  4: 'Alle 2–3 Wochen',
  3: 'Etwa 1× im Monat',
  2: 'Alle 6–8 Wochen',
  1: 'Etwa 1× im Quartal',
  0: 'Nie wieder',
}

/** Wunschabstand in Tagen je Bewertung, die Mitte der jeweiligen Spanne. */
export const RHYTHM_DAYS: Record<number, number> = { 5: 7, 4: 17, 3: 30, 2: 49, 1: 91 }

export function ratingLabel(rating: number | null | undefined): string {
  return rating === null || rating === undefined ? 'Noch nicht bewertet' : RATING_LABELS[rating]
}
