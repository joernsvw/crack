-- Entdecken-Tab: Geschmacksprofil, zwischengespeicherte KI-Vorschlaege und Rueckmeldungen dazu.

create table public.taste_profile (
  household_id uuid primary key references public.households (id) on delete cascade,
  likes text[] not null default '{}',
  avoids text[] not null default '{}',
  diet text,
  -- Abgelehnte automatische Hinweise, damit sie nicht immer wieder erscheinen.
  dismissed_hints text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger taste_profile_touch before update on public.taste_profile
  for each row execute function private.touch_updated_at();

-- Eine Zeile je Haushalt: Vorschlaege werden nur auf Knopfdruck neu erzeugt, das spart API-Kosten.
create table public.suggestion_cache (
  household_id uuid primary key references public.households (id) on delete cascade,
  suggestions jsonb not null default '[]' check (jsonb_typeof(suggestions) = 'array'),
  created_at timestamptz not null default now()
);

create table public.suggestion_feedback (
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  verdict text not null check (verdict in ('saved', 'dismissed')),
  created_at timestamptz not null default now(),
  primary key (household_id, name)
);

do $$
declare
  t text;
begin
  foreach t in array array['taste_profile', 'suggestion_cache', 'suggestion_feedback'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy "Haushaltsmitglieder" on public.%I for all to authenticated
         using (private.is_member(household_id))
         with check (private.is_member(household_id))',
      t
    );
  end loop;
end;
$$;

alter publication supabase_realtime add table
  public.taste_profile,
  public.suggestion_cache,
  public.suggestion_feedback;
