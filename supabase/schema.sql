-- Valora accounts: run this once in Supabase (SQL Editor > New query > Run).
-- Each saved model belongs to the person who saved it. Row-level security
-- makes the database itself refuse to show or change anyone else's rows.

create table if not exists public.saved_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('dcf', 'option')),
  ticker text not null check (length(ticker) <= 12),
  name text not null check (length(name) <= 120),
  token text not null check (length(token) <= 20000),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_models_user_created on public.saved_models (user_id, created_at desc);

alter table public.saved_models enable row level security;

create policy "Read own saved models" on public.saved_models
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Save own models" on public.saved_models
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Delete own saved models" on public.saved_models
  for delete to authenticated using ((select auth.uid()) = user_id);
