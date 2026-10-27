import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME, APP_VERSION, CC_BY_SA_URL, PRIVACY_POLICY_URL, WIKIDATA_CC0_URL } from '@/core/config';
import { useAppStore, type ReelMotion } from '@/core/store';
import { confirmAction } from '@/ui/confirm';
import { fonts, radius, READING_MAX_WIDTH, space, useTheme } from '@/ui/theme';

const MOTION_OPTIONS: { id: ReelMotion; label: string; hint: string }[] = [
  { id: 'always', label: 'Spin', hint: 'The reel always spins.' },
  { id: 'system', label: 'System', hint: "Follows your device's Reduce Motion setting." },
  { id: 'reduced', label: 'Fade', hint: 'No spinning: the result fades in.' },
];

export default function SettingsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const hapticsEnabled = useAppStore((s) => s.hapticsEnabled);
  const setSoundEnabled = useAppStore((s) => s.setSoundEnabled);
  const setHapticsEnabled = useAppStore((s) => s.setHapticsEnabled);
  const reelMotion = useAppStore((s) => s.reelMotion);
  const setReelMotion = useAppStore((s) => s.setReelMotion);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const historyCount = useAppStore((s) => s.history.length);

  const confirmClear = () =>
    confirmAction('Clear history?', 'This removes every spin from History. Saved articles stay.', 'Clear history', clearHistory);

  return (
    <ScrollView
      style={{ backgroundColor: c.base }}
      contentContainerStyle={[styles.content, styles.reading, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 96 }]}
    >
      <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
        Settings
      </Text>

      <Group title="Spin">
        <ToggleRow icon="volume-high-outline" label="Sound" value={soundEnabled} onChange={setSoundEnabled} />
        <ToggleRow icon="phone-portrait-outline" label="Haptics" value={hapticsEnabled} onChange={setHapticsEnabled} />
        <View style={styles.motionRow}>
          <Text style={[styles.rowLabel, { color: c.ink }]}>Reel animation</Text>
          <View style={[styles.segment, { backgroundColor: c.surfaceAlt }]} accessibilityRole="radiogroup">
            {MOTION_OPTIONS.map((o) => {
              const active = o.id === reelMotion;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setReelMotion(o.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${o.label}. ${o.hint}`}
                  style={[styles.segmentItem, active && { backgroundColor: c.ink }]}
                >
                  <Text style={[styles.segmentText, { color: active ? c.base : c.ink }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.motionHint, { color: c.muted }]}>
            {MOTION_OPTIONS.find((o) => o.id === reelMotion)?.hint}
          </Text>
        </View>
      </Group>

      <Group title="Content">
        <Row icon="language-outline" label="Wikipedia language" value="English" />
        <Text style={[styles.footnote, { color: c.muted }]}>More languages are planned.</Text>
        <Row
          icon="trash-outline"
          label="Clear history"
          value={historyCount ? `${historyCount}` : undefined}
          onPress={historyCount ? confirmClear : undefined}
          danger
        />
      </Group>

      <Group title="About">
        <Text style={[styles.about, { color: c.ink }]}>
          {APP_NAME} picks random articles from English Wikipedia. Article text comes from Wikipedia and is available under the
          Creative Commons Attribution-ShareAlike 4.0 license. Topic lists are built from Wikidata, which is available under CC0.
        </Text>
        <Text style={[styles.about, { color: c.muted }]}>
          {APP_NAME} is an independent app and is not affiliated with or endorsed by the Wikimedia Foundation.
        </Text>
        <Row icon="document-text-outline" label="Wikipedia license (CC BY-SA 4.0)" onPress={() => Linking.openURL(CC_BY_SA_URL)} />
        <Row icon="document-outline" label="Wikidata license (CC0)" onPress={() => Linking.openURL(WIKIDATA_CC0_URL)} />
        <Row icon="shield-checkmark-outline" label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
        <Row icon="information-circle-outline" label="Version" value={APP_VERSION} />
      </Group>
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: c.muted }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>{children}</View>
    </View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function ToggleRow({ icon, label, value, onChange }: { icon: IconName; label: string; value: boolean; onChange(v: boolean): void }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={c.ink} />
      <Text style={[styles.rowLabel, { color: c.ink }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: c.ink }} />
    </View>
  );
}

function Row({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress?(): void; danger?: boolean }) {
  const { c } = useTheme();
  const color = danger ? c.danger : c.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={onPress || !danger ? color : c.muted} />
      <Text style={[styles.rowLabel, { color: onPress || !danger ? color : c.muted }]}>{label}</Text>
      {value ? <Text style={[styles.rowValue, { color: c.muted }]}>{value}</Text> : null}
      {onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, gap: space.xl },
  reading: { width: '100%', maxWidth: READING_MAX_WIDTH, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '800', fontFamily: fonts.display, letterSpacing: -0.5 },
  group: { gap: space.sm },
  groupTitle: { fontSize: 14, fontWeight: '600', marginLeft: space.xs },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  rowLabel: { flex: 1, fontSize: 16 },
  rowValue: { fontSize: 16 },
  footnote: { fontSize: 13, marginTop: -6, marginBottom: space.sm, marginLeft: 34 },
  about: { fontSize: 15, lineHeight: 22, paddingVertical: space.sm },
  motionRow: { paddingVertical: space.md, gap: space.sm },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 15, fontWeight: '600' },
  motionHint: { fontSize: 13 },
});
