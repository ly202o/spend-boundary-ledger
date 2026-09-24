create table if not exists public.ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ledgers enable row level security;

create policy "Users can read their own ledger"
on public.ledgers for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own ledger"
on public.ledgers for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own ledger"
on public.ledgers for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
