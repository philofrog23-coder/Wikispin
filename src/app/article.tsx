import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategory } from '@/core/categories';
import { useServices } from '@/core/services';
import { toStored, useAppStore, type StoredArticle } from '@/core/store';
import { WikiError, type WikiErrorKind } from '@/core/wiki/types';
import { ResultCard } from '@/features/spin/ResultCard';
import { READING_MAX_WIDTH, space, useTheme } from '@/ui/theme';

/** Re-opens a card from Saved or History. Uses the stored copy and refreshes it if possible. */
export default function ArticleScreen() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { articles } = useServices();
  const { title } = useLocalSearchParams<{ title: string }>();
  const stored = useAppStore(
    (s) => s.favorites.find((f) => f.title === title) ?? s.history.find((h) => h.title === title) ?? null,
  );
  const [article, setArticle] = useState<StoredArticle | null>(stored);
  const [error, setError] = useState<WikiErrorKind | null>(null);
  const [retrying, setRetrying] = useState(false);

  const categoryId = stored?.categoryId ?? 'anything';
  const category = getCategory(categoryId);

  const load = async () => {
    if (!title) return;
    setRetrying(true);
    try {
      const summary = await articles.summary(title);
      setArticle(toStored(summary, categoryId, stored?.subcategoryLabel ?? null));
      setError(null);
    } catch (e) {
      setError(e instanceof WikiError ? e.kind : 'server');
    } finally {
      setRetrying(false);
    }
  };

  // Fetch once on open when there's no stored copy.
  useEffect(() => {
    if (stored || !title) return;
    let alive = true;
    articles
      .summary(title)
      .then((summary) => alive && setArticle(toStored(summary, categoryId, null)))
      .catch((e: unknown) => alive && setError(e instanceof WikiError ? e.kind : 'server'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.root, styles.reading, { backgroundColor: c.base }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={[styles.close, { backgroundColor: c.surfaceAlt }]}
        >
          <Ionicons name="close" size={22} color={c.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        {!article && !error ? <ActivityIndicator color={c.ink} style={styles.loading} /> : null}
        <ResultCard
          article={article}
          unloaded={!article && title && error ? { title, reason: error, retrying, onRetry: load } : undefined}
          accent={category.accent[scheme]}
          icon={category.icon}
          categoryLabel={category.label}
          animate={false}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reading: { width: '100%', maxWidth: READING_MAX_WIDTH, alignSelf: 'center' },
  bar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.lg },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg },
  loading: { marginTop: space.xxl },
});
