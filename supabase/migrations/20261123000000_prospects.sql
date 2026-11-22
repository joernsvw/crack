-- Prospekte als PDF hochladen und die Angebote daraus speichern.
-- Das Handy zerlegt das PDF in kleine Teile, die Edge Function liest sie im Hintergrund aus.

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  store text not null check (char_length(store) between 1 and 60),
  file_name text,
  -- Leer lassen heisst: aus dem Prospekt erkennen.
  valid_from date,
  valid_to date,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'error')),
  error text,
  chunk_paths text[] not null default '{}',
  chunks_total int not null default 0,
  chunks_done int not null default 0,
  offer_count int not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create index prospects_household_idx on public.prospects (household_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  prospect_id uuid not null,
  store text not null,
  name text not null check (char_length(name) between 1 and 200),
  brand text,
  quantity text,
  price numeric(10, 2) not null check (price >= 0),
  original_price numeric(10, 2) check (original_price is null or original_price >= 0),
  base_price text,
  condition text,
  valid_from date,
  valid_to date,
  page int,
  foreign key (prospect_id, household_id) references public.prospects (id, household_id) on delete cascade
);
create index offers_household_idx on public.offers (household_id);
create index offers_prospect_idx on public.offers (prospect_id);

do $$
declare
  t text;
begin
  foreach t in array array['prospects', 'offers'] loop
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

alter publication supabase_realtime add table public.prospects, public.offers;

-- Privater Speicher nur fuer die PDF-Teile. Sie werden nach dem Auslesen wieder geloescht.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prospects', 'prospects', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "Prospekte lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'prospects' and private.can_access_object(name));
create policy "Prospekte hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prospects' and private.can_access_object(name));
create policy "Prospekte loeschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'prospects' and private.can_access_object(name));
