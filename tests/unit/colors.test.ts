import { describe, expect, it } from 'vitest';
import { userColor, userColorHex } from '../../lib/colors';

describe('user colors', () => {
  it('is stable for the same user id', () => {
    const userId = '00000000-0000-4000-8000-000000000001';

    expect(userColor(userId)).toBe(userColor(userId));
    expect(userColorHex(userId)).toBe(userColorHex(userId));
  });

  it('emits valid hex colors for Mapbox layers', () => {
    expect(userColorHex('00000000-0000-4000-8000-000000000002')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('usually differs for different user ids', () => {
    expect(userColorHex('00000000-0000-4000-8000-000000000003')).not.toBe(
      userColorHex('00000000-0000-4000-8000-000000000004'),
    );
  });
});
