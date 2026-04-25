import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Mapbox, { MapView, Camera, ShapeSource, LineLayer, UserLocation } from '@rnmapbox/maps';
import { startRun, stopRun, useLiveRun, clearActiveRun, recoverActiveRun } from '../lib/location';
import { uploadRun } from '../lib/runs';
import { useAuth } from '../lib/auth';
import { pathDistanceMeters } from '../lib/distance';

export default function Run() {
  const { session } = useAuth();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const startedRef = useRef<number | null>(null);
  const points = useLiveRun(active);

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

  const distance = pathDistanceMeters(points.map((p) => ({ latitude: p.lat, longitude: p.lng })));
  const elapsedMs = active && startedRef.current ? Date.now() - startedRef.current : 0;

  const lineGeoJSON = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: points.map((p) => [p.lng, p.lat]) },
  };

  async function onStart() {
    setBusy(true);
    const r = await startRun();
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Cannot start run', r.reason ?? 'Permission denied');
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
    if (!r) {
      setBusy(false);
      await clearActiveRun();
      return;
    }
    if (r.points.length < 2) {
      Alert.alert('Run too short', 'No GPS points were recorded.');
      await clearActiveRun();
      setBusy(false);
      return;
    }
    const upload = await uploadRun({
      userId: session.user.id,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      points: r.points,
    });
    setBusy(false);
    if ('error' in upload) {
      Alert.alert('Upload failed', upload.error);
      return;
    }
    await clearActiveRun();
    Alert.alert('Run saved', `Distance: ${(upload.distanceM / 1000).toFixed(2)} km`);
  }

  return (
    <View style={styles.root}>
      <MapView style={styles.map} styleURL={Mapbox.StyleURL.Dark}>
        <Camera followUserLocation followZoomLevel={16} />
        <UserLocation />
        {points.length >= 2 && (
          <ShapeSource id="run-path" shape={lineGeoJSON}>
            <LineLayer
              id="run-path-line"
              style={{ lineColor: '#3aa0ff', lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
        )}
      </MapView>

      <View style={styles.hud}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{(distance / 1000).toFixed(2)} km</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{fmtTime(elapsedMs)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Points</Text>
            <Text style={styles.statValue}>{Math.floor(distance / 10)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.btn, active ? styles.btnStop : styles.btnStart]}
          onPress={active ? onStop : onStart}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{active ? 'Stop run' : 'Start run'}</Text>
          )}
        </TouchableOpacity>
      </View>
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
  root: { flex: 1, backgroundColor: '#0b1a2b' },
  map: { flex: 1 },
  hud: { position: 'absolute', left: 16, right: 16, bottom: 32, backgroundColor: 'rgba(11,26,43,0.92)', borderRadius: 16, padding: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statLabel: { color: '#7790aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '600', marginTop: 2 },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  btnStart: { backgroundColor: '#3aa0ff' },
  btnStop: { backgroundColor: '#ff5c5c' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
