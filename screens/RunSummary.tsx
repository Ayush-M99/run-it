import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Svg, Polyline } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import Constants from 'expo-constants';
import { useTheme } from '../lib/ui';
import {
  BebasNumber,
  CoinRow,
  PrimaryButton,
  SecondaryButton,
  Surface,
} from '../lib/ui/components';

type Coord = [number, number]; // [lng, lat]

interface RunSummaryProps {
  route: {
    params: {
      distanceM: number;
      durationMs: number;
      points: number;
      pointCount: number;
      coords: Coord[];
      userId: string;
    };
  };
  navigation: any;
}

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const PARCHMENT_STYLE =
  (Constants.expoConfig?.extra?.mapboxParchmentStyleUrl as string | undefined) ??
  'mapbox://styles/mapbox/outdoors-v12';

const SNAP_W = 340;
const SNAP_H = 220;

function coordsToPoints(coords: Coord[], w: number, h: number): string {
  if (coords.length < 2) return '';
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const pad = 20;
  const rangeX = maxLng - minLng || 0.001;
  const rangeY = maxLat - minLat || 0.001;
  return coords
    .map((c) => {
      const x = pad + ((c[0] - minLng) / rangeX) * (w - pad * 2);
      const y = h - pad - ((c[1] - minLat) / rangeY) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function approximatePolylineLength(pointsStr: string): number {
  const pts = pointsStr.split(' ').map((p) => p.split(',').map(Number));
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

export default function RunSummary({ route, navigation }: RunSummaryProps) {
  const { distanceM, durationMs, points, pointCount, coords } = route.params;
  const { palette, radii } = useTheme();

  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareRef = useRef<ViewShot>(null);
  const progress = useSharedValue(0);
  const [svgPoints] = useState(() => coordsToPoints(coords, SNAP_W, SNAP_H));
  const totalLength = approximatePolylineLength(svgPoints);

  // take Mapbox snapshot
  useEffect(() => {
    if (coords.length < 2) return;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const spanLng = (maxLng - minLng) * 1.5 || 0.01;
    const spanLat = (maxLat - minLat) * 1.5 || 0.01;
    const zoom = Math.min(14, Math.log2(360 / Math.max(spanLng, spanLat)));

    Mapbox.snapshotManager
      .takeSnap({
        centerCoordinate: [centerLng, centerLat],
        zoomLevel: zoom,
        width: SNAP_W,
        height: SNAP_H,
        styleURL: PARCHMENT_STYLE,
        writeToDisk: true,
        withLogo: false,
      })
      .then((uri) => setSnapshot(uri))
      .catch(() => setSnapshotFailed(true))
      .finally(() => {
        // animate route draw whether or not the map snapshot succeeded
        progress.value = withTiming(totalLength, {
          duration: 1800,
          easing: Easing.out(Easing.cubic),
        });
      });
  }, [coords, progress, totalLength]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: totalLength - progress.value,
  }));

  async function handleShare() {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const uri = await (shareRef.current as any).capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      // share failed silently
    } finally {
      setSharing(false);
    }
  }

  const distKm = (distanceM / 1000).toFixed(2);
  const durationStr = fmtTime(durationMs);

  return (
    <View style={[styles.root, { backgroundColor: palette.parchment }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* close */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: palette.parchmentMid, fontFamily: 'Inter' }]}>
            ✕
          </Text>
        </TouchableOpacity>

        <Text style={[styles.kicker, { color: palette.parchmentMid }]}>Run complete</Text>
        <Text style={[styles.hero, { color: palette.ink, fontFamily: 'BebasNeue' }]}>
          RUN COMPLETE
        </Text>

        {/* map + route */}
        <Surface tilt={-1} style={{ marginBottom: 20 }}>
          <View style={styles.mapContainer}>
            {snapshot ? (
              <>
                <Image source={{ uri: snapshot }} style={styles.mapImage} resizeMode="cover" />
                <Svg
                  width={SNAP_W}
                  height={SNAP_H}
                  style={StyleSheet.absoluteFillObject}
                  viewBox={`0 0 ${SNAP_W} ${SNAP_H}`}
                >
                  <AnimatedPolyline
                    points={svgPoints}
                    fill="none"
                    stroke={palette.blue}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={totalLength}
                    animatedProps={animatedProps}
                  />
                </Svg>
              </>
            ) : snapshotFailed && svgPoints ? (
              // Fallback: animated SVG route on parchment when Mapbox snap unavailable
              <View style={[styles.mapPlaceholder, { backgroundColor: palette.landFill }]}>
                <Svg width={SNAP_W} height={SNAP_H} viewBox={`0 0 ${SNAP_W} ${SNAP_H}`}>
                  <AnimatedPolyline
                    points={svgPoints}
                    fill="none"
                    stroke={palette.blue}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={totalLength}
                    animatedProps={animatedProps}
                  />
                </Svg>
              </View>
            ) : (
              <View style={[styles.mapPlaceholder, { backgroundColor: palette.landFill }]}>
                <ActivityIndicator color={palette.blue} />
              </View>
            )}
          </View>
        </Surface>

        {/* big stats */}
        <View style={styles.statsRow}>
          <StatBlock label="Distance" value={distKm} suffix=" KM" color={palette.ink} animate />
          <View style={[styles.statDivider, { backgroundColor: palette.landEdge }]} />
          <StatBlock label="Time" value={durationStr} color={palette.ink} />
        </View>

        {/* points + coins */}
        <View
          style={[
            styles.pointsBlock,
            { backgroundColor: palette.landFill, borderRadius: radii.lg },
          ]}
        >
          <Text style={[styles.pointsLabel, { color: palette.parchmentMid }]}>Points earned</Text>
          <BebasNumber value={points} animate size="score" style={{ color: palette.blue }} />
          <CoinRow points={points} animate style={{ marginTop: 8 }} />
        </View>

        {/* gps info */}
        <Text style={[styles.gpsNote, { color: palette.parchmentMid }]}>
          {pointCount} GPS points recorded
        </Text>

        {/* actions */}
        <View style={styles.actions}>
          <PrimaryButton
            label={sharing ? 'Sharing…' : 'Share card'}
            onPress={handleShare}
            loading={sharing}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="View map"
            onPress={() => navigation.navigate('Map')}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>

      {/* off-screen share card — absolute to root, outside ScrollView so view-shot captures it */}
      <ViewShot ref={shareRef} style={styles.shareCard} options={{ format: 'png', quality: 1 }}>
        <View style={[styles.shareInner, { backgroundColor: palette.cream }]}>
          <Text style={[styles.shareWordmark, { color: palette.ink, fontFamily: 'BebasNeue' }]}>
            RUN-IT
          </Text>
          {snapshot && (
            <Image source={{ uri: snapshot }} style={styles.shareMap} resizeMode="cover" />
          )}
          <Text style={[styles.shareDistance, { color: palette.ink, fontFamily: 'BebasNeue' }]}>
            {distKm} KM · {durationStr} · {points} PTS
          </Text>
        </View>
      </ViewShot>
    </View>
  );
}

function StatBlock({
  label,
  value,
  suffix = '',
  color,
  animate = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color: string;
  animate?: boolean;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.statBlock}>
      <BebasNumber value={value} suffix={suffix} animate={animate} size="title" style={{ color }} />
      <Text style={[styles.statLabel, { color: palette.parchmentMid }]}>{label.toUpperCase()}</Text>
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
  scroll: { padding: 20, paddingBottom: 60 },
  closeBtn: { alignSelf: 'flex-end', padding: 8, marginBottom: 8 },
  closeText: { fontSize: 20 },
  kicker: { fontSize: 11, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1.5 },
  hero: { fontSize: 48, letterSpacing: 2, marginBottom: 20, marginTop: 4 },
  mapContainer: { width: SNAP_W, height: SNAP_H, overflow: 'hidden', borderRadius: 18 },
  mapImage: { width: SNAP_W, height: SNAP_H },
  mapPlaceholder: { width: SNAP_W, height: SNAP_H, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statBlock: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter',
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, height: 40 },
  pointsBlock: { padding: 16, alignItems: 'center', marginBottom: 12 },
  pointsLabel: {
    fontSize: 10,
    fontFamily: 'Inter',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  gpsNote: { fontSize: 11, fontFamily: 'Inter', textAlign: 'center', marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 10 },

  // off-screen share card
  shareCard: { position: 'absolute', left: -9999, width: 320, height: 480 },
  shareInner: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
  shareWordmark: { fontSize: 36, letterSpacing: 4 },
  shareMap: { width: 288, height: 180, borderRadius: 12 },
  shareDistance: { fontSize: 18, letterSpacing: 1 },
});
