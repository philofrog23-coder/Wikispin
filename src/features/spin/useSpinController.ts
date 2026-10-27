import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { CategoryId } from '@/core/categories';
import { haptics } from '@/core/haptics';
import { useServices } from '@/core/services';
import { buildReel, resolveAnything, resolveFromPool, type SpinOutcome } from '@/core/spin';
import { jitterFrom, REEL_LENGTH, spinDuration, WINNER_INDEX } from '@/core/spinMath';
import { toStored, useAppStore } from '@/core/store';
import { WikiError, type ArticleSummary, type WikiErrorKind } from '@/core/wiki/types';
import type { ReelSpin } from './Reel';
import type { FilteredPool } from './useFilteredPool';

export type SpinPhase = 'idle' | 'resolving' | 'spinning' | 'revealed' | 'error';

/** Where a spin came from, captured when it starts so later category changes don't relabel it. */
export interface SpinContext {
  categoryId: CategoryId;
  subcategoryLabel: string | null;
  poolKey: string;
  reelKey: string;
}

export interface SpinState {
  phase: SpinPhase;
  reel: ReelSpin | null;
  outcome: SpinOutcome | null;
  error: WikiErrorKind | null;
  /** True while re-trying to load an article that failed offline. */
  reloading: boolean;
  context: SpinContext | null;
}

const INITIAL: SpinState = { phase: 'idle', reel: null, outcome: null, error: null, reloading: false, context: null };

/**
 * Orchestrates one spin: pick the winner (and load its summary) first, then animate the
 * reel onto it, then reveal. Re-spinning cancels any request still in flight.
 */
export function useSpinController(pool: FilteredPool) {
  const { articles, pools, sound } = useServices();
  const systemReduceMotion = useReducedMotion();
  const reelMotion = useAppStore((s) => s.reelMotion);
  const reduceMotion = reelMotion === 'always' ? false : reelMotion === 'reduced' ? true : systemReduceMotion;
  const [state, setState] = useState<SpinState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const keyRef = useRef(0);
  // Latest values for callbacks that must keep a stable identity.
  const poolRef = useRef(pool);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    poolRef.current = pool;
    stateRef.current = state;
  });

  useEffect(() => () => abortRef.current?.abort(), []);

  const record = useCallback((summary: ArticleSummary, ctx: SpinContext) => {
    useAppStore.getState().recordSpin(ctx.poolKey, toStored(summary, ctx.categoryId, ctx.subcategoryLabel));
  }, []);

  const spin = useCallback(async () => {
    if (state.phase === 'resolving' || state.phase === 'spinning') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { category, label, entries, poolKey, reelKey } = poolRef.current;
    const context: SpinContext = { categoryId: category.id, subcategoryLabel: label, poolKey, reelKey };
    const rng = Math.random;
    setState((s) => ({ ...s, phase: 'resolving', error: null }));

    try {
      let outcome: SpinOutcome;
      let decoySource: string[] | typeof entries;
      if (category.id === 'anything') {
        outcome = await resolveAnything({ service: articles, signal: controller.signal });
        decoySource = pools.anyTitles(REEL_LENGTH, rng);
      } else {
        const recent = useAppStore.getState().recent[poolKey] ?? [];
        outcome = await resolveFromPool({ entries, recent, rng, service: articles, signal: controller.signal });
        decoySource = entries;
      }
      if (controller.signal.aborted) return;

      const titles = buildReel({ winner: outcome.title, length: REEL_LENGTH, winnerIndex: WINNER_INDEX, decoySource, rng });
      keyRef.current += 1;
      setState({
        phase: 'spinning',
        reel: { key: keyRef.current, titles, jitter: jitterFrom(rng()), duration: spinDuration(rng()) },
        outcome,
        error: null,
        reloading: false,
        context,
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      const kind: WikiErrorKind = e instanceof WikiError ? e.kind : 'server';
      setState((s) => ({ ...s, phase: 'error', error: kind }));
    }
  }, [articles, pools, state.phase]);

  const onTick = useCallback(() => {
    const { soundEnabled, hapticsEnabled } = useAppStore.getState();
    if (soundEnabled) sound.tick();
    haptics.tick(hapticsEnabled);
  }, [sound]);

  const onDone = useCallback(() => {
    const { soundEnabled, hapticsEnabled } = useAppStore.getState();
    if (soundEnabled) sound.chime();
    haptics.success(hapticsEnabled);
    const { outcome, context } = stateRef.current;
    if (outcome?.kind === 'article' && context) {
      record(outcome.summary, context);
      const d = outcome.summary.description;
      AccessibilityInfo.announceForAccessibility(`You got: ${outcome.title}${d ? `, ${d}` : ''}`);
    } else if (outcome) {
      AccessibilityInfo.announceForAccessibility(`You got: ${outcome.title}. The article couldn't be loaded.`);
    }
    setState((s) => ({ ...s, phase: 'revealed' }));
  }, [record, sound]);

  /** Retry loading an article that came back "unloaded" (e.g. offline). */
  const reload = useCallback(async () => {
    const { outcome, context } = state;
    if (!outcome || outcome.kind !== 'unloaded' || !context) return;
    setState((s) => ({ ...s, reloading: true }));
    try {
      const summary = await articles.summary(outcome.title);
      record(summary, context);
      setState((s) => ({ ...s, reloading: false, outcome: { kind: 'article', title: summary.title, summary } }));
    } catch (e) {
      const reason: WikiErrorKind = e instanceof WikiError ? e.kind : 'server';
      setState((s) => ({ ...s, reloading: false, outcome: { kind: 'unloaded', title: outcome.title, reason } }));
    }
  }, [articles, record, state]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  return { state, spin, onTick, onDone, reload, reset, reduceMotion };
}
