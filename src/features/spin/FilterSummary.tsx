import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCountry } from '@/core/countries';
import { ERAS, OBSCURITY_LEVELS } from '@/core/filters';
import { radius, useTheme } from '@/ui/theme';
import type { FilteredPool } from './useFilteredPool';

export function describeFilters(pool: FilteredPool): string {
  const { category, subcategory, filters } = pool;
  const parts: string[] = [];
  if (subcategory) parts.push(subcategory.label);
  if (category.filters.includes('country') && filters.country !== null) {
    const country = getCountry(filters.country);
    if (country) parts.push(`${country.flag} ${country.name}`);
  }
  if (category.filters.includes('era') && filters.era) {
    const era = ERAS.find((e) => e.id === filters.era);
    if (era) parts.push(era.label);
  }
  if (category.filters.includes('obscurity')) {
    const level = OBSCURITY_LEVELS.find((o) => o.id === filters.obscurity);
    if (level) parts.push(level.label);
  }
  return parts.join(' · ');
}

export function FilterSummary({ pool, onPress, disabled }: { pool: FilteredPool; onPress(): void; disabled?: boolean }) {
  const { c } = useTheme();
  const text = describeFilters(pool);
  const count = pool.entries.length;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Filters: ${text}. ${count} articles match.`}
      accessibilityHint="Opens the filters"
      style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.hairline, opacity: pressed ? 0.75 : 1 }]}
    >
      <Ionicons name="options-outline" size={20} color={c.ink} />
      <View style={styles.texts}>
        <Text style={[styles.summary, { color: c.ink }]} numberOfLines={2}>
          {text}
        </Text>
        <Text style={[styles.count, { color: c.muted }]}>
          {count.toLocaleString('en-US')} articles in the reel
          {pool.liveAdded > 0 ? ` · ${pool.liveAdded.toLocaleString('en-US')} found online` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  texts: { flex: 1 },
  summary: { fontSize: 15, fontWeight: '600' },
  count: { fontSize: 13, marginTop: 2 },
});
