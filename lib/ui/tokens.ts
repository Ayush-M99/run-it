export const palette = {
  cream: '#F5F0E8',
  ink: '#1A1A2E',
  blue: '#2D6BE4',
  red: '#E84040',
  yellow: '#F5C842',
  green: '#3CB371',
  orange: '#FF7043',
  purple: '#7C4DFF',
  landFill: '#E8E0D0',
  landEdge: '#C8BEA8',
  water: '#A8D8EA',
  parchment: '#F5F0E8',
  parchmentInk: '#3A2E1F',
  parchmentMid: '#7A6E5A',
  glowGold: '#FFD84A',
  shadowSoft: 'rgba(26,26,46,0.10)',
  shadowMid: 'rgba(26,26,46,0.20)',
  shadowHard: 'rgba(26,26,46,0.36)',
  white: '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  dim: 'rgba(255,255,255,0.45)',
};

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  token: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  lift: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
} as const;

export const z = {
  map: 0,
  hud: 10,
  toast: 20,
  card: 30,
  modal: 40,
} as const;
