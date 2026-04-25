// Load data/regions.geojson into the regions table via the service-role key.
// Run: npx tsx scripts/load_regions.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const path = join(process.cwd(), 'data', 'regions.geojson');
  const fc = JSON.parse(readFileSync(path, 'utf8')) as {
    type: 'FeatureCollection';
    features: Array<{ properties: { name: string }; geometry: object }>;
  };
  console.log(`Loading ${fc.features.length} regions...`);

  // Wipe + reload. Acceptable for an MVP seed.
  const { error: delErr } = await supabase.from('regions').delete().neq('id', 0);
  if (delErr) {
    console.error('delete failed:', delErr);
    process.exit(1);
  }

  let inserted = 0;
  for (const f of fc.features) {
    // Use a SQL RPC because the JS client can't insert geometry directly.
    // We rely on a generic exec via a one-off rpc; alternative: pass GeoJSON as text and use ST_GeomFromGeoJSON in a function.
    const { error } = await supabase.rpc('insert_region', {
      p_name: f.properties.name,
      p_geojson: JSON.stringify(f.geometry),
    });
    if (error) {
      console.error(`failed: ${f.properties.name}:`, error.message);
      continue;
    }
    inserted++;
  }
  console.log(`Inserted ${inserted}/${fc.features.length} regions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
