import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';

import { AuthProvider, useAuth } from './lib/auth';
import SignIn from './screens/SignIn';
import MapHome from './screens/MapHome';
import Run from './screens/Run';
import Leaderboard from './screens/Leaderboard';
import Profile from './screens/Profile';

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ??
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined);

type RootStack = {
  Tabs: undefined;
  Leaderboard: { regionId: number; regionName: string };
};

type Tabs = {
  Map: undefined;
  Run: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStack>();
const Tab = createBottomTabNavigator<Tabs>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: '#0b1a2b',
    card: '#0b1a2b',
    text: '#fff',
    border: '#16263a',
    primary: '#3aa0ff',
  },
};

function TabsNav({ navigation }: any) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0b1a2b' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#0b1a2b', borderTopColor: '#16263a' },
        tabBarActiveTintColor: '#3aa0ff',
        tabBarInactiveTintColor: '#7790aa',
      }}
    >
      <Tab.Screen name="Map" options={{ title: 'Map' }}>
        {() => (
          <MapHome
            onRegionTap={(regionId, regionName) =>
              navigation.navigate('Leaderboard', { regionId, regionName })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Run" component={Run} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#0b1a2b' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!session) return <SignIn />;
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0b1a2b' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="Tabs" component={TabsNav} options={{ headerShown: false }} />
        <Stack.Screen
          name="Leaderboard"
          component={LeaderboardScreen}
          options={({ route }) => ({ title: route.params.regionName })}
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
      <View style={[styles.center, { backgroundColor: '#0b1a2b', padding: 24 }]}>
        <Text style={styles.errorText}>{tokenError}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <Gate />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ff8b8b', textAlign: 'center', fontSize: 16 },
});
