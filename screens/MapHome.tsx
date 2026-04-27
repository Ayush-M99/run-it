import { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import Mapbox, { MapView, Camera, ShapeSource, FillLayer, LineLayer } from '@rnmapbox/maps';
import { supabase } from '../lib/supabase';
import { userColorHex } from '../lib/colors';
import { useAuth } from '../lib/auth';

type RegionRow = { id: number; name: string; geom: GeoJSON.Polygon };
type TerritoryOwner = { region_id: number; user_id: string; points: number; distance_m?: number };

const FALLBACK_CENTER: [number, number] = [-74.006, 40.7128];

export default function MapHome({
  onRegionTap,
}: {
  onRegionTap: (regionId: number, regionName: string) => void;
}) {
  const { session } = useAuth();
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [yesterdayWinners, setYesterdayWinners] = useState<Record<number, TerritoryOwner>>({});
  const [todayLeaders, setTodayLeaders] = useState<Record<number, TerritoryOwner>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fetch regions as GeoJSON via PostGIS ST_AsGeoJSON.
      const { data: rs, error } = await supabase.rpc('regions_as_geojson');
      if (cancelled) return;
      if (error) {
        console.warn('regions load failed', error.message);
        setLoading(false);
        return;
      }
      const parsed: RegionRow[] = (rs as Array<{ id: number; name: string; geojson: string }>).map(
        (r) => ({
          id: r.id,
          name: r.name,
          geom: JSON.parse(r.geojson) as GeoJSON.Polygon,
        }),
      );
      setRegions(parsed);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().slice(0, 10);
      const { data: ws } = await supabase
        .from('daily_region_winners')
        .select('region_id,user_id,points')
        .eq('date', dateStr);
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
      if (cancelled) return;
      if (error) {
        console.warn('today leaders load failed', error.message);
        return;
      }
      const byRegion: Record<number, TerritoryOwner> = {};
      for (const leader of (data ?? []) as TerritoryOwner[]) byRegion[leader.region_id] = leader;
      setTodayLeaders(byRegion);
    }

    loadTodayLeaders();
    const channel = supabase
      .channel(`map-current-leaders:${today}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'region_scores',
          filter: `date=eq.${today}`,
        },
        () => loadTodayLeaders(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: regions.map((r) => {
      const owner = todayLeaders[r.id] ?? yesterdayWinners[r.id];
      const isMine = !!session && owner?.user_id === session.user.id;
      return {
        type: 'Feature',
        id: r.id,
        properties: {
          regionId: r.id,
          name: r.name,
          fillColor: owner ? userColorHex(owner.user_id) : '#2a3b50',
          isMine,
        },
        geometry: r.geom,
      };
    }),
  };

  const center = regions[0]?.geom.coordinates[0]?.[0]
    ? [regions[0].geom.coordinates[0][0][0], regions[0].geom.coordinates[0][0][1]]
    : FALLBACK_CENTER;

  return (
    <View style={styles.root}>
      <MapView style={styles.map} styleURL={Mapbox.StyleURL.Dark}>
        <Camera centerCoordinate={center as [number, number]} zoomLevel={12} />
        {regions.length > 0 && (
          <ShapeSource
            id="regions"
            shape={fc}
            onPress={(e) => {
              const f = e.features[0] as GeoJSON.Feature | undefined;
              const props = f?.properties as { regionId?: number; name?: string } | undefined;
              if (props?.regionId != null && props.name) onRegionTap(props.regionId, props.name);
            }}
          >
            <FillLayer
              id="regions-fill"
              style={{ fillColor: ['get', 'fillColor'], fillOpacity: 0.45 }}
            />
            <LineLayer
              id="regions-line"
              style={{
                lineColor: ['case', ['get', 'isMine'], '#ffd84a', '#ffffff'],
                lineWidth: ['case', ['get', 'isMine'], 3, 1],
                lineOpacity: 0.6,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {loading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      )}
      {!loading && regions.length === 0 && (
        <View style={styles.emptyBadge}>
          <Text style={styles.emptyText}>
            No regions loaded. Run `npx tsx scripts/fetch_regions.ts "&lt;city&gt;"` then `npx tsx
            scripts/load_regions.ts`.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1a2b' },
  map: { flex: 1 },
  loadingBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(11,26,43,0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { color: '#fff' },
  emptyBadge: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,140,0,0.92)',
    padding: 14,
    borderRadius: 10,
  },
  emptyText: { color: '#fff', fontSize: 13, lineHeight: 18 },
});
