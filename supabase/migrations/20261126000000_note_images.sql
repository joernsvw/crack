-- Bilder in Notizen. Privater Bucket wie bei den Rezeptbildern, der Pfad beginnt mit der household_id:
-- <household_id>/<note_id>/<zufall>.jpg. In der Notiz steht nur der Pfad, die App holt sich signierte Links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Notizbilder lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-images' and private.can_access_object(name));
create policy "Notizbilder hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-images' and private.can_access_object(name));
create policy "Notizbilder loeschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-images' and private.can_access_object(name));
