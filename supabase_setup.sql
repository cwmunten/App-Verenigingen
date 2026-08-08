-- Vappie - veilige eerste Supabase-koppeling
-- Uitvoeren in Supabase > SQL Editor.
-- De app blijft lokaal werken als Supabase niet bereikbaar is.

create table if not exists public.vappie_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

alter table public.vappie_state enable row level security;

grant select, insert, update on table public.vappie_state to authenticated;
revoke all on table public.vappie_state from anon;

-- Alleen ingelogde Supabase-gebruikers mogen Vappie lezen en wijzigen.
drop policy if exists "vappie_authenticated_select" on public.vappie_state;
create policy "vappie_authenticated_select"
on public.vappie_state for select
to authenticated
using (true);

drop policy if exists "vappie_authenticated_insert" on public.vappie_state;
create policy "vappie_authenticated_insert"
on public.vappie_state for insert
to authenticated
with check (auth.uid() = updated_by);

drop policy if exists "vappie_authenticated_update" on public.vappie_state;
create policy "vappie_authenticated_update"
on public.vappie_state for update
to authenticated
using (true)
with check (auth.uid() = updated_by);
