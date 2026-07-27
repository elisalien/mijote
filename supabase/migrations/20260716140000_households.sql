-- Mijote shared household sync (APK)
-- Apply in Supabase SQL editor or via CLI: supabase db push

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  payload jsonb not null default '{}'::jsonb,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists households_code_idx on public.households (code);

alter table public.households enable row level security;

drop policy if exists "households_select" on public.households;
drop policy if exists "households_insert" on public.households;
drop policy if exists "households_update" on public.households;

-- Access secret = unlisted household code (small private foyer).
create policy "households_select" on public.households
  for select to anon, authenticated using (true);
create policy "households_insert" on public.households
  for insert to anon, authenticated with check (true);
create policy "households_update" on public.households
  for update to anon, authenticated using (true) with check (true);

create or replace function public.create_household(p_code text, p_payload jsonb)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.households;
begin
  insert into public.households (code, payload, rev)
  values (upper(trim(p_code)), coalesce(p_payload, '{}'::jsonb), 1)
  returning * into row;
  return row;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.households;
begin
  select * into row from public.households where code = upper(trim(p_code));
  if not found then
    raise exception 'HOUSEHOLD_NOT_FOUND';
  end if;
  return row;
end;
$$;

create or replace function public.push_household(p_code text, p_payload jsonb, p_base_rev bigint)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.households;
begin
  update public.households
  set payload = p_payload,
      rev = rev + 1,
      updated_at = now()
  where code = upper(trim(p_code)) and rev = p_base_rev
  returning * into row;
  if found then
    return row;
  end if;
  select * into row from public.households where code = upper(trim(p_code));
  if not found then
    raise exception 'HOUSEHOLD_NOT_FOUND';
  end if;
  return row;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.households to anon, authenticated;
grant execute on function public.create_household(text, jsonb) to anon, authenticated;
grant execute on function public.join_household(text) to anon, authenticated;
grant execute on function public.push_household(text, jsonb, bigint) to anon, authenticated;

-- Enable Realtime (ignore error if already added)
do $$
begin
  alter publication supabase_realtime add table public.households;
exception when duplicate_object then
  null;
when others then
  null;
end $$;
