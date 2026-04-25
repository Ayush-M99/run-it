// Seed 8 fake users + ~30 synthetic runs distributed over the last 7 days.
// Each run is a random walk inside a randomly chosen region, then process_run is invoked.
// Run: npx tsx scripts/seed_fake_users.ts

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const FAKE_USERS = [
  ['runner.alex@example.com', 'Alex'],
  ['runner.bex@example.com', 'Bex'],
  ['runner.cam@example.com', 'Cam'],
  ['runner.dee@example.com', 'Dee'],
  ['runner.eli@example.com', 'Eli'],
  ['runner.fin@example.com', 'Fin'],
  ['runner.gus@example.com', 'Gus'],
  ['runner.hex@example.com', 'Hex'],
] as const;

const RUNS_TOTAL = 80;
const POINTS_PER_RUN = 80;

type Region = { id: number; geojson: string };

function bbox(poly: GeoJSON.Polygon): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of poly.coordinates) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function pointInPolygon(x: number, y: number, poly: GeoJSON.Polygon): boolean {
  const ring = poly.coordinates[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function randomWalk(poly: GeoJSON.Polygon, n: number): Array<[number, number]> {
  const b = bbox(poly);
  // Find a starting point inside the polygon.
  let start: [number, number] | null = null;
  for (let i = 0; i < 200 && !start; i++) {
    const x = b.minX + Math.random() * (b.maxX - b.minX);
    const y = b.minY + Math.random() * (b.maxY - b.minY);
    if (pointInPolygon(x, y, poly)) start = [x, y];
  }
  if (!start) return [];
  const pts: Array<[number, number]> = [start];
  const stepDeg = 0.00018; // ~20 m
  let heading = Math.random() * Math.PI * 2;
  for (let i = 1; i < n; i++) {
    heading += (Math.random() - 0.5) * 0.4;
    let [x, y] = pts[pts.length - 1];
    let nx = x + Math.cos(heading) * stepDeg;
    let ny = y + Math.sin(heading) * stepDeg;
    if (!pointInPolygon(nx, ny, poly)) {
      // Bounce by flipping heading.
      heading += Math.PI;
      nx = x + Math.cos(heading) * stepDeg;
      ny = y + Math.sin(heading) * stepDeg;
    }
    pts.push([nx, ny]);
  }
  return pts;
}

async function ensureUser(email: string, displayName: string): Promise<string> {
  // Try create. If it already exists, look it up.
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: 'demo-password-1234',
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (created?.user) return created.user.id;
  if (createErr && !/already.+exists|registered/i.test(createErr.message)) {
    throw createErr;
  }
  // Look up existing.
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const found = list.users.find((u) => u.email === email);
  if (!found) throw new Error(`could not create or find user ${email}`);
  return found.id;
}

async function main() {
  const { data: regs, error: rErr } = await sb.rpc('regions_as_geojson');
  if (rErr) throw rErr;
  const regions = (regs as Region[]).map((r) => ({ id: r.id, poly: JSON.parse(r.geojson) as GeoJSON.Polygon }));
  if (regions.length === 0) {
    console.error('No regions in DB. Run scripts/load_regions.ts first.');
    process.exit(1);
  }

  console.log(`Ensuring ${FAKE_USERS.length} fake users...`);
  const userIds: string[] = [];
  for (const [email, name] of FAKE_USERS) {
    const id = await ensureUser(email, name);
    userIds.push(id);
    process.stdout.write('.');
  }
  console.log(`\nGot ${userIds.length} user ids.`);

  console.log(`Generating ${RUNS_TOTAL} synthetic runs...`);
  for (let i = 0; i < RUNS_TOTAL; i++) {
    const userId = userIds[i % userIds.length];
    // Round-robin over regions so every region gets at least a few runs.
    const region = regions[i % regions.length];
    const path = randomWalk(region.poly, POINTS_PER_RUN);
    if (path.length < 10) continue;

    // Bias toward today + yesterday so the demo's leaderboards + map look full.
    const daysAgo =
      Math.random() < 0.6
        ? Math.floor(Math.random() * 2)
        : 2 + Math.floor(Math.random() * 5);
    const startedAt = new Date(Date.now() - daysAgo * 86_400_000 - Math.random() * 6 * 3600_000);
    const endedAt = new Date(startedAt.getTime() + path.length * 4000);

    // Compute distance via Haversine for the run row.
    const distM = pathDistance(path);

    const { data: runRow, error: runErr } = await sb
      .from('runs')
      .insert({
        user_id: userId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        distance_m: distM,
      })
      .select('id')
      .single();
    if (runErr || !runRow) {
      console.error('run insert failed:', runErr?.message);
      continue;
    }

    const rows = path.map((pt, k) => ({
      run_id: runRow.id,
      ts: new Date(startedAt.getTime() + k * 4000).toISOString(),
      geom: `SRID=4326;POINT(${pt[0]} ${pt[1]})`,
    }));
    const { error: ptsErr } = await sb.from('run_points').insert(rows);
    if (ptsErr) {
      console.error('points insert failed:', ptsErr.message);
      continue;
    }

    // Process via RPC. We're using the service role so the auth check inside
    // process_run() (`auth.uid() <> v_user_id`) is skipped.
    const { error: procErr } = await sb.rpc('process_run', { p_run_id: runRow.id });
    if (procErr) console.error('process_run failed:', procErr.message);
    process.stdout.write('.');
  }
  console.log(`\nDone. Triggering snapshot for yesterday...`);
  const { data: snapCount } = await sb.rpc('snapshot_daily_winners', {
    p_date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  });
  console.log(`Snapshot wrote ${snapCount} winners.`);
}

function pathDistance(path: Array<[number, number]>): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [lng1, lat1] = path[i - 1];
    const [lng2, lat2] = path[i];
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
