-- Vappie Meldingen - eenmalige Supabase setup
create table if not exists public.vappie_meldingen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notice_date date not null,
  notice_time time not null,
  subject text not null,
  message text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.vappie_melding_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  melding_id uuid not null references public.vappie_meldingen(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, melding_id)
);
alter table public.vappie_meldingen enable row level security;
alter table public.vappie_melding_reads enable row level security;
drop policy if exists "vappie meldingen lezen" on public.vappie_meldingen;
create policy "vappie meldingen lezen" on public.vappie_meldingen for select to authenticated using (true);
drop policy if exists "vappie meldingen aanmaken" on public.vappie_meldingen;
create policy "vappie meldingen aanmaken" on public.vappie_meldingen for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "vappie reads eigen lezen" on public.vappie_melding_reads;
create policy "vappie reads eigen lezen" on public.vappie_melding_reads for select to authenticated using (user_id = auth.uid());
drop policy if exists "vappie reads eigen aanmaken" on public.vappie_melding_reads;
create policy "vappie reads eigen aanmaken" on public.vappie_melding_reads for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "vappie reads eigen bijwerken" on public.vappie_melding_reads;
create policy "vappie reads eigen bijwerken" on public.vappie_melding_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
