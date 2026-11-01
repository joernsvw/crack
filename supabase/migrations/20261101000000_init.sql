-- Grundschema: Haushalt, Einkaufsliste, Rezepte, Notizen.
-- Jede Tabelle traegt household_id; RLS erlaubt Zugriff nur fuer Mitglieder dieses Haushalts.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Haushalt
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  max_members int not null default 2,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- Die App geht davon aus, dass jede Person genau einem Haushalt angehoert.
  unique (user_id)
);

create function private.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Einkaufsliste
-- ---------------------------------------------------------------------------
create table public.shopping_items (
  -- Die ID kommt vom Client, damit offline angelegte Eintraege idempotent synchronisieren.
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  quantity text,
  unit text,
  category text not null default 'Sonstiges',
  checked boolean not null default false,
  checked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shopping_items_household_idx on public.shopping_items (household_id);

-- ---------------------------------------------------------------------------
-- Rezepte
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  unique (household_id, name),
  unique (id, household_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  unique (household_id, name),
  unique (id, household_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  steps text[] not null default '{}',
  servings int check (servings is null or servings > 0),
  total_minutes int check (total_minutes is null or total_minutes >= 0),
  category_id uuid references public.categories (id) on delete set null,
  source_url text,
  image_path text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create index recipes_household_idx on public.recipes (household_id);
create index recipes_category_idx on public.recipes (category_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  quantity text,
  unit text,
  sort_order int not null default 0,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

create table public.recipe_tags (
  household_id uuid not null,
  recipe_id uuid not null,
  tag_id uuid not null,
  primary key (recipe_id, tag_id),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (tag_id, household_id) references public.tags (id, household_id) on delete cascade
);
create index recipe_tags_tag_idx on public.recipe_tags (tag_id);

create table public.recipe_ratings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  note text,
  -- Eintraege der Form {ingredient, type: omitted|replaced|more, replacement}; UI folgt in Phase 2.
  modifications jsonb not null default '[]' check (jsonb_typeof(modifications) = 'array'),
  updated_at timestamptz not null default now(),
  unique (recipe_id, user_id),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);

create table public.cook_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recipe_id uuid not null,
  cooked_at timestamptz not null default now(),
  cooked_by uuid default auth.uid() references auth.users (id) on delete set null,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index cook_history_recipe_idx on public.cook_history (recipe_id);

-- Die Kategorie muss zum selben Haushalt gehoeren wie das Rezept.
create function private.check_recipe_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and c.household_id = new.household_id
  ) then
    raise exception 'Kategorie gehoert nicht zu diesem Haushalt';
  end if;
  return new;
end;
$$;
create trigger recipes_check_category
  before insert or update of category_id, household_id on public.recipes
  for each row execute function private.check_recipe_category();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger recipes_touch before update on public.recipes
  for each row execute function private.touch_updated_at();
create trigger recipe_ratings_touch before update on public.recipe_ratings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Notizen
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null default '',
  preview text not null default '',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
  pinned boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_household_idx on public.notes (household_id);

-- Nur echte Textaenderungen zaehlen als "zuletzt bearbeitet", Anheften nicht.
create function private.touch_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is distinct from old.title or new.content is distinct from old.content then
    new.updated_at := now();
    new.updated_by := auth.uid();
  else
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
  end if;
  return new;
end;
$$;
create trigger notes_touch before update on public.notes
  for each row execute function private.touch_note();

-- ---------------------------------------------------------------------------
-- Haushalt anlegen und beitreten (nur ueber diese Funktionen moeglich)
-- ---------------------------------------------------------------------------
create function public.create_household(household_name text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Du gehörst bereits zu einem Haushalt';
  end if;

  insert into public.households (name) values (household_name) returning id into new_id;
  insert into public.household_members (household_id, user_id, display_name)
    values (new_id, auth.uid(), member_name);
  insert into public.categories (household_id, name, sort_order)
    select new_id, c.name, c.ord
    from unnest(
      array['Abendessen', 'Mittagessen', 'Frühstück', 'Backen', 'Snacks', 'Desserts', 'Getränke']
    ) with ordinality as c(name, ord);
  return new_id;
end;
$$;

create function public.join_household(code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.households%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Du gehörst bereits zu einem Haushalt';
  end if;

  -- for update: zwei gleichzeitige Beitritte koennen das Limit nicht ueberschreiten.
  select * into target from public.households where invite_code = trim(code) for update;
  if not found then
    raise exception 'Der Einladungscode ist ungültig';
  end if;
  if (select count(*) from public.household_members where household_id = target.id) >= target.max_members then
    raise exception 'Dieser Haushalt ist bereits voll';
  end if;

  insert into public.household_members (household_id, user_id, display_name)
    values (target.id, auth.uid(), member_name);
  return target.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte und Row Level Security
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy "Mitglieder lesen ihren Haushalt" on public.households
  for select to authenticated using (private.is_member(id));

create policy "Mitglieder sehen einander" on public.household_members
  for select to authenticated using (private.is_member(household_id));

-- Nur der eigene Anzeigename ist aenderbar; Beitritt und Austritt laufen nicht ueber die Tabelle.
revoke insert, update, delete on public.households from authenticated;
revoke insert, update, delete on public.household_members from authenticated;
grant update (display_name) on public.household_members to authenticated;
create policy "Eigenen Namen aendern" on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array[
    'shopping_items', 'categories', 'tags', 'recipes', 'recipe_ingredients',
    'recipe_tags', 'cook_history', 'notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Haushaltsmitglieder" on public.%I for all to authenticated
         using (private.is_member(household_id))
         with check (private.is_member(household_id))',
      t
    );
  end loop;
end;
$$;

-- Eine Bewertung gehoert der Person, die sie abgegeben hat; lesen duerfen alle im Haushalt.
alter table public.recipe_ratings enable row level security;
create policy "Bewertungen lesen" on public.recipe_ratings
  for select to authenticated using (private.is_member(household_id));
create policy "Eigene Bewertung anlegen" on public.recipe_ratings
  for insert to authenticated
  with check (private.is_member(household_id) and user_id = auth.uid());
create policy "Eigene Bewertung aendern" on public.recipe_ratings
  for update to authenticated
  using (user_id = auth.uid())
  with check (private.is_member(household_id) and user_id = auth.uid());
create policy "Eigene Bewertung loeschen" on public.recipe_ratings
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.shopping_items,
  public.notes,
  public.recipes,
  public.recipe_ingredients,
  public.recipe_tags,
  public.recipe_ratings,
  public.cook_history,
  public.categories,
  public.tags,
  public.household_members;

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket, der Pfad beginnt immer mit der household_id
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function private.can_access_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  return private.is_member(folder::uuid);
end;
$$;
revoke all on function private.can_access_object(text) from public, anon;
grant execute on function private.can_access_object(text) to authenticated;

create policy "Rezeptbilder lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-images' and private.can_access_object(name));
create policy "Rezeptbilder hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and private.can_access_object(name));
create policy "Rezeptbilder aendern" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-images' and private.can_access_object(name))
  with check (bucket_id = 'recipe-images' and private.can_access_object(name));
create policy "Rezeptbilder loeschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and private.can_access_object(name));
