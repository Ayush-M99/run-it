import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapView, Camera, ShapeSource, LineLayer, UserLocation } from '@rnmapbox/maps';
import Constants from 'expo-constants';
import { startRun, stopRun, useLiveRun, clearActiveRun, recoverActiveRun } from '../lib/location';
import { uploadRun } from '../lib/runs';
import { useAuth } from '../lib/auth';
import { pathDistanceMeters } from '../lib/distance';
import { userColorHex } from '../lib/colors';
import { useTheme } from '../lib/ui';
import { PrimaryButton, BebasNumber, CoinRow, Toast } from '../lib/ui/components';
import { pointInPolygon, bbox } from '../lib/geo';
import { supabase } from '../lib/supabase';

type RegionBBox = { minX: number; minY: number; maxX: number; maxY: number };
type RegionRow = { id: number; name: string; geom: GeoJSON.Polygon; bb: RegionBBox };

const PARCHMENT_STYLE =
  (Constants.expoConfig?.extra?.mapboxParchmentStyleUrl as string | undefined) ??
  'mapbox://styles/mapbox/outdoors-v12';

export default function Run({ navigation }: any) {
  const { session } = useAuth();
  const { palette } = useTheme();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const startedRef = useRef<number | null>(null);
  const points = useLiveRun(active);
  const visitedRegions = useRef<Set<number>>(new Set());
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [regions, setRegions] = useState<RegionRow[]>([]);

  // load regions for PIP check
  useEffect(() => {
    supabase.rpc('regions_as_geojson').then(({ data }) => {
      if (!data) return;
      setRegions(
        (data as Array<{ id: number; name: string; geojson: string }>).map((r) => {
          const geom = JSON.parse(r.geojson) as GeoJSON.Polygon;
          return { id: r.id, name: r.name, geom, bb: bbox(geom) };
        }),
      );
    });
  }, []);

  useEffect(() => {
    recoverActiveRun().then((r) => {
      if (r) {
        startedRef.current = r.startedAt;
        setActive(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  // check region entry on each new point
  useEffect(() => {
    if (!active || points.length === 0) return;
    const last = points[points.length - 1];
    for (const r of regions) {
      if (visitedRegions.current.has(r.id)) continue;
      // bbox pre-filter: skip ray-cast if point is outside the bounding box
      if (
        last.lng < r.bb.minX ||
        last.lng > r.bb.maxX ||
        last.lat < r.bb.minY ||
        last.lat > r.bb.maxY
      )
        continue;
      if (pointInPolygon(last.lng, last.lat, r.geom)) {
        visitedRegions.current.add(r.id);
        setToastMsg(`Entered ${r.name}!`);
        setToastVisible(true);
      }
    }
  }, [points, active, regions]);

  const distance = pathDistanceMeters(points.map((p) => ({ latitude: p.lat, longitude: p.lng })));
  const elapsedMs = active && startedRef.current ? Date.now() - startedRef.current : 0;

  const lineGeoJSON = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: points.map((p) => [p.lng, p.lat]) },
  };

  async function onStart() {
    setBusy(true);
    visitedRegions.current = new Set();
    const r = await startRun();
    setBusy(false);
    if (!r.ok) {
      setToastMsg(r.reason ?? 'Permission denied');
      setToastVisible(true);
      return;
    }
    startedRef.current = Date.now();
    setActive(true);
  }

  async function onStop() {
    if (!session) return;
    setBusy(true);
    const r = await stopRun();
    setActive(false);
    if (!r || r.points.length < 2) {
      await clearActiveRun();
      setBusy(false);
      setToastMsg('Run too short — no GPS points recorded.');
      setToastVisible(true);
      return;
    }
    const upload = await uploadRun({
      userId: session.user.id,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      points: r.points,
    });
    setBusy(false);
    await clearActiveRun();
    if ('error' in upload) {
      setToastMsg('Upload failed: ' + upload.error);
      setToastVisible(true);
      return;
    }
    navigation?.navigate?.('RunSummary', {
      distanceM: upload.distanceM,
      durationMs: r.endedAt - r.startedAt,
      points: Math.floor(upload.distanceM / 10),
      pointCount: r.points.length,
      coords: r.points.map((p) => [p.lng, p.lat] as [number, number]),
      userId: session.user.id,
    });
  }

  const polylineColor = session ? userColorHex(session.user.id) : palette.blue;

  return (
    <View style={styles.root}>
      <Toast message={toastMsg} visible={toastVisible} onHide={() => setToastVisible(false)} />

      <MapView style={styles.map} styleURL={PARCHMENT_STYLE}>
        <Camera followUserLocation followZoomLevel={16} />
        <UserLocation />
        {points.length >= 2 && (
          <ShapeSource id="run-path" shape={lineGeoJSON}>
            <LineLayer
              id="run-path-line"
              style={{
                lineColor: polylineColor,
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* HUD */}
      <View
        style={[
          styles.hudContainer,
          { backgroundColor: palette.cream, borderColor: palette.landEdge },
        ]}
      >
        <View style={styles.statRow}>
          <HudStat label="Distance" value={`${(distance / 1000).toFixed(2)}`} suffix=" KM" />
          <View style={[styles.divider, { backgroundColor: palette.landEdge }]} />
          <HudStat label="Time" value={fmtTime(elapsedMs)} />
          <View style={[styles.divider, { backgroundColor: palette.landEdge }]} />
          <HudStat label="Points" value={`${Math.floor(distance / 10)}`} />
        </View>

        {active && (
          <CoinRow
            points={Math.floor(distance / 10)}
            style={{ alignSelf: 'center', marginBottom: 8 }}
          />
        )}

        <PrimaryButton
          label={active ? 'Stop Run' : 'Start Run'}
          onPress={active ? onStop : onStart}
          loading={busy}
          danger={active}
        />
      </View>
    </View>
  );
}

function HudStat({ label, value, suffix = '' }: { label: string; value: string; suffix?: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.stat}>
      <BebasNumber value={value} suffix={suffix} size="badge" style={{ color: palette.ink }} />
      <Text
        style={{
          color: palette.parchmentMid,
          fontSize: 10,
          fontFamily: 'Inter',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  hudContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  stat: { alignItems: 'center', flex: 1 },
  divider: { width: 1, height: 36 },
});
