-- Core tables for per-user notes (encrypted) + profiles

create extension if not exists "pgcrypto";

-- Profiles: created automatically on signup
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  encryption_salt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (user_id = auth.uid());

-- Notebooks (optional but keeps current UI functional)
create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.notebooks enable row level security;

drop policy if exists "notebooks_crud_own" on public.notebooks;
create policy "notebooks_crud_own" on public.notebooks
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Tags (optional)
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.tags enable row level security;

drop policy if exists "tags_crud_own" on public.tags;
create policy "tags_crud_own" on public.tags
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Notes: stores encrypted payload in DB + points to encrypted markdown in Storage
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  notebook_id uuid null references public.notebooks(id) on delete set null,
  tag_ids uuid[] not null default '{}',

  -- encrypted content
  content_nonce text not null,
  content_ciphertext text not null,

  -- where the encrypted markdown file is stored
  bucket_id text not null,
  object_path text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "notes_crud_own" on public.notes;
create policy "notes_crud_own" on public.notes
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- On signup: create profile row and a dedicated Storage bucket named as the user UUID
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  insert into public.profiles(user_id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  -- Create a private bucket per user: bucket id = user uuid as text
  -- This requires the function owner to have permissions on storage schema.
  insert into storage.buckets (id, name, public)
  values (new.id::text, new.id::text, false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Storage RLS: user can only access objects in their own bucket (bucket_id == auth.uid())
-- These tables already exist in Supabase projects.

alter table storage.objects enable row level security;

drop policy if exists "storage_objects_select_own_bucket" on storage.objects;
create policy "storage_objects_select_own_bucket" on storage.objects
for select
using (bucket_id = auth.uid()::text);

drop policy if exists "storage_objects_insert_own_bucket" on storage.objects;
create policy "storage_objects_insert_own_bucket" on storage.objects
for insert
with check (bucket_id = auth.uid()::text);

drop policy if exists "storage_objects_update_own_bucket" on storage.objects;
create policy "storage_objects_update_own_bucket" on storage.objects
for update
using (bucket_id = auth.uid()::text)
with check (bucket_id = auth.uid()::text);

drop policy if exists "storage_objects_delete_own_bucket" on storage.objects;
create policy "storage_objects_delete_own_bucket" on storage.objects
for delete
using (bucket_id = auth.uid()::text);

-- Backfill: ensure buckets exist for users created before trigger was added
insert into storage.buckets (id, name, public)
select u.id::text, u.id::text, false
from auth.users u
on conflict (id) do nothing;
