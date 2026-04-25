// Upload a finished run + its raw points, then trigger server-side region attribution.

import { supabase } from './supabase';
import type { RunPoint } from './location';
import { pathDistanceMeters } from './distance';

const POINTS_PER_INSERT = 500;

export async function uploadRun(args: {
  userId: string;
  startedAt: number;
  endedAt: number;
  points: RunPoint[];
}): Promise<{ runId: string; distanceM: number } | { error: string }> {
  const { userId, startedAt, endedAt, points } = args;

  if (points.length < 2) return { error: 'Run too short — need at least 2 GPS points.' };

  const distanceM = pathDistanceMeters(
    points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
  );

  const { data: runRow, error: runErr } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      distance_m: distanceM,
    })
    .select('id')
    .single();
  if (runErr || !runRow) return { error: runErr?.message ?? 'failed to insert run' };

  const runId = runRow.id as string;

  for (let i = 0; i < points.length; i += POINTS_PER_INSERT) {
    const chunk = points.slice(i, i + POINTS_PER_INSERT).map((p) => ({
      run_id: runId,
      ts: new Date(p.ts).toISOString(),
      // PostGIS accepts an EWKT string in the WKT column; the schema has geom geometry(Point,4326).
      // We use a SQL-style WKT literal — the supabase-js client serializes it via PostgREST.
      geom: `SRID=4326;POINT(${p.lng} ${p.lat})`,
    }));
    const { error: ptsErr } = await supabase.from('run_points').insert(chunk);
    if (ptsErr) return { error: `points insert failed: ${ptsErr.message}` };
  }

  const { error: rpcErr } = await supabase.rpc('process_run', { p_run_id: runId });
  if (rpcErr) return { error: `process_run failed: ${rpcErr.message}` };

  return { runId, distanceM };
}
