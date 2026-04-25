import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { userColorHex } from '../lib/colors';

type Stats = {
  displayName: string;
  totalRuns: number;
  totalDistanceM: number;
  regionsWon: number;
  regionsLeadingToday: number;
};

type RunRow = {
  id: string;
  started_at: string;
  distance_m: number;
};

export default function Profile() {
  const { session, signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RunRow[]>([]);

  useEffect(() => {
    if (!session) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const uid = session.user.id;
      const [profile, runs, wins, leadingToday, recentRuns] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('user_id', uid).single(),
        supabase.from('runs').select('distance_m', { count: 'exact' }).eq('user_id', uid),
        supabase.from('daily_region_winners').select('region_id', { count: 'exact', head: true }).eq('user_id', uid),
        countLeadingRegions(uid, today),
        supabase.from('runs').select('id,started_at,distance_m').eq('user_id', uid).order('started_at', { ascending: false }).limit(5),
      ]);
      const totalDist = (runs.data ?? []).reduce((sum, r) => sum + Number(r.distance_m ?? 0), 0);
      setStats({
        displayName: profile.data?.display_name ?? session.user.email ?? 'you',
        totalRuns: runs.count ?? 0,
        totalDistanceM: totalDist,
        regionsWon: wins.count ?? 0,
        regionsLeadingToday: leadingToday,
      });
      setRecent((recentRuns.data ?? []) as RunRow[]);
    })();
  }, [session]);

  if (!session) return null;
  if (!stats) return <View style={styles.root}><ActivityIndicator color="#fff" style={{ marginTop: 64 }} /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 24 }}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: userColorHex(session.user.id) }]} />
        <Text style={styles.name}>{stats.displayName}</Text>
        <Text style={styles.email}>{session.user.email}</Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat label="Runs" value={String(stats.totalRuns)} />
        <Stat label="Total km" value={(stats.totalDistanceM / 1000).toFixed(1)} />
        <Stat label="Regions won" value={String(stats.regionsWon)} />
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutLabel}>Leading right now</Text>
        <Text style={styles.calloutValue}>
          {stats.regionsLeadingToday} {stats.regionsLeadingToday === 1 ? 'region' : 'regions'} today
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Recent runs</Text>
      {recent.length === 0 ? (
        <Text style={styles.empty}>No runs yet. Hit the Run tab and start one.</Text>
      ) : (
        recent.map((r) => (
          <View key={r.id} style={styles.runRow}>
            <Text style={styles.runDate}>{new Date(r.started_at).toLocaleString()}</Text>
            <Text style={styles.runDist}>{(Number(r.distance_m) / 1000).toFixed(2)} km</Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

async function countLeadingRegions(userId: string, today: string): Promise<number> {
  // For each region with any score today, find the top scorer; count where it's me.
  const { data, error } = await supabase
    .from('region_scores')
    .select('region_id,user_id,points')
    .eq('date', today)
    .order('points', { ascending: false });
  if (error || !data) return 0;
  const topByRegion = new Map<number, string>();
  for (const r of data) {
    if (!topByRegion.has(r.region_id)) topByRegion.set(r.region_id, r.user_id);
  }
  let count = 0;
  for (const uid of topByRegion.values()) if (uid === userId) count++;
  return count;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1a2b' },
  header: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  email: { color: '#7790aa', fontSize: 13, marginTop: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  stat: { alignItems: 'center' },
  statValue: { color: '#3aa0ff', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#7790aa', fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  callout: { backgroundColor: '#16263a', borderRadius: 10, padding: 14, marginBottom: 24, alignItems: 'center' },
  calloutLabel: { color: '#7790aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  calloutValue: { color: '#ffd84a', fontSize: 18, fontWeight: '600', marginTop: 4 },
  sectionLabel: { color: '#7790aa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  runRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#16263a' },
  runDate: { color: '#fff', fontSize: 14 },
  runDist: { color: '#3aa0ff', fontSize: 14, fontWeight: '600' },
  empty: { color: '#7790aa', textAlign: 'center', marginTop: 12 },
  signOut: { backgroundColor: '#16263a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 32 },
  signOutText: { color: '#ff8b8b', fontSize: 15, fontWeight: '600' },
});
