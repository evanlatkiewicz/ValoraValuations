-- Valora accounts: run this in Supabase (SQL Editor > New query > Run).
-- Safe to run more than once.
-- Each saved model belongs to the person who saved it. Row-level security
-- makes the database itself refuse to show or change anyone else's rows.

create table if not exists public.saved_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  ticker text not null check (length(ticker) <= 12),
  name text not null check (length(name) <= 120),
  token text not null check (length(token) <= 20000),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Model types: company DCF, option, and the bank and insurer model
alter table public.saved_models drop constraint if exists saved_models_kind_check;
alter table public.saved_models add constraint saved_models_kind_check check (kind in ('dcf', 'option', 'fin'));

create index if not exists saved_models_user_created on public.saved_models (user_id, created_at desc);

alter table public.saved_models enable row level security;

drop policy if exists "Read own saved models" on public.saved_models;
create policy "Read own saved models" on public.saved_models
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Save own models" on public.saved_models;
create policy "Save own models" on public.saved_models
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own saved models" on public.saved_models;
create policy "Delete own saved models" on public.saved_models
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Feedback from the "Send feedback" form. Anyone can send one; nobody can read
-- them through the site. You read them in Supabase under Table Editor > feedback.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bug', 'data', 'idea')),
  message text not null check (length(message) between 3 and 2000),
  email text check (email is null or length(email) <= 200),
  page text check (page is null or length(page) <= 300),
  ticker text check (ticker is null or length(ticker) <= 12),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Anyone can send feedback" on public.feedback;
create policy "Anyone can send feedback" on public.feedback
  for insert to anon, authenticated with check (true);
