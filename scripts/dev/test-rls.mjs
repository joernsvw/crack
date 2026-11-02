import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
const dir = process.argv[2]
const db = new PGlite()
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
  create publication supabase_realtime;
`)
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(`${dir}/${f}`, 'utf8'))
console.log('Alle Migrationen laufen durch.')
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', C='00000000-0000-0000-0000-00000000000c'
await db.exec(`insert into auth.users values ('${A}'),('${B}'),('${C}')`)
let failed=0
const as=async(uid,fn)=>{await db.exec(`reset role; set request.uid='${uid??''}'; set role ${uid?'authenticated':'anon'};`);try{return await fn()}finally{await db.exec('reset role')}}
const q=(s,p)=>db.query(s,p)
const ok=(n,c)=>{console.log((c?'ok   ':'FAIL ')+n);if(!c)failed++}
const rej=async(n,f)=>{try{await f();ok(n+' (haette scheitern muessen)',false)}catch(e){ok(n+' -> '+e.message,true)}}
const hid=(await as(A,()=>q(`select create_household('H','A') id`))).rows[0].id
const code=(await as(A,()=>q('select invite_code from households'))).rows[0].invite_code
await as(B,()=>q(`select join_household($1,'B')`,[code]))
const hC=(await as(C,()=>q(`select create_household('F','C') id`))).rows[0].id
const up=`insert into taste_profile (household_id, likes, avoids) values ($1,'{Curry}','{Pilze}') on conflict (household_id) do update set likes=excluded.likes, avoids=excluded.avoids`
await as(A,()=>q(up,[hid])); ok('B sieht das Profil von A',(await as(B,()=>q('select * from taste_profile'))).rows[0].likes[0]==='Curry')
await as(B,()=>q(`update taste_profile set diet='vegan'`)); ok('Zweiter schreibt mit',(await as(A,()=>q('select diet from taste_profile'))).rows[0].diet==='vegan')
ok('C sieht fremdes Profil nicht',(await as(C,()=>q('select * from taste_profile where household_id=$1',[hid]))).rows.length===0)
await rej('C schreibt nicht in fremdes Profil',()=>as(C,()=>q(up,[hid])))
await rej('anon liest kein Profil',()=>as(null,()=>q('select * from taste_profile')))
await as(A,()=>q(`insert into suggestion_cache (household_id,suggestions) values ($1,'[{"name":"Dal"}]')`,[hid]))
ok('Cache geteilt',(await as(B,()=>q('select suggestions from suggestion_cache'))).rows[0].suggestions[0].name==='Dal')
await as(A,()=>q(`insert into suggestion_cache (household_id,suggestions) values ($1,'[]') on conflict (household_id) do update set suggestions=excluded.suggestions`,[hid]))
ok('Cache ueberschreibbar',(await as(A,()=>q('select suggestions from suggestion_cache where household_id=$1',[hid]))).rows[0].suggestions.length===0)
await rej('Cache muss Liste sein',()=>as(A,()=>q(`update suggestion_cache set suggestions='{"a":1}'`)))
ok('C sieht fremden Cache nicht',(await as(C,()=>q('select * from suggestion_cache where household_id=$1',[hid]))).rows.length===0)
await as(A,()=>q(`insert into suggestion_feedback (household_id,name,verdict) values ($1,'Dal','dismissed')`,[hid]))
await as(B,()=>q(`insert into suggestion_feedback (household_id,name,verdict) values ($1,'Dal','saved') on conflict (household_id,name) do update set verdict=excluded.verdict`,[hid]))
ok('Feedback aenderbar',(await as(A,()=>q('select verdict from suggestion_feedback'))).rows[0].verdict==='saved')
await rej('Ungueltiges Urteil',()=>as(A,()=>q(`insert into suggestion_feedback (household_id,name,verdict) values ($1,'X','toll')`,[hid])))
await rej('C schreibt kein fremdes Feedback',()=>as(C,()=>q(`insert into suggestion_feedback (household_id,name,verdict) values ($1,'X','saved')`,[hid])))
// Anpassungen beim Bewerten
const rid='20000000-0000-0000-0000-000000000001'
await as(A,()=>q(`insert into recipes (id,household_id,title) values ($1,$2,'P')`,[rid,hid]))
await as(A,()=>q(`insert into recipe_ratings (household_id,recipe_id,stars) values ($1,$2,4)`,[hid,rid]))
await as(A,()=>q(`update recipe_ratings set modifications='[{"ingredient":"Tomaten","type":"omitted"}]' where recipe_id=$1`,[rid]))
ok('Anpassung gespeichert',(await as(B,()=>q('select modifications from recipe_ratings'))).rows[0].modifications[0].type==='omitted')
await rej('Anpassungen muessen Liste sein',()=>as(A,()=>q(`update recipe_ratings set modifications='{"a":1}'`)))
const no=(await q(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows
ok('RLS auf allen Tabellen',no.length===0)
console.log(failed?`\n${failed} FEHLGESCHLAGEN`:'\nAlle Pruefungen bestanden'); process.exit(failed?1:0)
