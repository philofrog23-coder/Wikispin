import { useMemo } from 'react';
import { getCategory } from '@/core/categories';
import { useAppStore } from '@/core/store';
import { ArticleList, relativeTime, type ListItem } from '@/features/library/ArticleList';

export default function SavedScreen() {
  const favorites = useAppStore((s) => s.favorites);
  const removeFavorite = useAppStore((s) => s.removeFavorite);

  const items = useMemo<ListItem[]>(
    () =>
      favorites.map((f) => ({
        ...f,
        key: f.title,
        meta: `${f.subcategoryLabel ?? getCategory(f.categoryId).label}, saved ${relativeTime(f.savedAt).toLowerCase()}`,
      })),
    [favorites],
  );

  return (
    <ArticleList
      title="Saved"
      items={items}
      onDelete={(item) => removeFavorite(item.title)}
      empty={{
        icon: 'heart-outline',
        title: 'No saved articles yet',
        body: 'Tap the heart on a result to keep it here for later.',
      }}
    />
  );
}
