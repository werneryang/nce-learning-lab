-- Cloud sync storage for NCE Learning Lab.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Each signed-in account owns exactly one row holding its learning state.
create table if not exists public.learning_state (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  state jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now()
);

-- Row Level Security: an account can only ever see or change its own row.
alter table public.learning_state enable row level security;

drop policy if exists "read own learning state" on public.learning_state;
create policy "read own learning state" on public.learning_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "create own learning state" on public.learning_state;
create policy "create own learning state" on public.learning_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own learning state" on public.learning_state;
create policy "update own learning state" on public.learning_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
