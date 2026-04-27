import { describe, expect, it } from 'vitest';
import { bbox, pointInPolygon, randomWalk, type Polygon } from '../../lib/geo';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
      [0, 0],
    ],
  ],
};

describe('geo helpers', () => {
  it('computes a polygon bounding box', () => {
    expect(bbox(square)).toEqual({ minX: 0, minY: 0, maxX: 0.01, maxY: 0.01 });
  });

  it('classifies points inside and outside the polygon', () => {
    expect(pointInPolygon(0.005, 0.005, square)).toBe(true);
    expect(pointInPolygon(0.02, 0.005, square)).toBe(false);
  });

  it('generates a deterministic walk that stays inside a simple polygon', () => {
    const path = randomWalk(square, 12, () => 0.5);

    expect(path).toHaveLength(12);
    for (const [x, y] of path) {
      expect(pointInPolygon(x, y, square)).toBe(true);
    }
  });
});
