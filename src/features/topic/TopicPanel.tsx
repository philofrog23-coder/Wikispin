import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useServices } from '@/core/services';
import { useAppStore } from '@/core/store';
import type { TopicKind } from '@/core/wiki/topics';
import { userMessage } from '@/core/wiki/types';
import { Button } from '@/ui/Button';
import { radius, space, useTheme } from '@/ui/theme';
import { topicKey, useTopicPool } from './topicPool';

const EXAMPLES: Record<TopicKind, string[]> = {
  search: ['volcanoes', 'shipwrecks', 'lighthouses', 'board games', 'Soviet poets', 'deep sea creatures'],
  category: ['Impressionist painters', 'Castles in Scotland', 'Extinct birds', 'Video game consoles', 'Ancient Greek philosophers'],
};

const KIND_LABEL: Record<TopicKind, string> = { search: 'Search', category: 'Category' };

/** "Any topic" controls: type a search or a Wikipedia category, and the reel is built from it. */
export function TopicPanel({ accent, disabled }: { accent: string; disabled?: boolean }) {
  const { c } = useTheme();
  const { topics } = useServices();
  const kind = useAppStore((s) => s.topicKind);
  const savedQuery = useAppStore((s) => s.topicQuery);
  const recent = useAppStore((s) => s.recentTopics);
  const setTopic = useAppStore((s) => s.setTopic);
  const rememberTopic = useAppStore((s) => s.rememberTopic);
  const { status, key, total, suggestion, error, entries, load } = useTopicPool();
  const [draft, setDraft] = useState(savedQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (k: TopicKind, q: string) => {
    const query = q.trim();
    if (!query) return;
    setDraft(query);
    setSuggestions([]);
    setTopic(k, query);
    rememberTopic(k, query);
    load(topics, k, query);
  };

  // Reload the last topic when the app opens on "Any topic".
  useEffect(() => {
    if (savedQuery && key !== topicKey(kind, savedQuery) && status !== 'loading') load(topics, kind, savedQuery);
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (text: string) => {
    setDraft(text);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (kind !== 'category' || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      topics
        .suggestCategories(text)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 300);
  };

  const switchKind = (k: TopicKind) => {
    setTopic(k, draft);
    setSuggestions([]);
  };

  const loadedHere = key === topicKey(kind, savedQuery);
  const chips = draft.trim() ? suggestions : [...recent.filter((r) => r.kind === kind).map((r) => r.query), ...EXAMPLES[kind]];
  const uniqueChips = [...new Set(chips)].slice(0, 8);

  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      <View style={[styles.segment, { backgroundColor: c.surfaceAlt }]} accessibilityRole="radiogroup">
        {(['search', 'category'] as TopicKind[]).map((k) => {
          const active = k === kind;
          return (
            <Pressable
              key={k}
              onPress={() => switchKind(k)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[styles.segmentItem, active && { backgroundColor: accent }]}
            >
              <Text style={[styles.segmentText, { color: active ? c.onAccent : c.ink }]}>{KIND_LABEL[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputWrap, { backgroundColor: c.base, borderColor: c.hairline }]}>
          <Ionicons name={kind === 'search' ? 'search' : 'folder-open-outline'} size={18} color={c.muted} />
          <TextInput
            value={draft}
            onChangeText={onChange}
            onSubmitEditing={() => run(kind, draft)}
            placeholder={kind === 'search' ? 'Type any topic, e.g. volcanoes' : 'A Wikipedia category, e.g. Extinct birds'}
            placeholderTextColor={c.muted}
            returnKeyType="go"
            autoCorrect={false}
            editable={!disabled}
            style={[styles.input, { color: c.ink }]}
            accessibilityLabel={kind === 'search' ? 'Topic to search' : 'Wikipedia category'}
          />
        </View>
        <Button label="Load" color={accent} onPress={() => run(kind, draft)} disabled={disabled || !draft.trim()} loading={status === 'loading'} />
      </View>

      {uniqueChips.length ? (
        <View style={styles.chips}>
          {uniqueChips.map((t) => (
            <Pressable
              key={t}
              onPress={() => run(kind, t)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${KIND_LABEL[kind]}: ${t}`}
              style={({ pressed }) => [styles.chip, { borderColor: c.hairline, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.chipText, { color: c.ink }]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[styles.status, { color: status === 'error' ? c.danger : c.muted }]} accessibilityLiveRegion="polite">
        {status === 'loading'
          ? 'Collecting articles from Wikipedia…'
          : status === 'error' && loadedHere
            ? error === 'emptyPool' || error === 'notFound'
              ? kind === 'category'
                ? `No articles found in “${savedQuery}”. Check the category name or pick a suggestion.`
                : `Nothing found for “${savedQuery}”.`
              : userMessage(error ?? 'server')
            : status === 'ready' && loadedHere
              ? kind === 'search'
                ? `${entries.length.toLocaleString('en-US')} articles in the reel (of ${total.toLocaleString('en-US')} matches)`
                : `${entries.length.toLocaleString('en-US')} articles from this category and its subcategories`
              : 'Load a topic to fill the reel.'}
      </Text>
      {suggestion && loadedHere && kind === 'search' ? (
        <Pressable onPress={() => run('search', suggestion)} accessibilityRole="button" hitSlop={6}>
          <Text style={[styles.status, { color: accent }]}>Did you mean “{suggestion}”?</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.md },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, alignSelf: 'flex-start' },
  segmentItem: { minHeight: 36, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  status: { fontSize: 13, lineHeight: 18 },
});
