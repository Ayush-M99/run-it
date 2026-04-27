// Pre-flight check: confirm env + Supabase connectivity before EAS build.
// Run: npx tsx scripts/doctor.ts

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

type Check = { name: string; ok: boolean; detail?: string };

async function run(): Promise<Check[]> {
  const checks: Check[] = [];

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mapboxPub = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
  const mapboxDl = process.env.MAPBOX_DOWNLOADS_TOKEN || process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN;

  checks.push({
    name: 'EXPO_PUBLIC_SUPABASE_URL set',
    ok: !!url && !url.startsWith('PASTE_'),
    detail: url ? '' : 'missing',
  });
  checks.push({
    name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY set',
    ok: !!anon && !anon.startsWith('PASTE_'),
  });
  checks.push({ name: 'SUPABASE_SERVICE_ROLE_KEY set (server only)', ok: !!serviceKey });
  checks.push({
    name: 'EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN set',
    ok: !!mapboxPub && mapboxPub.startsWith('pk.'),
  });
  checks.push({
    name: 'MAPBOX_DOWNLOADS_TOKEN set (or RNMAPBOX_MAPS_DOWNLOAD_TOKEN)',
    ok: !!mapboxDl && mapboxDl.startsWith('sk.'),
  });

  if (url && anon && !url.startsWith('PASTE_')) {
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data, error } = await sb.from('regions').select('id', { head: true, count: 'exact' });
      void data;
      checks.push({ name: 'Supabase reachable', ok: !error, detail: error?.message });
    } catch (e: any) {
      checks.push({ name: 'Supabase reachable', ok: false, detail: e?.message ?? String(e) });
    }

    try {
      const { data, error } = await sb.rpc('regions_as_geojson');
      checks.push({
        name: 'regions_as_geojson() RPC exists',
        ok: !error,
        detail: error ? error.message : `${(data as unknown[] | null)?.length ?? 0} regions`,
      });
    } catch (e: any) {
      checks.push({
        name: 'regions_as_geojson() RPC exists',
        ok: false,
        detail: e?.message ?? String(e),
      });
    }
  }

  return checks;
}

run().then((checks) => {
  let bad = 0;
  for (const c of checks) {
    const mark = c.ok ? 'OK  ' : 'FAIL';
    console.log(`[${mark}] ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    if (!c.ok) bad++;
  }
  console.log('');
  if (bad === 0) {
    console.log(
      `All ${checks.length} checks passed. You're ready for: eas build --profile development --platform android`,
    );
  } else {
    console.log(`${bad} check(s) failed. Fix the above, then re-run.`);
    process.exit(1);
  }
});
