import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategory } from '@/core/categories';
import type { StoredArticle } from '@/core/store';
import { fonts, radius, READING_MAX_WIDTH, space, useTheme } from '@/ui/theme';

export interface ListItem extends StoredArticle {
  key: string;
  /** Secondary line, e.g. a relative date. */
  meta: string;
}

interface Props {
  title: string;
  items: ListItem[];
  onDelete(item: ListItem): void;
  empty: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string };
  headerAction?: ReactNode;
}

/** Searchable list with swipe-to-delete, shared by Saved and History. */
export function ArticleList({ title, items, onDelete, empty, headerAction }: Props) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const open = (item: ListItem) =>
    router.push({ pathname: '/article', params: { title: item.title, source: title.toLowerCase() } });

  return (
    <View style={[styles.root, styles.reading, { backgroundColor: c.base, paddingTop: insets.top + space.md }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
          {title}
        </Text>
        {headerAction}
      </View>

      {items.length > 0 ? (
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${title.toLowerCase()}`}
            placeholderTextColor={c.muted}
            style={[styles.searchInput, { color: c.ink }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel={`Search ${title.toLowerCase()}`}
          />
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.key}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={query ? 'search' : empty.icon} size={36} color={c.muted} />
            <Text style={[styles.emptyTitle, { color: c.ink }]}>{query ? 'Nothing matches that search' : empty.title}</Text>
            {query ? null : <Text style={[styles.emptyBody, { color: c.muted }]}>{empty.body}</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const category = getCategory(item.categoryId);
          const accent = category.accent[scheme];
          return (
            <ReanimatedSwipeable
              friction={2}
              rightThreshold={60}
              renderRightActions={() => (
                <Pressable
                  onPress={() => onDelete(item)}
                  style={[styles.delete, { backgroundColor: c.danger }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                >
                  <Ionicons name="trash" size={22} color="#FFFFFF" />
                </Pressable>
              )}
            >
              <Pressable
                onPress={() => open(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.description ?? ''}. ${item.meta}`}
                accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
                onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete(item)}
                style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.hairline, opacity: pressed ? 0.8 : 1 }]}
              >
                {item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={[styles.thumb, { backgroundColor: c.surfaceAlt }]} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: c.surfaceAlt }]}>
                    <Ionicons name={category.icon} size={22} color={accent} />
                  </View>
                )}
                <View style={styles.texts}>
                  <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={[styles.rowDesc, { color: c.muted }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: accent }]}>{item.meta}</Text>
                </View>
              </Pressable>
            </ReanimatedSwipeable>
          );
        }}
      />
    </View>
  );
}

export function relativeTime(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reading: { width: '100%', maxWidth: READING_MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, marginBottom: space.md },
  title: { fontSize: 32, fontWeight: '800', fontFamily: fonts.display, letterSpacing: -0.5 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  list: { paddingHorizontal: space.lg, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700', fontFamily: fonts.display },
  rowDesc: { fontSize: 14 },
  meta: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  delete: { width: 76, marginLeft: space.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
