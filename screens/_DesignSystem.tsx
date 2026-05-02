import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/ui';
import {
  Surface,
  PlayerToken,
  CoinRow,
  CountdownBadge,
  BebasNumber,
  ScoreboardRow,
  PrimaryButton,
  SecondaryButton,
  Toast,
} from '../lib/ui/components';

const FAKE_UID = '550e8400-e29b-41d4-a716-446655440000';
const FAKE_UID2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export default function DesignSystem() {
  const { palette } = useTheme();
  const [toastVisible, setToastVisible] = useState(false);

  if (!__DEV__) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.parchment }}
      contentContainerStyle={styles.container}
    >
      <Toast
        message="Claimed Bushwick! +120 pts"
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />

      <Section title="Bebas Numbers">
        <BebasNumber value={3.42} suffix=" KM" size="hero" style={{ color: palette.ink }} />
        <BebasNumber value={342} animate size="score" style={{ color: palette.blue }} />
        <BebasNumber value="18:42" size="badge" style={{ color: palette.parchmentInk }} />
      </Section>

      <Section title="Player Tokens">
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <PlayerToken userId={FAKE_UID} label="Sam" size="lg" />
          <PlayerToken userId={FAKE_UID2} label="Bex" size="md" />
          <PlayerToken userId={FAKE_UID} label="Cam" size="sm" pulse={false} />
        </View>
      </Section>

      <Section title="Coin Row">
        <CoinRow points={342} animate />
        <CoinRow points={50} />
        <CoinRow points={0} />
      </Section>

      <Section title="Countdown Badge">
        <CountdownBadge />
      </Section>

      <Section title="Scoreboard Rows">
        <Surface style={{ overflow: 'hidden' }}>
          <ScoreboardRow
            rank={1}
            userId={FAKE_UID}
            displayName="sam"
            points={1240}
            distanceM={4200}
            isMe={false}
          />
          <ScoreboardRow
            rank={2}
            userId={FAKE_UID2}
            displayName="you"
            points={980}
            distanceM={3300}
            isMe
            flash
          />
          <ScoreboardRow
            rank={3}
            userId={FAKE_UID}
            displayName="alex"
            points={720}
            distanceM={2400}
            isMe={false}
          />
        </Surface>
      </Section>

      <Section title="Buttons">
        <PrimaryButton label="Start Run" onPress={() => setToastVisible(true)} />
        <SecondaryButton label="Dismiss" onPress={() => {}} />
        <PrimaryButton label="Stop Run" onPress={() => {}} danger />
      </Section>

      <Section title="Surface">
        <Surface tilt={-1} style={{ padding: 16 }}>
          <Text style={{ fontFamily: 'BebasNeue', fontSize: 24, color: palette.ink }}>
            GREENWICH VILLAGE
          </Text>
          <Text
            style={{ fontFamily: 'Inter', fontSize: 13, color: palette.parchmentMid, marginTop: 4 }}
          >
            Claimed by sam · 1240 pts
          </Text>
        </Surface>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.parchmentMid }]}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8, paddingBottom: 80 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionContent: { gap: 12 },
});
