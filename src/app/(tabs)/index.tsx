import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, getCategory } from '@/core/categories';
import { APP_NAME } from '@/core/config';
import { pickDecoys, seededRng } from '@/core/filters';
import { topUpPools } from '@/core/live/liveStore';
import { useServices } from '@/core/services';
import { REEL_LENGTH } from '@/core/spinMath';
import { toStored, useAppStore } from '@/core/store';
import { userMessage } from '@/core/wiki/types';
import { CategoryChips } from '@/features/spin/CategoryChips';
import { FilterSummary } from '@/features/spin/FilterSummary';
import { Reel } from '@/features/spin/Reel';
import { ResultCard } from '@/features/spin/ResultCard';
import { StreakBadge } from '@/features/spin/StreakBadge';
import { useFilteredPool } from '@/features/spin/useFilteredPool';
import { useSpinController } from '@/features/spin/useSpinController';
import { TopicPanel } from '@/features/topic/TopicPanel';
import { Button, Card } from '@/ui/Button';
import { fonts, radius, space, useIsWide, useTheme } from '@/ui/theme';

const MAX_CONTENT_WIDTH = 1180;
const CONTROLS_WIDTH = 400;

export default function SpinScreen() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const pool = useFilteredPool();
  const { state, spin, onTick, onDone, reload, reduceMotion } = useSpinController(pool);
  const setCategory = useAppStore((s) => s.setCategory);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const { pools: poolRepo } = useServices();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [resultY, setResultY] = useState(0);
  const pendingSpin = useRef(false);

  const { category } = pool;
  const accent = category.accent[scheme];
  const busy = state.phase === 'resolving' || state.phase === 'spinning';
  const revealed = state.phase === 'revealed';
  const outcome = state.outcome;
  const isTopic = category.id === 'topic';

  // Spin after a category switch has re-rendered with the new pool ("Something different").
  useEffect(() => {
    if (!pendingSpin.current) return;
    pendingSpin.current = false;
    spin();
  }, [pool, spin]);

  // On a phone the result sits under the reel: bring it into view once it appears.
  useEffect(() => {
    if (!wide && revealed && resultY > 0) scrollRef.current?.scrollTo({ y: Math.max(0, resultY - space.lg), animated: true });
  }, [wide, revealed, resultY]);

  // Grow the library in the background: fetch fresh articles for this selection from Wikidata.
  const poolIdsKey = pool.poolIds.join('|');
  useEffect(() => {
    if (!poolIdsKey) return;
    const timer = setTimeout(() => {
      topUpPools(poolIdsKey.split('|'), poolRepo).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [poolIdsKey, poolRepo]);

  const startSpin = () => {
    if (!wide) scrollRef.current?.scrollTo({ y: 0, animated: true });
    spin();
  };

  const spinSomethingDifferent = () => {
    // Pick another ready-made category (not the typed topic, which may be empty).
    const others = CATEGORIES.filter((cat) => cat.id !== category.id && cat.id !== 'topic');
    const next = others[Math.floor(Math.random() * others.length)];
    if (next) setCategory(next.id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    pendingSpin.current = true;
  };

  // The result belongs to the category it was spun in, even if the chips have changed since.
  const resultCategory = getCategory(state.context?.categoryId ?? category.id);
  const article =
    revealed && outcome?.kind === 'article'
      ? toStored(outcome.summary, resultCategory.id, state.context?.subcategoryLabel ?? null)
      : null;
  const unloaded =
    revealed && outcome?.kind === 'unloaded'
      ? { title: outcome.title, reason: outcome.reason, retrying: state.reloading, onRetry: reload }
      : undefined;

  const emptyPool = !isTopic && category.id !== 'anything' && pool.available && pool.entries.length === 0;
  const topicNotReady = isTopic && pool.entries.length === 0;

  // The last spin's reel stays on screen only while the topic and filters are unchanged.
  // Change either and the reel switches to a preview drawn from the new selection.
  const showSpunReel = busy || (state.reel !== null && state.context?.reelKey === pool.reelKey);
  const previewTitles = useMemo(() => {
    const rng = seededRng(hashString(pool.reelKey));
    return category.id === 'anything' ? poolRepo.anyTitles(REEL_LENGTH, rng) : pickDecoys(pool.entries, REEL_LENGTH, rng);
  }, [category.id, pool.entries, pool.reelKey, poolRepo]);

  const controls = (
    <>
      {isTopic ? (
        <TopicPanel accent={accent} disabled={busy} />
      ) : category.id === 'anything' ? (
        <Text style={[styles.hint, { color: c.muted }]}>Any article from all of English Wikipedia. Needs a connection.</Text>
      ) : (
        <FilterSummary pool={pool} onPress={() => router.push('/filters')} disabled={busy} />
      )}
    </>
  );

  const reel = (
    <Reel
      spin={showSpunReel ? state.reel : null}
      idleTitles={previewTitles}
      accent={accent}
      icon={category.icon}
      reduceMotion={reduceMotion}
      revealed={revealed && showSpunReel}
      winnerThumbnail={outcome?.kind === 'article' ? (outcome.summary.thumbnail?.url ?? null) : null}
      onTick={onTick}
      onDone={onDone}
    />
  );

  const spinButton = (
    <View style={styles.spinBlock}>
      <Button
        big
        label={state.phase === 'spinning' ? 'Spinning…' : revealed ? 'Spin again' : 'Spin'}
        icon="sync"
        color={accent}
        loading={state.phase === 'resolving'}
        disabled={busy || emptyPool || topicNotReady || !pool.available}
        onPress={startSpin}
        accessibilityHint="Spins the roulette and picks a random article"
      />
      {state.phase === 'spinning' && !reduceMotion ? (
        <Text style={[styles.hint, styles.center, { color: c.muted }]}>Tap the reel to skip</Text>
      ) : null}
    </View>
  );

  const result = !pool.available ? (
    <Card>
      <Text style={[styles.noticeTitle, { color: c.ink }]}>This topic has no articles yet</Text>
      <Text style={[styles.noticeBody, { color: c.muted }]}>
        Generate the article lists with “npm run build-pools”, then reload the app.
      </Text>
    </Card>
  ) : emptyPool ? (
    <Card>
      <Ionicons name="funnel-outline" size={24} color={accent} />
      <Text style={[styles.noticeTitle, { color: c.ink }]}>No articles match these filters</Text>
      <Text style={[styles.noticeBody, { color: c.muted }]}>Clear the country and era to widen the reel.</Text>
      <Button label="Loosen filters" variant="secondary" color={accent} onPress={resetFilters} style={styles.noticeButton} />
    </Card>
  ) : state.phase === 'error' && state.error ? (
    <Card>
      <Text style={[styles.noticeTitle, { color: c.ink }]}>{userMessage(state.error)}</Text>
      {state.error === 'emptyPool' ? (
        <Button label="Loosen filters" variant="secondary" color={accent} onPress={resetFilters} style={styles.noticeButton} />
      ) : (
        <Button label="Spin again" variant="secondary" color={accent} onPress={startSpin} style={styles.noticeButton} />
      )}
    </Card>
  ) : article || unloaded ? (
    <ResultCard
      key={state.reel?.key}
      article={article}
      unloaded={unloaded}
      accent={resultCategory.accent[scheme]}
      icon={resultCategory.icon}
      categoryLabel={resultCategory.label}
      onSpinAgain={startSpin}
      onSameTopic={startSpin}
      onSurprise={spinSomethingDifferent}
    />
  ) : wide ? (
    <View style={[styles.placeholder, { borderColor: c.hairline }]}>
      <Ionicons name="book-outline" size={36} color={c.muted} />
      <Text style={[styles.placeholderText, { color: c.muted }]}>Your article lands here. Pick a topic and spin.</Text>
    </View>
  ) : null;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: c.base }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + (wide ? space.xxl : space.md), paddingBottom: insets.bottom + 96 },
      ]}
      contentInsetAdjustmentBehavior="never"
    >
      <View style={[styles.frame, wide && styles.frameWide]}>
        <View style={styles.header}>
          <Text style={[styles.appName, wide && styles.appNameWide, { color: c.ink }]} accessibilityRole="header">
            {APP_NAME}
          </Text>
          <StreakBadge />
        </View>

        <CategoryChips selected={category.id} onSelect={setCategory} disabled={busy} />

        {wide ? (
          <>
            <View style={styles.section}>{reel}</View>
            <View style={styles.columns}>
              <View style={[styles.controlsColumn, { width: CONTROLS_WIDTH }]}>
                {controls}
                {spinButton}
              </View>
              <View style={styles.resultColumn}>{result}</View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              {controls}
              {reel}
              {spinButton}
            </View>
            <View style={styles.section} onLayout={(e) => setResultY(e.nativeEvent.layout.y)}>
              {result}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  frame: { gap: space.lg, width: '100%' },
  frameWide: { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  appName: { fontSize: 32, fontWeight: '800', fontFamily: fonts.display, letterSpacing: -0.5 },
  appNameWide: { fontSize: 40 },
  section: { paddingHorizontal: space.lg, gap: space.md },
  columns: { flexDirection: 'row', gap: space.xl, paddingHorizontal: space.lg, alignItems: 'flex-start' },
  controlsColumn: { gap: space.md },
  resultColumn: { flex: 1, minWidth: 0 },
  spinBlock: { gap: space.sm },
  hint: { fontSize: 14, lineHeight: 19 },
  center: { textAlign: 'center' },
  noticeTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.display, marginTop: space.xs },
  noticeBody: { fontSize: 15, lineHeight: 21, marginTop: space.xs },
  noticeButton: { marginTop: space.md, alignSelf: 'flex-start' },
  placeholder: {
    minHeight: 280,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  placeholderText: { fontSize: 16, textAlign: 'center' },
});

/** Small stable string hash, so the preview reel is the same for the same selection. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
