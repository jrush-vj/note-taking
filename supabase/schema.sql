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

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert
with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

-- Notes: stores encrypted payload in DB
-- (Storage columns are optional; Storage setup can be done later without blocking the app.)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  notebook_id uuid null references public.notebooks(id) on delete set null,
  tag_ids uuid[] not null default '{}',

  -- encrypted content
  content_nonce text not null,
  content_ciphertext text not null,

  -- optional: where the encrypted markdown file is stored (if Storage is enabled)
  bucket_id text null,
  object_path text null,

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

-- On signup: create profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Backfill profiles for users that already existed before this schema was applied.
-- Safe to re-run.
insert into public.profiles(user_id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
);

-- Storage setup (per-user buckets + storage.objects RLS) is intentionally not included here,
-- because many Supabase projects restrict altering storage.* tables from the SQL Editor.
