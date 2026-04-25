-- Run-It schema. Paste into Supabase SQL editor in this exact order.
-- Idempotent: safe to re-run.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ─── tables ──────────────────────────────────────────────────────────────────

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists regions (
  id serial primary key,
  name text not null,
  geom geometry(Polygon, 4326) not null
);
create index if not exists regions_geom_idx on regions using gist (geom);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m numeric not null check (distance_m >= 0),
  processed_at timestamptz
);
create index if not exists runs_user_idx on runs (user_id, started_at desc);

create table if not exists run_points (
  run_id uuid not null references runs on delete cascade,
  ts timestamptz not null,
  geom geometry(Point, 4326) not null,
  primary key (run_id, ts)
);
create index if not exists run_points_geom_idx on run_points using gist (geom);

create table if not exists region_scores (
  region_id int not null references regions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  distance_m numeric not null default 0,
  points int not null default 0,
  primary key (region_id, user_id, date)
);
create index if not exists region_scores_lookup
  on region_scores (region_id, date, points desc);

create table if not exists daily_region_winners (
  region_id int not null references regions on delete cascade,
  date date not null,
  user_id uuid not null references auth.users on delete cascade,
  points int not null,
  primary key (region_id, date)
);
create index if not exists daily_region_winners_user_idx
  on daily_region_winners (user_id, date desc);

-- ─── auto-create profile on signup ───────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table profiles               enable row level security;
alter table regions                enable row level security;
alter table runs                   enable row level security;
alter table run_points             enable row level security;
alter table region_scores          enable row level security;
alter table daily_region_winners   enable row level security;

-- profiles: anyone authenticated can read; user can update own row.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update using (auth.uid() = user_id);

-- regions: world readable.
drop policy if exists regions_read on regions;
create policy regions_read on regions for select using (true);

-- runs: owner only.
drop policy if exists runs_select_own on runs;
create policy runs_select_own on runs
  for select using (auth.uid() = user_id);

drop policy if exists runs_insert_own on runs;
create policy runs_insert_own on runs
  for insert with check (auth.uid() = user_id);

drop policy if exists runs_update_own on runs;
create policy runs_update_own on runs
  for update using (auth.uid() = user_id);

-- run_points: owner only (joined through runs).
drop policy if exists run_points_select_own on run_points;
create policy run_points_select_own on run_points
  for select using (
    exists (select 1 from runs r where r.id = run_points.run_id and r.user_id = auth.uid())
  );

drop policy if exists run_points_insert_own on run_points;
create policy run_points_insert_own on run_points
  for insert with check (
    exists (select 1 from runs r where r.id = run_points.run_id and r.user_id = auth.uid())
  );

-- region_scores + daily_region_winners: world readable, server-only writes.
drop policy if exists region_scores_read on region_scores;
create policy region_scores_read on region_scores for select using (true);

drop policy if exists daily_region_winners_read on daily_region_winners;
create policy daily_region_winners_read on daily_region_winners for select using (true);

-- ─── helper: insert a region from GeoJSON (used by scripts/load_regions.ts) ──

create or replace function public.insert_region(p_name text, p_geojson text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  geom_in geometry;
  new_id int;
begin
  geom_in := st_setsrid(st_geomfromgeojson(p_geojson), 4326);
  -- Repair self-intersecting OSM rings, then keep only polygon components,
  -- then pick the single largest polygon. This handles MultiPolygon and
  -- GeometryCollection results from ST_MakeValid uniformly.
  geom_in := st_makevalid(geom_in);
  geom_in := st_collectionextract(geom_in, 3);
  if geom_in is null or st_isempty(geom_in) then
    raise notice 'insert_region(%) produced empty geometry, skipping', p_name;
    return null;
  end if;
  select (st_dump(geom_in)).geom into geom_in
    order by st_area((st_dump(geom_in)).geom) desc
    limit 1;
  insert into regions (name, geom) values (p_name, geom_in) returning id into new_id;
  return new_id;
end;
$$;

-- Only the service role should call this.
revoke execute on function public.insert_region(text, text) from public, anon, authenticated;
