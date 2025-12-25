-- Zero-knowledge (client-side) encrypted schema for Supabase
--
-- Goal:
--   Supabase/Postgres stores ONLY opaque blobs (ciphertext + nonce) and opaque UUIDs.
--   No plaintext notebook names, note titles, tag names, or meaningful user metadata.
--
-- Security notes (important):
--   1) RLS prevents users from accessing each other's rows, but the project owner can still
--      see ciphertext, row counts, timestamps, and blob lengths in the dashboard.
--   2) Relationship graph + timestamps can leak usage patterns (metadata). If you need
--      stronger privacy, you must consider padding, batching, and/or client-side sync design.
--   3) This schema intentionally avoids touching storage.* tables because many Supabase
--      projects restrict altering Storage policies from SQL Editor.

create extension if not exists "pgcrypto";

-- Optional: strongly typed object kinds.
-- This leaks the high-level category (note vs notebook vs tag). If you want to minimize
-- metadata further, replace this with a single value (e.g. 'object') and store the real
-- kind inside ciphertext.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'encrypted_object_type') then
    create type public.encrypted_object_type as enum ('notebook', 'note', 'tag');
  end if;
end
$$;

-- Per-user key material (still zero-knowledge):
-- - encrypted_master_key is encrypted client-side (e.g., with a passphrase-derived key)
-- - salt is used for KDF (PBKDF2/Argon2id/etc) on the client
-- - kdf + kdf_params let you migrate algorithms and iterations safely
create table if not exists public.user_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_master_key text not null,
  salt text not null,
  kdf text not null default 'pbkdf2-sha256',
  kdf_params jsonb not null default '{"iterations":210000}'::jsonb,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- All user-generated data is stored as encrypted blobs.
-- Suggested plaintext structure BEFORE encryption (client-side):
--   {
--     "v": 1,
--     "title": "...",
--     "content": "...",
--     "tags": ["..."],
--     "createdAt": 123,
--     ...
--   }
create table if not exists public.encrypted_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.encrypted_object_type not null,
  ciphertext text not null,
  nonce text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Object relationships (structure only).
-- parent_id/child_id are opaque UUIDs; relation_type is a small label.
-- This leaks high-level structure (e.g., how many notes are in a notebook).
-- If you want to minimize metadata further, you can store relation_type inside ciphertext
-- too, but you'll lose server-side filtering.
create table if not exists public.object_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid not null references public.encrypted_objects(id) on delete cascade,
  child_id uuid not null references public.encrypted_objects(id) on delete cascade,
  relation_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prevent obvious duplicates
  unique(user_id, parent_id, child_id, relation_type)
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_keys_set_updated_at on public.user_keys;
create trigger user_keys_set_updated_at
before update on public.user_keys
for each row
execute function public.set_updated_at();

drop trigger if exists encrypted_objects_set_updated_at on public.encrypted_objects;
create trigger encrypted_objects_set_updated_at
before update on public.encrypted_objects
for each row
execute function public.set_updated_at();

drop trigger if exists object_relations_set_updated_at on public.object_relations;
create trigger object_relations_set_updated_at
before update on public.object_relations
for each row
execute function public.set_updated_at();

-- Enforce that relations cannot link objects across users.
-- This is defense-in-depth beyond RLS.
create or replace function public.enforce_relation_same_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_user uuid;
  child_user uuid;
begin
  select user_id into parent_user from public.encrypted_objects where id = new.parent_id;
  select user_id into child_user from public.encrypted_objects where id = new.child_id;

  if parent_user is null or child_user is null then
    raise exception 'parent_id or child_id not found';
  end if;

  if parent_user <> new.user_id or child_user <> new.user_id then
    raise exception 'object_relations user_id must match parent/child user_id';
  end if;

  return new;
end;
$$;

drop trigger if exists object_relations_enforce_same_user on public.object_relations;
create trigger object_relations_enforce_same_user
before insert or update on public.object_relations
for each row
execute function public.enforce_relation_same_user();

-- Indexes
create index if not exists encrypted_objects_user_id_idx on public.encrypted_objects(user_id);
create index if not exists encrypted_objects_type_idx on public.encrypted_objects(user_id, type);
create index if not exists object_relations_user_parent_idx on public.object_relations(user_id, parent_id);
create index if not exists object_relations_user_child_idx on public.object_relations(user_id, child_id);
create index if not exists object_relations_user_relation_idx on public.object_relations(user_id, relation_type);

-- -------------------------
-- Row Level Security (RLS)
-- -------------------------

alter table public.user_keys enable row level security;
alter table public.encrypted_objects enable row level security;
alter table public.object_relations enable row level security;

-- user_keys: only the owning user can read/write their key row
drop policy if exists "user_keys_select_own" on public.user_keys;
create policy "user_keys_select_own" on public.user_keys
for select
using (user_id = auth.uid());

drop policy if exists "user_keys_insert_own" on public.user_keys;
create policy "user_keys_insert_own" on public.user_keys
for insert
with check (user_id = auth.uid());

drop policy if exists "user_keys_update_own" on public.user_keys;
create policy "user_keys_update_own" on public.user_keys
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_keys_delete_own" on public.user_keys;
create policy "user_keys_delete_own" on public.user_keys
for delete
using (user_id = auth.uid());

-- encrypted_objects: only the owning user can CRUD their blobs
drop policy if exists "encrypted_objects_select_own" on public.encrypted_objects;
create policy "encrypted_objects_select_own" on public.encrypted_objects
for select
using (user_id = auth.uid());

drop policy if exists "encrypted_objects_insert_own" on public.encrypted_objects;
create policy "encrypted_objects_insert_own" on public.encrypted_objects
for insert
with check (user_id = auth.uid());

drop policy if exists "encrypted_objects_update_own" on public.encrypted_objects;
create policy "encrypted_objects_update_own" on public.encrypted_objects
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "encrypted_objects_delete_own" on public.encrypted_objects;
create policy "encrypted_objects_delete_own" on public.encrypted_objects
for delete
using (user_id = auth.uid());

-- object_relations: only the owning user can CRUD their structure rows
drop policy if exists "object_relations_select_own" on public.object_relations;
create policy "object_relations_select_own" on public.object_relations
for select
using (user_id = auth.uid());

drop policy if exists "object_relations_insert_own" on public.object_relations;
create policy "object_relations_insert_own" on public.object_relations
for insert
with check (user_id = auth.uid());

drop policy if exists "object_relations_update_own" on public.object_relations;
create policy "object_relations_update_own" on public.object_relations
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "object_relations_delete_own" on public.object_relations;
create policy "object_relations_delete_own" on public.object_relations
for delete
using (user_id = auth.uid());

-- End of zero-knowledge schema
