import { TextStyle } from 'react-native';

export const fontFamily = {
  display: 'BebasNeue',
  body: 'Inter',
  bodyBold: 'Inter-Bold',
} as const;

export const type: Record<string, TextStyle> = {
  hero: { fontFamily: 'BebasNeue', fontSize: 56, letterSpacing: 2 },
  title: { fontFamily: 'BebasNeue', fontSize: 32, letterSpacing: 1.5 },
  badge: { fontFamily: 'BebasNeue', fontSize: 22, letterSpacing: 1 },
  score: { fontFamily: 'BebasNeue', fontSize: 40, letterSpacing: 1 },
  body: { fontFamily: 'Inter', fontSize: 14, lineHeight: 20 },
  bodyBold: { fontFamily: 'Inter-Bold', fontSize: 14, lineHeight: 20 },
  caption: {
    fontFamily: 'Inter',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  captionBold: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
};
