-- Vappie Meldingen v35 - veilig opnieuw uit te voeren
-- Voegt reacties en de map/status Afgehandeld toe.

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

alter table public.vappie_meldingen
  add column if not exists handled boolean not null default false,
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users(id) on delete set null;

create table if not exists public.vappie_melding_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  melding_id uuid not null references public.vappie_meldingen(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, melding_id)
);

create table if not exists public.vappie_melding_reacties (
  id uuid primary key default gen_random_uuid(),
  melding_id uuid not null references public.vappie_meldingen(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.vappie_meldingen enable row level security;
alter table public.vappie_melding_reads enable row level security;
alter table public.vappie_melding_reacties enable row level security;

drop policy if exists "vappie meldingen lezen" on public.vappie_meldingen;
create policy "vappie meldingen lezen" on public.vappie_meldingen
for select to authenticated using (true);

drop policy if exists "vappie meldingen aanmaken" on public.vappie_meldingen;
create policy "vappie meldingen aanmaken" on public.vappie_meldingen
for insert to authenticated with check (created_by=auth.uid());

drop policy if exists "vappie meldingen bijwerken" on public.vappie_meldingen;
create policy "vappie meldingen bijwerken" on public.vappie_meldingen
for update to authenticated using (true) with check (true);

drop policy if exists "vappie reads eigen lezen" on public.vappie_melding_reads;
create policy "vappie reads eigen lezen" on public.vappie_melding_reads
for select to authenticated using (user_id=auth.uid());

drop policy if exists "vappie reads eigen aanmaken" on public.vappie_melding_reads;
create policy "vappie reads eigen aanmaken" on public.vappie_melding_reads
for insert to authenticated with check (user_id=auth.uid());

drop policy if exists "vappie reads eigen bijwerken" on public.vappie_melding_reads;
create policy "vappie reads eigen bijwerken" on public.vappie_melding_reads
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "vappie reacties lezen" on public.vappie_melding_reacties;
create policy "vappie reacties lezen" on public.vappie_melding_reacties
for select to authenticated using (true);

drop policy if exists "vappie reacties toevoegen" on public.vappie_melding_reacties;
create policy "vappie reacties toevoegen" on public.vappie_melding_reacties
for insert to authenticated with check (user_id=auth.uid());


-- Foto's bij meldingen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vappie-melding-fotos',
  'vappie-melding-fotos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "vappie melding fotos lezen" on storage.objects;
create policy "vappie melding fotos lezen"
on storage.objects for select to authenticated
using (bucket_id='vappie-melding-fotos');

drop policy if exists "vappie melding fotos uploaden" on storage.objects;
create policy "vappie melding fotos uploaden"
on storage.objects for insert to authenticated
with check (bucket_id='vappie-melding-fotos');


-- ===== v42 Externe melders =====
-- Zet de rol external_reporter in raw_app_meta_data (app_metadata).

drop policy if exists "vappie meldingen lezen" on public.vappie_meldingen;
create policy "vappie meldingen lezen"
on public.vappie_meldingen for select
to authenticated
using (
  coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter'
  or created_by = auth.uid()
);

drop policy if exists "vappie meldingen bijwerken" on public.vappie_meldingen;
create policy "vappie meldingen bijwerken"
on public.vappie_meldingen for update
to authenticated
using (coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter')
with check (coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter');

drop policy if exists "vappie reacties lezen" on public.vappie_melding_reacties;
create policy "vappie reacties lezen"
on public.vappie_melding_reacties for select
to authenticated
using (
  coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter'
  or exists (
    select 1 from public.vappie_meldingen m
    where m.id = melding_id and m.created_by = auth.uid()
  )
);

drop policy if exists "vappie reacties toevoegen" on public.vappie_melding_reacties;
create policy "vappie reacties toevoegen"
on public.vappie_melding_reacties for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter'
    or exists (
      select 1 from public.vappie_meldingen m
      where m.id = melding_id and m.created_by = auth.uid()
    )
  )
);

drop policy if exists "externalen geen vappie state" on public.vappie_state;
create policy "externalen geen vappie state"
on public.vappie_state
as restrictive
for all
to authenticated
using (coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter')
with check (coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter');


-- Alleen interne/beheeraccounts mogen een melding verwijderen,
-- en uitsluitend wanneer de melding al Afgehandeld is.
drop policy if exists "vappie meldingen verwijderen" on public.vappie_meldingen;
create policy "vappie meldingen verwijderen"
on public.vappie_meldingen for delete
to authenticated
using (
  coalesce(auth.jwt()->'app_metadata'->>'role','internal') <> 'external_reporter'
  and handled = true
);
