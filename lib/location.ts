// Background location tracking via expo-task-manager + AsyncStorage crash buffer.
//
// State machine:
//   idle      → startRun() → running
//   running   → stopRun()  → uploading (background task unregistered, buffer flushed to Supabase)
//   uploading → idle on success (buffer cleared)
//
// Filters applied per point:
//   - drop accuracy > 50 m
//   - drop instantaneous speed > 20 km/h (5.56 m/s) vs the prior accepted point

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { haversine } from './distance';

export const BG_TASK = 'run-it-bg-location';
export const BUFFER_KEY = 'run-it.bg-buffer.v1';
export const ACTIVE_RUN_KEY = 'run-it.active-run.v1';

export type RunPoint = {
  ts: number; // ms
  lat: number;
  lng: number;
  acc: number;
  speed: number; // m/s, may be -1 on iOS
};

export type ActiveRun = { startedAt: number };

const ACCURACY_MAX_M = 50;
const MAX_SPEED_MS = 5.56; // 20 km/h

async function appendPoints(newPoints: RunPoint[]) {
  if (newPoints.length === 0) return;
  const raw = await AsyncStorage.getItem(BUFFER_KEY);
  const buf: RunPoint[] = raw ? JSON.parse(raw) : [];
  let last = buf[buf.length - 1];
  for (const p of newPoints) {
    if (p.acc > ACCURACY_MAX_M) continue;
    if (last) {
      const dt = (p.ts - last.ts) / 1000;
      if (dt < 1) continue; // throttle
      const d = haversine(
        { latitude: last.lat, longitude: last.lng },
        { latitude: p.lat, longitude: p.lng },
      );
      if (d / dt > MAX_SPEED_MS) continue;
    }
    buf.push(p);
    last = p;
  }
  await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buf));
}

// Register the background task once at module load. expo-task-manager requires
// this to happen at the top level of a module that's imported on app start.
if (!TaskManager.isTaskDefined(BG_TASK)) {
  TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[bg-location] error', error);
      return;
    }
    const locs = (data as { locations?: Location.LocationObject[] })?.locations;
    if (!locs?.length) return;
    const points: RunPoint[] = locs.map((l) => ({
      ts: l.timestamp,
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      acc: l.coords.accuracy ?? 9999,
      speed: l.coords.speed ?? -1,
    }));
    await appendPoints(points);
  });
}

export async function ensurePermissions(): Promise<{ granted: boolean; reason?: string }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { granted: false, reason: 'Foreground location denied' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return { granted: false, reason: 'Background location denied' };
  return { granted: true };
}

export async function startRun(): Promise<{ ok: boolean; reason?: string }> {
  const perms = await ensurePermissions();
  if (!perms.granted) return { ok: false, reason: perms.reason };

  await AsyncStorage.multiRemove([BUFFER_KEY]);
  const startedAt = Date.now();
  await AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify({ startedAt } satisfies ActiveRun));

  await Location.startLocationUpdatesAsync(BG_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Run-It is tracking your run',
      notificationBody: 'Tap to return to the app.',
      notificationColor: '#0b1a2b',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
  });
  return { ok: true };
}

export async function stopRun(): Promise<{
  points: RunPoint[];
  startedAt: number;
  endedAt: number;
} | null> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
  if (isRunning) await Location.stopLocationUpdatesAsync(BG_TASK);

  const activeRaw = await AsyncStorage.getItem(ACTIVE_RUN_KEY);
  const bufRaw = await AsyncStorage.getItem(BUFFER_KEY);
  if (!activeRaw) return null;
  const active: ActiveRun = JSON.parse(activeRaw);
  const points: RunPoint[] = bufRaw ? JSON.parse(bufRaw) : [];
  return { points, startedAt: active.startedAt, endedAt: Date.now() };
}

export async function clearActiveRun() {
  await AsyncStorage.multiRemove([BUFFER_KEY, ACTIVE_RUN_KEY]);
}

export async function recoverActiveRun(): Promise<ActiveRun | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_RUN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// React hook: poll the buffer at 1Hz so the UI can render the live polyline + distance.
export function useLiveRun(active: boolean): RunPoint[] {
  const [points, setPoints] = useState<RunPoint[]>([]);
  useEffect(() => {
    if (!active) {
      setPoints([]);
      return;
    }
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const raw = await AsyncStorage.getItem(BUFFER_KEY);
      setPoints(raw ? JSON.parse(raw) : []);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [active]);
  return points;
}
