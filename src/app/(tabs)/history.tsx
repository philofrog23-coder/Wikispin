import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { getCategory } from '@/core/categories';
import { HISTORY_LIMIT, useAppStore } from '@/core/store';
import { ArticleList, relativeTime, type ListItem } from '@/features/library/ArticleList';
import { confirmAction } from '@/ui/confirm';
import { useTheme } from '@/ui/theme';

export default function HistoryScreen() {
  const { c } = useTheme();
  const history = useAppStore((s) => s.history);
  const removeHistoryItem = useAppStore((s) => s.removeHistoryItem);
  const clearHistory = useAppStore((s) => s.clearHistory);

  const items = useMemo<ListItem[]>(
    () =>
      history.map((h) => ({
        ...h,
        key: String(h.at),
        meta: `${h.subcategoryLabel ?? getCategory(h.categoryId).label}, ${relativeTime(h.at).toLowerCase()}`,
      })),
    [history],
  );

  const confirmClear = () =>
    confirmAction('Clear history?', 'This removes every spin from History. Saved articles stay.', 'Clear history', clearHistory);

  return (
    <ArticleList
      title="History"
      items={items}
      onDelete={(item) => removeHistoryItem(Number(item.key))}
      empty={{
        icon: 'time-outline',
        title: 'No spins yet',
        body: `Your last ${HISTORY_LIMIT} discoveries will show up here.`,
      }}
      headerAction={
        history.length ? (
          <Pressable onPress={confirmClear} accessibilityRole="button" hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: c.danger, fontSize: 16, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        ) : null
      }
    />
  );
}
