import { describe, expect, it } from 'vitest';
import { haversine, pathDistanceMeters } from '../../lib/distance';

describe('distance helpers', () => {
  it('returns zero for the same coordinate', () => {
    const point = { latitude: 40.7128, longitude: -74.006 };
    expect(haversine(point, point)).toBe(0);
  });

  it('computes a known city-distance sanity check', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const london = { latitude: 51.5074, longitude: -0.1278 };

    expect(haversine(nyc, london)).toBeGreaterThan(5_550_000);
    expect(haversine(nyc, london)).toBeLessThan(5_600_000);
  });

  it('sums a multi-point path', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 0.001 };
    const c = { latitude: 0.001, longitude: 0.001 };

    expect(pathDistanceMeters([a, b, c])).toBeCloseTo(haversine(a, b) + haversine(b, c), 6);
  });
});
