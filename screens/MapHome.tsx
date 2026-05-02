import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MapView, Camera, ShapeSource, FillLayer, LineLayer } from '@rnmapbox/maps';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { userColorHex } from '../lib/colors';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/ui';
import { ChallengeCard } from '../lib/ui/components';

type RegionRow = { id: number; name: string; geom: GeoJSON.Polygon };
type TerritoryOwner = {
  region_id: number;
  user_id: string;
  points: number;
  distance_m?: number;
  display_name?: string;
};

const PARCHMENT_STYLE =
  (Constants.expoConfig?.extra?.mapboxParchmentStyleUrl as string | undefined) ??
  'mapbox://styles/mapbox/outdoors-v12';
const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ??
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined);
const HAS_MAPBOX_TOKEN = !!MAPBOX_TOKEN && !MAPBOX_TOKEN.startsWith('PASTE_');

const FALLBACK_CENTER: [number, number] = [-74.006, 40.7128];
const PREVIEW_REGIONS = [
  { id: 101, name: 'Harbor Loop', color: '#5b9bd5', leader: 'Preview Runner', points: 420 },
  { id: 102, name: 'Market Mile', color: '#f0b64d', leader: 'Bex', points: 370 },
  { id: 103, name: 'River Ward', color: '#57a773', leader: 'Cam', points: 280 },
  { id: 104, name: 'Old Town', color: '#c65f63', leader: 'Dee', points: 210 },
  { id: 105, name: 'Parkside', color: '#8f6bd9', leader: 'Eli', points: 180 },
  { id: 106, name: 'North Grid', color: '#3f7f82', leader: 'Fin', points: 140 },
];

export default function MapHome({
  onRegionTap,
}: {
  onRegionTap: (regionId: number, regionName: string) => void;
}) {
  const { session } = useAuth();
  const { palette } = useTheme();
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [yesterdayWinners, setYesterdayWinners] = useState<Record<number, TerritoryOwner>>({});
  const [todayLeaders, setTodayLeaders] = useState<Record<number, TerritoryOwner>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'today' | 'yesterday'>('today');

  // card state
  const [cardVisible, setCardVisible] = useState(false);
  const [cardRegion, setCardRegion] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rs, error } = await supabase.rpc('regions_as_geojson');
      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }
      const parsed: RegionRow[] = (rs as Array<{ id: number; name: string; geojson: string }>).map(
        (r) => ({ id: r.id, name: r.name, geom: JSON.parse(r.geojson) as GeoJSON.Polygon }),
      );
      setRegions(parsed);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: ws } = await supabase
        .from('daily_region_winners')
        .select('region_id,user_id,points')
        .eq('date', yesterday.toISOString().slice(0, 10));
      if (cancelled) return;
      const byRegion: Record<number, TerritoryOwner> = {};
      for (const w of (ws ?? []) as TerritoryOwner[]) byRegion[w.region_id] = w;
      setYesterdayWinners(byRegion);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);

    async function loadTodayLeaders() {
      const { data, error } = await supabase.rpc('current_region_leaders', { p_date: today });
      if (cancelled || error) return;
      const byRegion: Record<number, TerritoryOwner> = {};
      for (const leader of (data ?? []) as TerritoryOwner[]) byRegion[leader.region_id] = leader;
      setTodayLeaders(byRegion);
    }

    loadTodayLeaders();
    const channel = supabase
      .channel(`map-current-leaders:${today}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'region_scores', filter: `date=eq.${today}` },
        () => loadTodayLeaders(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const owners = view === 'today' ? todayLeaders : yesterdayWinners;

  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: regions.map((r) => {
      const owner = owners[r.id];
      const isMine = !!session && owner?.user_id === session.user.id;
      return {
        type: 'Feature',
        id: r.id,
        properties: {
          regionId: r.id,
          name: r.name,
          fillColor: owner ? userColorHex(owner.user_id) : palette.landFill,
          isMine,
        },
        geometry: r.geom,
      };
    }),
  };

  const center = regions[0]?.geom.coordinates[0]?.[0]
    ? [regions[0].geom.coordinates[0][0][0], regions[0].geom.coordinates[0][0][1]]
    : FALLBACK_CENTER;

  function handleRegionPress(e: any) {
    const f = e.features[0] as GeoJSON.Feature | undefined;
    const props = f?.properties as { regionId?: number; name?: string } | undefined;
    if (props?.regionId != null && props.name) {
      setCardRegion({ id: props.regionId, name: props.name });
      setCardVisible(true);
    }
  }

  const cardOwner = cardRegion ? owners[cardRegion.id] : undefined;

  return (
    <View style={styles.root}>
      {/* header strip */}
      <View
        style={[
          styles.header,
          { backgroundColor: palette.ink, borderBottomColor: palette.glowGold },
        ]}
      >
        <Text style={[styles.appName, { color: palette.glowGold }]}>RUN-IT</Text>
        <View style={[styles.toggle, { borderColor: palette.landEdge }]}>
          <ToggleOption label="Today" active={view === 'today'} onPress={() => setView('today')} />
          <ToggleOption
            label="Yesterday"
            active={view === 'yesterday'}
            onPress={() => setView('yesterday')}
          />
        </View>
      </View>

      {Platform.OS === 'web' && !HAS_MAPBOX_TOKEN ? (
        <PreviewTerritoryMap
          onRegionPress={(id, name) => {
            setCardRegion({ id, name });
            setCardVisible(true);
          }}
        />
      ) : (
        <MapView style={styles.map} styleURL={PARCHMENT_STYLE}>
          <Camera centerCoordinate={center as [number, number]} zoomLevel={12} />
          {regions.length > 0 && (
            <ShapeSource id="regions" shape={fc} onPress={handleRegionPress}>
              <FillLayer
                id="regions-fill"
                style={{ fillColor: ['get', 'fillColor'], fillOpacity: 0.3 }}
              />
              <LineLayer
                id="regions-line"
                style={{
                  lineColor: ['case', ['get', 'isMine'], palette.glowGold, palette.landEdge],
                  lineWidth: ['case', ['get', 'isMine'], 3, 1.5],
                  lineOpacity: 0.85,
                }}
              />
            </ShapeSource>
          )}
        </MapView>
      )}

      {loading && (
        <View style={[styles.loadingBadge, { backgroundColor: `${palette.ink}ee` }]}>
          <ActivityIndicator color={palette.glowGold} />
          <Text style={[styles.loadingText, { color: palette.cream }]}>Loading map…</Text>
        </View>
      )}

      {!loading && regions.length === 0 && (
        <View style={[styles.emptyBadge, { backgroundColor: palette.red }]}>
          <Text style={[styles.emptyText, { color: palette.white }]}>
            No regions loaded. Run `npm run regions:fetch` then `npm run regions:load`.
          </Text>
        </View>
      )}

      {/* region card */}
      <ChallengeCard
        visible={cardVisible}
        regionName={cardRegion?.name ?? ''}
        ownerUserId={cardOwner?.user_id}
        ownerName={cardOwner?.display_name}
        points={cardOwner?.points}
        distanceKm={cardOwner?.distance_m != null ? cardOwner.distance_m / 1000 : undefined}
        onOpenLeaderboard={() => {
          setCardVisible(false);
          if (cardRegion) onRegionTap(cardRegion.id, cardRegion.name);
        }}
        onDismiss={() => setCardVisible(false)}
      />
    </View>
  );
}

function PreviewTerritoryMap({
  onRegionPress,
}: {
  onRegionPress: (regionId: number, regionName: string) => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.previewMap, { backgroundColor: palette.parchment }]}>
      <View style={styles.previewGrid}>
        {PREVIEW_REGIONS.map((region, index) => (
          <TouchableOpacity
            key={region.id}
            style={[
              styles.previewRegion,
              {
                backgroundColor: `${region.color}66`,
                borderColor: index === 0 ? palette.glowGold : palette.landEdge,
                transform: [{ rotate: index % 2 === 0 ? '-2deg' : '2deg' }],
              },
            ]}
            onPress={() => onRegionPress(region.id, region.name)}
          >
            <Text style={[styles.previewRegionName, { color: palette.ink }]}>{region.name}</Text>
            <Text style={[styles.previewLeader, { color: palette.parchmentInk }]}>
              {region.leader} · {region.points} pts
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.previewNote, { color: palette.parchmentMid }]}>
        Preview map. Add Mapbox token for live map tiles.
      </Text>
    </View>
  );
}

function ToggleOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { palette, radii } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.toggleOption,
        { backgroundColor: active ? palette.glowGold : 'transparent', borderRadius: radii.sm },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.toggleText, { color: active ? palette.ink : palette.dim }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  previewMap: { flex: 1, padding: 18, justifyContent: 'center' },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  previewRegion: {
    width: '44%',
    minHeight: 130,
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-between',
  },
  previewRegionName: { fontFamily: 'BebasNeue', fontSize: 30, letterSpacing: 1 },
  previewLeader: { fontFamily: 'Inter-Bold', fontSize: 12 },
  previewNote: { textAlign: 'center', marginTop: 22, fontFamily: 'Inter', fontSize: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 2,
  },
  appName: { fontFamily: 'BebasNeue', fontSize: 24, letterSpacing: 3 },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 2,
  },
  toggleOption: { paddingHorizontal: 12, paddingVertical: 6 },
  toggleText: { fontFamily: 'Inter-Bold', fontSize: 12, letterSpacing: 0.5 },
  loadingBadge: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { fontFamily: 'Inter', fontSize: 13 },
  emptyBadge: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 10,
  },
  emptyText: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter' },
});
