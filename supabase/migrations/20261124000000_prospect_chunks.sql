-- Prospekte Teil fuer Teil auslesen: Jeder Teil laeuft in einem eigenen kurzen Aufruf der Edge Function,
-- damit kein Aufruf an das Zeitlimit stoesst. Der Zaehler wird atomar erhoeht, so merkt genau ein Aufruf,
-- dass er der letzte war und den Prospekt abschliesst.

alter table public.prospects
  add column validity jsonb not null default '[]' check (jsonb_typeof(validity) = 'array'),
  add column updated_at timestamptz not null default now();

create function public.prospect_chunk_done(p_id uuid, p_from date, p_to date)
returns int
language sql
security invoker
set search_path = ''
as $$
  update public.prospects
     set chunks_done = chunks_done + 1,
         validity = validity || jsonb_build_array(jsonb_build_object('valid_from', p_from, 'valid_to', p_to)),
         updated_at = now()
   where id = p_id and status = 'processing'
  returning chunks_done;
$$;

revoke all on function public.prospect_chunk_done(uuid, date, date) from public, anon;
grant execute on function public.prospect_chunk_done(uuid, date, date) to authenticated;
