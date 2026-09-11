-- Vappie Enquêtes v1
-- Eenmalig uitvoeren in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.vappie_surveys (
  id uuid primary key default gen_random_uuid(),
  festival_year text not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','closed')),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.vappie_survey_invitations (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.vappie_surveys(id) on delete cascade,
  festival_year text not null,
  association_id text not null,
  association_name text not null,
  recipient_name text not null default '',
  recipient_email text not null default '',
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','sent','opened','completed')),
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(survey_id, association_id)
);

create table if not exists public.vappie_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.vappie_surveys(id) on delete cascade,
  invitation_id uuid not null unique references public.vappie_survey_invitations(id) on delete cascade,
  festival_year text not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

alter table public.vappie_surveys enable row level security;
alter table public.vappie_survey_invitations enable row level security;
alter table public.vappie_survey_responses enable row level security;

grant select,insert,update,delete on public.vappie_surveys to authenticated;
grant select,insert,update,delete on public.vappie_survey_invitations to authenticated;
grant select,insert,update,delete on public.vappie_survey_responses to authenticated;
revoke all on public.vappie_surveys,public.vappie_survey_invitations,public.vappie_survey_responses from anon;

drop policy if exists surveys_admin on public.vappie_surveys;
create policy surveys_admin on public.vappie_surveys for all to authenticated using (true) with check (auth.uid()=updated_by);
drop policy if exists invitations_admin on public.vappie_survey_invitations;
create policy invitations_admin on public.vappie_survey_invitations for all to authenticated using (true) with check (true);
drop policy if exists responses_admin on public.vappie_survey_responses;
create policy responses_admin on public.vappie_survey_responses for all to authenticated using (true) with check (true);

create or replace function public.get_public_survey(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare inv public.vappie_survey_invitations; sur public.vappie_surveys;
begin
  select * into inv from public.vappie_survey_invitations where token=p_token;
  if inv.id is null then return null; end if;
  select * into sur from public.vappie_surveys where id=inv.survey_id and status='published';
  if sur.id is null then return null; end if;
  if inv.status in ('pending','sent') then update public.vappie_survey_invitations set status='opened',opened_at=coalesce(opened_at,now()) where id=inv.id; inv.status='opened'; end if;
  return jsonb_build_object('survey',to_jsonb(sur)-'updated_by','invitation',(to_jsonb(inv)-'recipient_email')-'token');
end $$;

create or replace function public.submit_public_survey(p_token text,p_answers jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare inv public.vappie_survey_invitations; sur public.vappie_surveys;
begin
  select * into inv from public.vappie_survey_invitations where token=p_token for update;
  if inv.id is null or inv.status='completed' then return false; end if;
  select * into sur from public.vappie_surveys where id=inv.survey_id and status='published';
  if sur.id is null then return false; end if;
  insert into public.vappie_survey_responses(survey_id,invitation_id,festival_year,answers) values(inv.survey_id,inv.id,inv.festival_year,p_answers);
  update public.vappie_survey_invitations set status='completed',completed_at=now(),opened_at=coalesce(opened_at,now()) where id=inv.id;
  return true;
end $$;

revoke all on function public.get_public_survey(text) from public;
revoke all on function public.submit_public_survey(text,jsonb) from public;
grant execute on function public.get_public_survey(text) to anon,authenticated;
grant execute on function public.submit_public_survey(text,jsonb) to anon,authenticated;
