import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { userColorHex } from '../lib/colors';
import { useTheme } from '../lib/ui';
import { Surface, BebasNumber, SecondaryButton } from '../lib/ui/components';

type Stats = {
  displayName: string;
  totalRuns: number;
  totalDistanceM: number;
  regionsWon: number;
  regionsLeadingToday: number;
};

type RunRow = { id: string; started_at: string; distance_m: number };

export default function Profile() {
  const { session, signOut } = useAuth();
  const { palette, radii } = useTheme();
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
        supabase
          .from('daily_region_winners')
          .select('region_id', { count: 'exact', head: true })
          .eq('user_id', uid),
        countLeadingRegions(uid, today),
        supabase
          .from('runs')
          .select('id,started_at,distance_m')
          .eq('user_id', uid)
          .order('started_at', { ascending: false })
          .limit(5),
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

  const avatarColor = userColorHex(session.user.id);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.parchment }]}
      contentContainerStyle={{ padding: 24 }}
    >
      {/* avatar */}
      <View style={styles.header}>
        <View
          style={[styles.avatar, { backgroundColor: avatarColor, borderColor: palette.landEdge }]}
        >
          <Text style={[styles.avatarInitial, { color: '#fff', fontFamily: 'BebasNeue' }]}>
            {(stats?.displayName ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: palette.ink, fontFamily: 'BebasNeue' }]}>
          {stats?.displayName ?? '…'}
        </Text>
        <Text style={[styles.email, { color: palette.parchmentMid }]}>{session.user.email}</Text>
      </View>

      {/* stats */}
      <Surface style={{ marginBottom: 16 }}>
        <View style={styles.statsRow}>
          <StatBlock label="Runs" value={stats?.totalRuns ?? 0} />
          <View style={[styles.divider, { backgroundColor: palette.landEdge }]} />
          <StatBlock label="Total km" value={((stats?.totalDistanceM ?? 0) / 1000).toFixed(1)} />
          <View style={[styles.divider, { backgroundColor: palette.landEdge }]} />
          <StatBlock label="Won" value={stats?.regionsWon ?? 0} />
        </View>
      </Surface>

      {/* leading callout */}
      <View
        style={[
          styles.callout,
          { backgroundColor: `${avatarColor}22`, borderColor: avatarColor, borderRadius: radii.md },
        ]}
      >
        <Text style={[styles.calloutLabel, { color: palette.parchmentMid }]}>
          Leading right now
        </Text>
        <Text style={[styles.calloutValue, { color: palette.ink, fontFamily: 'BebasNeue' }]}>
          {stats?.regionsLeadingToday ?? 0}{' '}
          {(stats?.regionsLeadingToday ?? 0) === 1 ? 'region' : 'regions'}
        </Text>
      </View>

      {/* recent runs */}
      <Text style={[styles.sectionLabel, { color: palette.parchmentMid }]}>Recent runs</Text>
      {recent.length === 0 ? (
        <Text style={[styles.empty, { color: palette.parchmentMid }]}>No runs yet.</Text>
      ) : (
        <Surface style={{ overflow: 'hidden', marginBottom: 24 }}>
          {recent.map((r, i) => (
            <View
              key={r.id}
              style={[
                styles.runRow,
                {
                  borderBottomColor: palette.landEdge,
                  borderBottomWidth: i < recent.length - 1 ? 1 : 0,
                },
              ]}
            >
              <Text style={[styles.runDate, { color: palette.ink }]}>
                {new Date(r.started_at).toLocaleString()}
              </Text>
              <Text style={[styles.runDist, { color: palette.blue, fontFamily: 'BebasNeue' }]}>
                {(Number(r.distance_m) / 1000).toFixed(2)} KM
              </Text>
            </View>
          ))}
        </Surface>
      )}

      <SecondaryButton label="Sign out" onPress={signOut} />
    </ScrollView>
  );
}

function StatBlock({ label, value }: { label: string; value: number | string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.statBlock}>
      <BebasNumber value={value} size="score" style={{ color: palette.blue }} />
      <Text style={[styles.statLabel, { color: palette.parchmentMid }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

async function countLeadingRegions(userId: string, today: string): Promise<number> {
  const { data, error } = await supabase
    .from('region_scores')
    .select('region_id,user_id,points')
    .eq('date', today)
    .order('points', { ascending: false });
  if (error || !data) return 0;
  const topByRegion = new Map<number, string>();
  for (const r of data) if (!topByRegion.has(r.region_id)) topByRegion.set(r.region_id, r.user_id);
  let count = 0;
  for (const uid of topByRegion.values()) if (uid === userId) count++;
  return count;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarInitial: { fontSize: 36, lineHeight: 40 },
  name: { fontSize: 32, letterSpacing: 1 },
  email: { fontFamily: 'Inter', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', padding: 12 },
  statBlock: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  divider: { width: 1, marginVertical: 4 },
  callout: { padding: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1.5 },
  calloutLabel: {
    fontSize: 10,
    fontFamily: 'Inter',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  calloutValue: { fontSize: 28, letterSpacing: 1, marginTop: 4 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  empty: { fontFamily: 'Inter', fontSize: 14, marginBottom: 24 },
  runRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  runDate: { fontFamily: 'Inter', fontSize: 13 },
  runDist: { fontSize: 18 },
});
