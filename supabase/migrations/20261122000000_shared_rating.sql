-- Gemeinsame Bewertung pro Rezept statt einer pro Person. Neue Skala 0 bis 5:
-- 5 = jede Woche, 4 = alle 2-3 Wochen, 3 = ca. 1x im Monat, 2 = alle 6-8 Wochen, 1 = ca. 1x im Quartal, 0 = nie wieder.

alter table public.recipes
  add column rating smallint check (rating between 0 and 5),
  add column rating_note text,
  add column modifications jsonb not null default '[]' check (jsonb_typeof(modifications) = 'array');

-- Bisherige Bewertungen uebernehmen. Die Bedeutung der Sterne bleibt gleich (5 bleibt 5), bei zwei Bewertungen
-- zaehlt der gerundete Mittelwert. Die alte Tabelle bleibt unveraendert erhalten, es geht also nichts verloren.
update public.recipes r
set rating = s.stars
from (select recipe_id, round(avg(stars))::smallint as stars from public.recipe_ratings group by recipe_id) s
where s.recipe_id = r.id;

update public.recipes r
set rating_note = s.notes
from (
  select recipe_id, string_agg(note, E'\n' order by updated_at) as notes
  from public.recipe_ratings
  where note is not null and note <> ''
  group by recipe_id
) s
where s.recipe_id = r.id;

update public.recipes r
set modifications = s.mods
from (
  select recipe_id, jsonb_agg(change) as mods
  from public.recipe_ratings, jsonb_array_elements(modifications) as change
  group by recipe_id
) s
where s.recipe_id = r.id;

comment on table public.recipe_ratings is
  'Alt: Bewertungen pro Person bis November 2026. Die App nutzt seitdem recipes.rating. Nur noch als Sicherung.';
