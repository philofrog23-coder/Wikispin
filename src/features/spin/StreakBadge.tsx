import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { visibleStreak } from '@/core/streak';
import { useAppStore } from '@/core/store';
import { useTheme } from '@/ui/theme';

/** Subtle counter: daily streak and total articles discovered. */
export function StreakBadge() {
  const { c } = useTheme();
  const streak = useAppStore((s) => s.streak);
  const days = visibleStreak(streak, new Date());
  if (streak.discovered === 0) return null;
  const label = `${days} day streak, ${streak.discovered} articles discovered`;
  return (
    <View style={[styles.badge, { backgroundColor: c.surface, borderColor: c.hairline }]} accessible accessibilityLabel={label}>
      <Ionicons name="flame" size={14} color={days > 0 ? c.brass : c.muted} />
      <Text style={[styles.text, { color: c.ink }]}>{days}</Text>
      <View style={[styles.divider, { backgroundColor: c.hairline }]} />
      <Ionicons name="book-outline" size={14} color={c.muted} />
      <Text style={[styles.text, { color: c.ink }]}>{streak.discovered}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { width: 1, height: 14, marginHorizontal: 3 },
});
