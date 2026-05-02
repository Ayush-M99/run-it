import { palette, space, radii, shadows, z } from './tokens';
import { fontFamily, type } from './typography';

export const theme = {
  palette,
  space,
  radii,
  shadows,
  z,
  fontFamily,
  type,
} as const;

export type Theme = typeof theme;
