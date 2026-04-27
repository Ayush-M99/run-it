// Tiny pure-geo helpers used by the seed script and exercised in tests.
// Kept dependency-free so the same code runs in Node, the RN bundle, and Vitest.

export type Polygon = GeoJSON.Polygon;

export function bbox(poly: Polygon): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
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

// Ray-casting against the outer ring. Holes intentionally not handled —
// neighborhood polygons in our corpus are simple, and ignoring holes is the
// right call for a seed script (better to over-include than over-exclude).
export function pointInPolygon(x: number, y: number, poly: Polygon): boolean {
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

// Random walk constrained to the polygon. Returns [] if no interior start
// found within budget. Caller picks `n` (path length).
export function randomWalk(
  poly: Polygon,
  n: number,
  rng: () => number = Math.random,
): Array<[number, number]> {
  const b = bbox(poly);
  let start: [number, number] | null = null;
  for (let i = 0; i < 200 && !start; i++) {
    const x = b.minX + rng() * (b.maxX - b.minX);
    const y = b.minY + rng() * (b.maxY - b.minY);
    if (pointInPolygon(x, y, poly)) start = [x, y];
  }
  if (!start) return [];
  const pts: Array<[number, number]> = [start];
  const stepDeg = 0.00018; // ~20 m
  let heading = rng() * Math.PI * 2;
  for (let i = 1; i < n; i++) {
    heading += (rng() - 0.5) * 0.4;
    const [x, y] = pts[pts.length - 1];
    let nx = x + Math.cos(heading) * stepDeg;
    let ny = y + Math.sin(heading) * stepDeg;
    if (!pointInPolygon(nx, ny, poly)) {
      heading += Math.PI;
      nx = x + Math.cos(heading) * stepDeg;
      ny = y + Math.sin(heading) * stepDeg;
    }
    pts.push([nx, ny]);
  }
  return pts;
}
