-- Prospekte fortsetzen statt neu starten: Jeder Teil wird hoechstens einmal gezaehlt, seine Angebote tragen
-- die Nummer des Teils. Bleibt ein Aufruf haengen, liest ein neuer Start nur die fehlenden Teile.

alter table public.prospects
  add column chunks_finished int[] not null default '{}';

alter table public.offers
  add column chunk smallint;

drop function public.prospect_chunk_done(uuid, date, date);

-- Gibt die neue Zahl fertiger Teile zurueck, oder null, wenn der Teil schon gezaehlt war
-- oder der Prospekt nicht mehr ausgelesen wird. Dann muss der Aufruf seine Angebote wieder entfernen.
create function public.prospect_chunk_done(p_id uuid, p_index int, p_from date, p_to date)
returns int
language sql
security invoker
set search_path = ''
as $$
  update public.prospects
     set chunks_finished = chunks_finished || p_index,
         chunks_done = cardinality(chunks_finished) + 1,
         validity = validity || jsonb_build_array(jsonb_build_object('valid_from', p_from, 'valid_to', p_to)),
         updated_at = now()
   where id = p_id
     and status = 'processing'
     and not (p_index = any (chunks_finished))
  returning chunks_done;
$$;

revoke all on function public.prospect_chunk_done(uuid, int, date, date) from public, anon;
grant execute on function public.prospect_chunk_done(uuid, int, date, date) to authenticated;
