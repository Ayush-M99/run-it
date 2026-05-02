import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/ui';
import { Surface, ScoreboardRow, CountdownBadge } from '../lib/ui/components';

type Row = {
  user_id: string;
  display_name: string;
  points: number;
  distance_m: number;
};

export default function Leaderboard({
  regionId,
  regionName,
}: {
  regionId: number;
  regionName: string;
}) {
  const { session } = useAuth();
  const { palette } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const flashedRef = useRef<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(
    async (updatedUserId?: string) => {
      const { data, error } = await supabase
        .from('region_scores')
        .select('user_id,points,distance_m,profiles!inner(display_name)')
        .eq('region_id', regionId)
        .eq('date', today)
        .order('points', { ascending: false })
        .limit(20);
      if (error) {
        setLoading(false);
        return;
      }
      type RawRow = {
        user_id: string;
        points: number;
        distance_m: number;
        profiles: { display_name: string };
      };
      const next: Row[] = ((data ?? []) as unknown as RawRow[]).map((r) => ({
        user_id: r.user_id,
        display_name: r.profiles?.display_name ?? 'unknown',
        points: r.points,
        distance_m: r.distance_m,
      }));
      setRows(next);
      setLoading(false);
      if (updatedUserId) {
        setFlashId(updatedUserId);
        flashedRef.current = updatedUserId;
        setTimeout(() => setFlashId(null), 700);
      }
    },
    [regionId, today],
  );

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
        (payload) => load((payload.new as any)?.user_id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, regionId, today]);

  return (
    <View style={[styles.root, { backgroundColor: palette.parchment }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.kicker, { color: palette.parchmentMid }]}>Today's leaderboard</Text>
        <Text style={[styles.title, { color: palette.ink, fontFamily: 'BebasNeue' }]}>
          {regionName}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={[styles.loading, { color: palette.parchmentMid }]}>Loading…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: palette.parchmentMid }]}>
            No runs in this region today. Be the first.
          </Text>
        </View>
      ) : (
        <Surface style={{ marginHorizontal: 16, marginBottom: 16, overflow: 'hidden' }}>
          <FlatList
            data={rows}
            keyExtractor={(r) => r.user_id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <ScoreboardRow
                rank={index + 1}
                userId={item.user_id}
                displayName={item.display_name}
                points={item.points}
                distanceM={item.distance_m}
                isMe={!!session && item.user_id === session.user.id}
                flash={flashId === item.user_id}
              />
            )}
          />
        </Surface>
      )}

      <View style={styles.countdown}>
        <CountdownBadge />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleBlock: { padding: 20, paddingBottom: 12 },
  kicker: { fontSize: 10, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1.5 },
  title: { fontSize: 36, letterSpacing: 1, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { fontFamily: 'Inter', fontSize: 14 },
  empty: { fontFamily: 'Inter', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  countdown: { padding: 20, alignItems: 'center' },
});
