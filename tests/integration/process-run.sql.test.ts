import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const dbUrl = process.env.TEST_DATABASE_URL;
const describeDb = dbUrl ? describe : describe.skip;

describeDb('process_run SQL integration', () => {
  it('attributes one synthetic run across two PostGIS regions', async () => {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    try {
      await resetDatabase(client);

      const userId = '00000000-0000-4000-8000-000000000101';
      const runId = '00000000-0000-4000-8000-000000000201';
      const runDate = '2026-04-25';

      await client.query(
        `
          insert into auth.users (id, email, raw_user_meta_data)
          values ($1, 'runner@example.com', '{"display_name":"Runner"}'::jsonb)
        `,
        [userId],
      );

      await client.query(`
        insert into regions (id, name, geom)
        values
          (1, 'West', st_geomfromtext('POLYGON((0 0, 0.001 0, 0.001 0.001, 0 0.001, 0 0))', 4326)),
          (2, 'East', st_geomfromtext('POLYGON((0.001 0, 0.002 0, 0.002 0.001, 0.001 0.001, 0.001 0))', 4326))
      `);

      await client.query(
        `
          insert into runs (id, user_id, started_at, ended_at, distance_m)
          values ($1, $2, $3, $4, 180)
        `,
        [runId, userId, `${runDate}T10:00:00Z`, `${runDate}T10:05:00Z`],
      );

      await client.query(
        `
          insert into run_points (run_id, ts, geom)
          values
            ($1, $2, st_setsrid(st_makepoint(0.0002, 0.0005), 4326)),
            ($1, $3, st_setsrid(st_makepoint(0.0010, 0.0005), 4326)),
            ($1, $4, st_setsrid(st_makepoint(0.0018, 0.0005), 4326))
        `,
        [runId, `${runDate}T10:00:00Z`, `${runDate}T10:02:00Z`, `${runDate}T10:04:00Z`],
      );

      await client.query('select public.process_run($1::uuid)', [runId]);

      const processed = await client.query<{ processed_at: Date | null }>(
        'select processed_at from runs where id = $1',
        [runId],
      );
      expect(processed.rows[0]?.processed_at).toBeTruthy();

      const scores = await client.query<{
        region_id: number;
        user_id: string;
        date: string;
        distance_m: string;
        points: number;
      }>(
        `
          select region_id, user_id, date::text, distance_m, points
          from region_scores
          order by region_id
        `,
      );

      expect(scores.rows).toHaveLength(2);
      expect(scores.rows.map((row) => row.region_id)).toEqual([1, 2]);
      for (const row of scores.rows) {
        expect(row.user_id).toBe(userId);
        expect(row.date).toBe(runDate);
        expect(Number(row.distance_m)).toBeGreaterThan(80);
        expect(row.points).toBeGreaterThanOrEqual(8);
      }

      const leaders = await client.query<{
        region_id: number;
        user_id: string;
        points: number;
        distance_m: string;
      }>('select * from public.current_region_leaders($1::date) order by region_id', [runDate]);

      expect(leaders.rows).toHaveLength(2);
      expect(leaders.rows.every((row) => row.user_id === userId)).toBe(true);
    } finally {
      await client.end();
    }
  });
});

async function resetDatabase(client: Client) {
  await client.query(`
    drop schema if exists auth cascade;
    drop table if exists
      public.daily_region_winners,
      public.region_scores,
      public.run_points,
      public.runs,
      public.regions,
      public.profiles
    cascade;
    drop function if exists public.handle_new_user() cascade;
    drop function if exists public.insert_region(text, text) cascade;
    drop function if exists public.regions_as_geojson() cascade;
    drop function if exists public.process_run(uuid) cascade;
    drop function if exists public.current_region_leaders(date) cascade;
    drop function if exists public.snapshot_daily_winners(date) cascade;
    drop role if exists anon;
    drop role if exists authenticated;

    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$ select null::uuid $$;
  `);

  const schemaSql = await readFile(join(process.cwd(), 'supabase', 'schema.sql'), 'utf8');
  const functionsSql = await readFile(join(process.cwd(), 'supabase', 'functions.sql'), 'utf8');

  await client.query(schemaSql);
  await client.query(functionsSql);
}
