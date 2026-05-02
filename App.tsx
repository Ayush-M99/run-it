import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
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

export default function App() {
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('PASTE_')) {
      setTokenError(
        'Mapbox token missing. Set EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN in .env or app.json -> extra.mapboxPublicToken.',
      );
      return;
    }
    Mapbox.setAccessToken(MAPBOX_TOKEN);
  }, []);

  if (tokenError) {
    return (
      <View style={[styles.center, { backgroundColor: P.parchment, padding: 24 }]}>
        <Text style={[styles.errorText, { color: P.red }]}>{tokenError}</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

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
  errorText: { textAlign: 'center', fontSize: 15, fontFamily: 'Inter', lineHeight: 22 },
});
