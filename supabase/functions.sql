-- Run-It server-side functions. Paste after schema.sql.
-- Idempotent: safe to re-run.

-- ─── regions_as_geojson: emit regions for the map client ─────────────────────

create or replace function public.regions_as_geojson()
returns table(id int, name text, geojson text)
language sql
stable
security definer set search_path = public
as $$
  select id, name, st_asgeojson(geom)::text from regions;
$$;

grant execute on function public.regions_as_geojson() to anon, authenticated;

-- ─── process_run: attribute a run's distance to each region it crosses ──────
-- Builds a LINESTRING from run_points, intersects against every region,
-- sums per-region length in geography (meters), upserts region_scores
-- for the user's current_date, marks run.processed_at.

create or replace function public.process_run(p_run_id uuid)
returns table(region_id int, distance_m numeric, points int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Authorize: only the owner (or the service role) may process.
  select user_id into v_user_id from runs where id = p_run_id;
  if v_user_id is null then
    raise exception 'run % not found', p_run_id;
  end if;
  if auth.uid() is not null and auth.uid() <> v_user_id then
    raise exception 'not authorized to process run %', p_run_id;
  end if;

  return query
  with line as (
    select st_makeline(geom order by ts) as geom
    from run_points
    where run_id = p_run_id
  ),
  -- ST_Intersection of a LineString with a Polygon can return a MultiLineString.
  -- ST_CollectionExtract(g, 2) keeps only the line components, dropping any
  -- degenerate points so ST_Length(geography) is well-defined.
  segments as (
    select r.id as region_id,
           coalesce(
             st_length(
               st_collectionextract(st_intersection(line.geom, r.geom), 2)::geography
             ),
             0
           )::numeric as dist_m
    from regions r, line
    where st_intersects(line.geom, r.geom)
  ),
  upserted as (
    insert into region_scores as rs (region_id, user_id, date, distance_m, points)
    select s.region_id, v_user_id, current_date, s.dist_m, floor(s.dist_m / 10)::int
    from segments s
    where s.dist_m > 0
    on conflict (region_id, user_id, date)
    do update set
      distance_m = rs.distance_m + excluded.distance_m,
      points     = rs.points     + excluded.points
    returning rs.region_id, rs.distance_m, rs.points
  )
  select * from upserted;

  update runs set processed_at = now() where id = p_run_id;
end;
$$;

grant execute on function public.process_run(uuid) to authenticated;

-- ─── snapshot_daily_winners: pick top scorer per region for a given date ────
-- Idempotent on (region_id, date).

create or replace function public.snapshot_daily_winners(p_date date default current_date - 1)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  with ranked as (
    select region_id, user_id, points,
           row_number() over (partition by region_id order by points desc, user_id) as rk
    from region_scores
    where date = p_date and points > 0
  )
  insert into daily_region_winners (region_id, date, user_id, points)
  select region_id, p_date, user_id, points from ranked where rk = 1
  on conflict (region_id, date)
  do update set user_id = excluded.user_id, points = excluded.points;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.snapshot_daily_winners(date) from public, anon, authenticated;
