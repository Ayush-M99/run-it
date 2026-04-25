import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { userColorHex } from '../lib/colors';
import { useAuth } from '../lib/auth';

type Row = {
  user_id: string;
  display_name: string;
  points: number;
  distance_m: number;
};

export default function Leaderboard({ regionId, regionName }: { regionId: number; regionName: string }) {
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    const { data, error } = await supabase
      .from('region_scores')
      .select('user_id,points,distance_m,profiles!inner(display_name)')
      .eq('region_id', regionId)
      .eq('date', today)
      .order('points', { ascending: false })
      .limit(20);
    if (error) {
      console.warn(error.message);
      setLoading(false);
      return;
    }
    const next: Row[] = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      display_name: r.profiles?.display_name ?? 'unknown',
      points: r.points,
      distance_m: r.distance_m,
    }));
    setRows(next);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`region_scores:${regionId}:${today}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'region_scores',
          filter: `region_id=eq.${regionId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [regionId]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{regionName}</Text>
      <Text style={styles.subtitle}>Today's leaderboard</Text>

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No runs in this region today. Be the first.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.user_id}
          renderItem={({ item, index }) => {
            const isMe = !!session && item.user_id === session.user.id;
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={[styles.dot, { backgroundColor: userColorHex(item.user_id) }]} />
                <Text style={styles.name}>{item.display_name}{isMe ? ' (you)' : ''}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.points}>{item.points} pts</Text>
                  <Text style={styles.distance}>{(item.distance_m / 1000).toFixed(2)} km</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1a2b', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#7790aa', fontSize: 13, marginTop: 2, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#16263a' },
  rowMe: { backgroundColor: 'rgba(58,160,255,0.1)' },
  rank: { color: '#7790aa', width: 24, fontSize: 14, fontWeight: '600' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: '#fff', flex: 1, fontSize: 15 },
  points: { color: '#3aa0ff', fontSize: 15, fontWeight: '600' },
  distance: { color: '#7790aa', fontSize: 11 },
  empty: { color: '#7790aa', textAlign: 'center', marginTop: 32 },
});
