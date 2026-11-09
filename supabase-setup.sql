-- ============================================================
-- Gen Z Volleyball Malawi — optional public-record sync setup
-- ============================================================
-- PROTOTYPE, NOT PRODUCTION AUTHORIZATION.
-- The sync policies below intentionally preserve the existing anonymous demo.
-- Anyone with the public API key can read/write this table. Do not use it for
-- real accounts, personal contacts, medical records, or private coaching data.
-- Review and remove any sensitive legacy rows before a public deployment.
-- This script does not delete existing data.
--
-- 1. Review this entire file with the project owner.
-- 2. Run it in the existing Supabase project's SQL Editor only if intended.
-- 3. Open sync-setup.html on the website.
-- 4. Enter the project URL and PUBLIC anon/publishable key, test, then save.
--    Never put a service-role or secret key in browser code or browser storage.
-- 5. Verify connectivity with real project credentials before relying on sync.
-- ============================================================

-- One row per public entity. Separate public_players/public_teams row types
-- avoid overwriting legacy private player/team rows with sanitized records.
create table if not exists public.gzvm_sync (
  id bigserial primary key,
  entity_type text not null,
  entity_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists gzvm_sync_entity_idx
  on public.gzvm_sync (entity_type, entity_id);

alter table public.gzvm_sync enable row level security;

-- PROTOTYPE ONLY: replace with authenticated, owner-scoped policies before
-- production. Client-side role checks are not a substitute for these policies.
drop policy if exists "anon read all" on public.gzvm_sync;
create policy "anon read all"
  on public.gzvm_sync for select
  to anon, authenticated
  using (true);

drop policy if exists "anon insert all" on public.gzvm_sync;
create policy "anon insert all"
  on public.gzvm_sync for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon update all" on public.gzvm_sync;
create policy "anon update all"
  on public.gzvm_sync for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon delete all" on public.gzvm_sync;
create policy "anon delete all"
  on public.gzvm_sync for delete
  to anon, authenticated
  using (true);

-- Add the realtime publication only once, so the script can be rerun safely.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gzvm_sync'
  ) then
    alter publication supabase_realtime add table public.gzvm_sync;
  end if;
end
$$;

-- ============================================================
-- Storage buckets
-- Medical documents are PRIVATE. The current registration flow keeps them
-- on-device and does not upload them. Add authenticated owner-scoped storage
-- policies only when a real private upload/authorization flow exists.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profiles', 'profiles', true, null, null),
  ('medical', 'medical', false, 2097152, array['application/pdf', 'image/jpeg', 'image/png']),
  ('highlights', 'highlights', true, null, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types
where storage.buckets.id = 'medical';

-- PROTOTYPE public asset access, deliberately excluding medical documents.
-- These policies still allow anyone to write public profile/highlight assets.
-- Scope uploads to authenticated owners before production use.
drop policy if exists "public read profiles" on storage.objects;
create policy "public read profiles"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('profiles', 'highlights'));

drop policy if exists "public write profiles" on storage.objects;
create policy "public write profiles"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id in ('profiles', 'highlights'));

drop policy if exists "public update profiles" on storage.objects;
create policy "public update profiles"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id in ('profiles', 'highlights'))
  with check (bucket_id in ('profiles', 'highlights'));

-- Remove legacy medical policies if explicitly present. Existing projects may
-- have additional custom policies: review ALL policies in the Supabase dashboard.
drop policy if exists "public read medical" on storage.objects;
drop policy if exists "public write medical" on storage.objects;
drop policy if exists "public update medical" on storage.objects;
