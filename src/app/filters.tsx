import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countriesIn } from '@/core/countries';
import { applyHardFilters, ERAS } from '@/core/filters';
import { useAppStore } from '@/core/store';
import { ObscuritySlider } from '@/features/filters/ObscuritySlider';
import { useFilteredPool } from '@/features/spin/useFilteredPool';
import { Button } from '@/ui/Button';
import { fonts, radius, READING_MAX_WIDTH, space, useTheme } from '@/ui/theme';

const TOP_COUNTRIES = 12;

export default function FiltersSheet() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const pool = useFilteredPool();
  const { category, subcategory, filters } = pool;
  const accent = category.accent[scheme];
  const supports = new Set(category.filters);

  const setSubcategory = useAppStore((s) => s.setSubcategory);
  const setCountry = useAppStore((s) => s.setCountry);
  const setEra = useAppStore((s) => s.setEra);
  const setObscurity = useAppStore((s) => s.setObscurity);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const [query, setQuery] = useState('');

  // Countries present in the subcategory once the era filter is applied, so counts stay honest.
  const countries = useMemo(
    () => countriesIn(applyHardFilters(pool.all, { ...filters, country: null, obscurity: 'balanced' })),
    [pool.all, filters],
  );
  const visibleCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return countries.filter((x) => x.name.toLowerCase().includes(q)).slice(0, 60);
    const top = [...countries].sort((a, b) => b.count - a.count).slice(0, TOP_COUNTRIES);
    const selected = countries.find((x) => x.id === filters.country);
    if (selected && !top.includes(selected)) top.unshift(selected);
    return top;
  }, [countries, query, filters.country]);

  return (
    <View style={[styles.root, styles.reading, { backgroundColor: c.base }]}>
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
          {category.label} filters
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10} style={styles.done}>
          <Text style={[styles.doneText, { color: accent }]}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <Section title="Topic">
          <View style={styles.wrap}>
            {category.subcategories.map((sub) => (
              <Chip key={sub.id} label={sub.label} active={sub.id === subcategory?.id} accent={accent} onPress={() => setSubcategory(category.id, sub.id)} />
            ))}
          </View>
        </Section>

        {supports.has('country') ? (
          <Section title={category.countryMeaning ?? 'Country'}>
            <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.hairline }]}>
              <Ionicons name="search" size={18} color={c.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${countries.length} countries`}
                placeholderTextColor={c.muted}
                style={[styles.searchInput, { color: c.ink }]}
                autoCorrect={false}
                clearButtonMode="while-editing"
                accessibilityLabel="Search countries"
              />
            </View>
            <View style={styles.wrap}>
              <Chip label="Any country" active={filters.country === null} accent={accent} onPress={() => setCountry(null)} />
              {visibleCountries.map((x) => (
                <Chip
                  key={x.id}
                  label={`${x.flag} ${x.name}`}
                  detail={x.count.toLocaleString('en-US')}
                  active={x.id === filters.country}
                  accent={accent}
                  onPress={() => setCountry(x.id === filters.country ? null : x.id)}
                />
              ))}
            </View>
            {!query && countries.length > TOP_COUNTRIES ? (
              <Text style={[styles.note, { color: c.muted }]}>Showing the most common. Search to find any other.</Text>
            ) : null}
          </Section>
        ) : null}

        {supports.has('era') ? (
          <Section title={category.yearMeaning === 'born' ? 'Born in' : 'Started in'}>
            <View style={styles.wrap}>
              <Chip label="Any time" active={filters.era === null} accent={accent} onPress={() => setEra(null)} />
              {ERAS.map((era) => (
                <Chip key={era.id} label={era.label} active={era.id === filters.era} accent={accent} onPress={() => setEra(era.id === filters.era ? null : era.id)} />
              ))}
            </View>
          </Section>
        ) : null}

        {supports.has('obscurity') ? (
          <Section title="How famous">
            <ObscuritySlider value={filters.obscurity} onChange={setObscurity} accent={accent} />
          </Section>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.hairline, paddingBottom: insets.bottom + space.md }]}>
        <Text style={[styles.count, { color: c.ink }]} accessibilityLiveRegion="polite">
          {pool.entries.length === 0 ? 'No articles match' : `${pool.entries.length.toLocaleString('en-US')} articles match`}
        </Text>
        <View style={styles.footerButtons}>
          <Button label="Reset filters" variant="secondary" onPress={resetFilters} />
          <Button label="Show reel" color={accent} onPress={() => router.back()} style={styles.flex} />
        </View>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Chip({ label, detail, active, accent, onPress }: { label: string; detail?: string; active: boolean; accent: string; onPress(): void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? accent : c.surface, borderColor: active ? accent : c.hairline, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? c.onAccent : c.ink }]}>{label}</Text>
      {detail ? <Text style={[styles.chipDetail, { color: active ? c.onAccent : c.muted }]}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reading: { width: '100%', maxWidth: READING_MAX_WIDTH, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '800', fontFamily: fonts.display },
  done: { minHeight: 44, justifyContent: 'center' },
  doneText: { fontSize: 17, fontWeight: '700' },
  content: { padding: space.lg, gap: space.xl },
  section: { gap: space.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', fontFamily: fonts.display },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 15, fontWeight: '600' },
  chipDetail: { fontSize: 13, fontVariant: ['tabular-nums'] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  note: { fontSize: 13 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  count: { fontSize: 15, fontWeight: '700' },
  footerButtons: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
