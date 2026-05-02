import { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';

import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider, useAppFonts, palette as P } from './lib/ui';
import SignIn from './screens/SignIn';
import MapHome from './screens/MapHome';
import Run from './screens/Run';
import Leaderboard from './screens/Leaderboard';
import Profile from './screens/Profile';
import RunSummary from './screens/RunSummary';

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ??
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined);

type RootStack = {
  Tabs: undefined;
  Leaderboard: { regionId: number; regionName: string };
  RunSummary: {
    distanceM: number;
    durationMs: number;
    points: number;
    pointCount: number;
    coords: [number, number][];
    userId: string;
  };
};

type Tabs = { Map: undefined; Run: undefined; Profile: undefined };

const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator<Tabs>();

const navTheme = {
  dark: false,
  fonts: undefined as any,
  colors: {
    background: P.parchment,
    card: P.ink,
    text: P.cream,
    border: P.landEdge,
    primary: P.yellow,
    notification: P.red,
  },
};

function TabsNav({ navigation }: any) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: P.ink },
        headerTintColor: P.cream,
        headerTitleStyle: { fontFamily: 'BebasNeue', fontSize: 22 },
        tabBarStyle: { backgroundColor: P.ink, borderTopColor: P.landEdge },
        tabBarActiveTintColor: P.yellow,
        tabBarInactiveTintColor: P.dim,
        tabBarLabelStyle: { fontFamily: 'Inter', fontSize: 11 },
      }}
    >
      <Tab.Screen name="Map" options={{ title: 'Map', headerShown: false }}>
        {() => (
          <MapHome
            onRegionTap={(regionId, regionName) =>
              navigation.navigate('Leaderboard', { regionId, regionName })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Run" component={Run} options={{ title: 'Run', headerShown: false }} />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          title: 'Profile',
          headerStyle: { backgroundColor: P.parchment },
          headerTintColor: P.ink,
        }}
      />
    </Tab.Navigator>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  const [fontsLoaded, fontsError] = useAppFonts();

  if (loading || (!fontsLoaded && !fontsError)) {
    return (
      <View style={[styles.center, { backgroundColor: P.parchment }]}>
        <ActivityIndicator color={P.ink} />
      </View>
    );
  }

  if (!session) return <SignIn />;

  if (Platform.OS === 'web' && session.access_token === 'preview-token') {
    return <WebPreviewShell />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: P.ink },
          headerTintColor: P.cream,
          headerTitleStyle: { fontFamily: 'BebasNeue', fontSize: 20 },
        }}
      >
        <Stack.Screen name="Tabs" component={TabsNav} options={{ headerShown: false }} />
        <Stack.Screen
          name="Leaderboard"
          component={LeaderboardScreen}
          options={({ route }) => ({ title: route.params.regionName })}
        />
        <Stack.Screen
          name="RunSummary"
          component={RunSummary}
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function LeaderboardScreen({ route }: any) {
  return <Leaderboard regionId={route.params.regionId} regionName={route.params.regionName} />;
}

function WebPreviewShell() {
  const [tab, setTab] = useState<'map' | 'run' | 'profile'>('map');

  return (
    <View style={styles.previewRoot}>
      <View style={styles.previewNav}>
        <Text style={styles.previewBrand}>RUN-IT</Text>
        <View style={styles.previewTabs}>
          <PreviewTab label="Map" active={tab === 'map'} onPress={() => setTab('map')} />
          <PreviewTab label="Run" active={tab === 'run'} onPress={() => setTab('run')} />
          <PreviewTab
            label="Profile"
            active={tab === 'profile'}
            onPress={() => setTab('profile')}
          />
        </View>
      </View>

      <View style={styles.previewBody}>
        {tab === 'map' && <MapHome onRegionTap={() => setTab('map')} />}
        {tab === 'run' && <Run navigation={{ navigate: () => setTab('map') }} />}
        {tab === 'profile' && <Profile />}
      </View>
    </View>
  );
}

function PreviewTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.previewTab, active && styles.previewTabActive]}
      onPress={onPress}
    >
      <Text style={[styles.previewTabText, active && styles.previewTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  useEffect(() => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('PASTE_')) {
      console.warn(
        'Mapbox token missing. Set EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN in .env or app.json -> extra.mapboxPublicToken.',
      );
      return;
    }
    Mapbox.setAccessToken(MAPBOX_TOKEN);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
        <StatusBar style="light" />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewRoot: { flex: 1, backgroundColor: P.parchment },
  previewNav: {
    height: 72,
    backgroundColor: P.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    borderBottomWidth: 2,
    borderBottomColor: P.yellow,
  },
  previewBrand: { color: P.yellow, fontFamily: 'BebasNeue', fontSize: 30, letterSpacing: 4 },
  previewTabs: { flexDirection: 'row', gap: 10 },
  previewTab: {
    borderWidth: 1,
    borderColor: P.landEdge,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  previewTabActive: { backgroundColor: P.yellow, borderColor: P.yellow },
  previewTabText: { color: P.cream, fontFamily: 'Inter-Bold', fontSize: 12 },
  previewTabTextActive: { color: P.ink },
  previewBody: { flex: 1, minHeight: 0 },
});
