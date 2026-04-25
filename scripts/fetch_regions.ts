// Fetch neighborhood polygons for a city from OSM via Overpass.
// Output: data/regions.geojson (FeatureCollection of Polygon features).
// Run: npx tsx scripts/fetch_regions.ts "Lower Manhattan, New York"

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

type OverpassMember = { type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> };
type OverpassElement = {
  type: 'relation' | 'way';
  id: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
  geometry?: Array<{ lat: number; lon: number }>;
};

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

function buildQuery(city: string): string {
  return `
[out:json][timeout:60];
area["name"="${city}"]["boundary"="administrative"]->.a;
(
  relation(area.a)["boundary"="administrative"]["admin_level"~"^(8|9|10)$"];
  relation(area.a)["place"~"^(suburb|neighbourhood|quarter)$"];
);
out geom;
`.trim();
}

function membersToRing(members: OverpassMember[]): Array<[number, number]> | null {
  // Concatenate outer ways into a single ring. Naive — fine for MVP.
  const ring: Array<[number, number]> = [];
  for (const m of members) {
    if (m.role !== 'outer' || !m.geometry) continue;
    for (const p of m.geometry) ring.push([p.lon, p.lat]);
  }
  if (ring.length < 4) return null;
  // Close the ring if not closed.
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
}

async function main() {
  const city = process.argv[2] ?? 'Manhattan';
  console.log(`Fetching neighborhood polygons for: ${city}`);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'run-it-mvp/0.1 (https://github.com/local)',
    },
    body: 'data=' + encodeURIComponent(buildQuery(city)),
  });
  if (!res.ok) {
    throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { elements: OverpassElement[] };

  const features: Array<{
    type: 'Feature';
    properties: { name: string; osm_id: number };
    geometry: { type: 'Polygon'; coordinates: Array<Array<[number, number]>> };
  }> = [];

  for (const el of json.elements) {
    const name = el.tags?.name ?? el.tags?.['name:en'];
    if (!name) continue;
    let ring: Array<[number, number]> | null = null;
    if (el.type === 'relation' && el.members) ring = membersToRing(el.members);
    else if (el.type === 'way' && el.geometry) {
      ring = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
      const [fx, fy] = ring[0];
      const [lx, ly] = ring[ring.length - 1];
      if (fx !== lx || fy !== ly) ring.push([fx, fy]);
    }
    if (!ring || ring.length < 4) continue;
    features.push({
      type: 'Feature',
      properties: { name, osm_id: el.id },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  }

  // Dedupe by name (keep the largest polygon by ring length).
  const byName = new Map<string, typeof features[number]>();
  for (const f of features) {
    const prev = byName.get(f.properties.name);
    if (!prev || f.geometry.coordinates[0].length > prev.geometry.coordinates[0].length) {
      byName.set(f.properties.name, f);
    }
  }
  const deduped = Array.from(byName.values());

  const out = join(process.cwd(), 'data', 'regions.geojson');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features: deduped }, null, 2));
  console.log(`Wrote ${deduped.length} regions to ${out}`);
  if (deduped.length === 0) {
    console.error('No regions found. Check the city name spelling, or try a smaller administrative unit.');
    process.exit(1);
  }
  if (deduped.length > 30) {
    console.warn(`Got ${deduped.length} regions. Consider trimming to ~10-25 for a cleaner demo.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
