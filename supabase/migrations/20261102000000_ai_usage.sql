-- Tageslimit fuer KI-Aufrufe je Haushalt, damit das API-Guthaben nicht unbemerkt aufgebraucht wird.
-- Aendern laesst sich das Limit nur im Dashboard oder per SQL: update households set ai_daily_limit = ...

alter table public.households add column ai_daily_limit int not null default 50 check (ai_daily_limit >= 0);

create table public.ai_usage (
  household_id uuid not null references public.households (id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (household_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;
create policy "Mitglieder sehen den Verbrauch" on public.ai_usage
  for select to authenticated using (private.is_member(household_id));

-- Zaehlt einen Aufruf fuer den eigenen Haushalt. false heisst: Tageslimit erreicht.
-- Der Haushalt kommt aus der Anmeldung, die Funktion kann also nur das eigene Kontingent belasten.
create function public.consume_ai_call()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
  max_calls int;
  today date := (now() at time zone 'Europe/Berlin')::date;
begin
  select m.household_id, h.ai_daily_limit into hid, max_calls
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = auth.uid();
  if hid is null then
    raise exception 'Kein Haushalt gefunden' using errcode = '28000';
  end if;

  insert into public.ai_usage as u (household_id, day, calls)
  values (hid, today, 1)
  on conflict (household_id, day) do update set calls = u.calls + 1
    where u.calls < max_calls
  returning u.household_id into hid;

  -- Das Limit 0 greift auch beim ersten Aufruf des Tages.
  if max_calls = 0 then
    return false;
  end if;
  return found;
end;
$$;

revoke all on function public.consume_ai_call() from public, anon;
grant execute on function public.consume_ai_call() to authenticated;
