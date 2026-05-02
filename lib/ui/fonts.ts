import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    // Metro resolves bundled font assets through require().
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    BebasNeue: require('../../assets/fonts/BebasNeue-Regular.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Inter: require('../../assets/fonts/Inter-Regular.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),
  });
}
