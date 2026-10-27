import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { IconName } from '@/core/categories';
import { indexAtMarker, offsetFor, REEL_LENGTH, startIndexFor, STEP, TILE_GAP, TILE_W, WINNER_INDEX } from '@/core/spinMath';
import { fonts, radius, useTheme } from '@/ui/theme';

export interface ReelSpin {
  /** Increments for every new spin; starting a spin is keyed on it. */
  key: number;
  titles: string[];
  jitter: number;
  duration: number;
}

interface Props {
  spin: ReelSpin | null;
  /** Tiles shown when there is no spin to display (a preview of the current selection). */
  idleTitles?: string[];
  accent: string;
  icon: IconName;
  reduceMotion: boolean;
  revealed: boolean;
  winnerThumbnail: string | null;
  onTick(): void;
  onDone(): void;
}

const TILE_H = 132;
const SETTLE_OVERSHOOT = 7;
const IDLE_TITLES = Array.from({ length: REEL_LENGTH }, () => '');

/**
 * Case-opening style roulette. The winner is already placed at WINNER_INDEX before the
 * animation starts; the reel decelerates onto it, ticking each time a tile crosses the marker.
 * Tap the reel while it spins to skip to the result.
 */
export function Reel({ spin, idleTitles, accent, icon, reduceMotion, revealed, winnerThumbnail, onTick, onDone }: Props) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const spinning = useSharedValue(false);
  const fade = useSharedValue(1);
  const pop = useSharedValue(0);
  // The spin whose animation has finished; "spinning" is derived from it rather than stored separately.
  const [finishedKey, setFinishedKey] = useState<number | null>(null);
  const isSpinning = spin !== null && finishedKey !== spin.key;

  // Stable callbacks for the UI thread to call back into JS.
  const tickRef = useRef(onTick);
  const doneRef = useRef(onDone);
  useLayoutEffect(() => {
    tickRef.current = onTick;
    doneRef.current = onDone;
  });
  const fireTick = useCallback(() => tickRef.current(), []);
  const lastFinished = useRef<number | null>(null);
  const finish = useCallback((key: number) => {
    if (lastFinished.current === key) return; // the settle and a skip can both report completion
    lastFinished.current = key;
    setFinishedKey(key);
    doneRef.current();
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const layoutWidth = e.nativeEvent.layout.width;
    setWidth(layoutWidth);
    w.set(layoutWidth);
    if (!spinning.get() && !spin) x.set(offsetFor(layoutWidth, startIndexFor(layoutWidth)));
  };

  // Start a spin whenever the key changes.
  const startedKey = useRef<number | null>(null);
  useEffect(() => {
    if (!width) return;
    if (!spin) {
      // Back to the preview: park the reel at its start position.
      cancelAnimation(x);
      spinning.set(false);
      x.set(offsetFor(width, startIndexFor(width)));
      fade.set(1);
      return;
    }
    const key = spin.key;
    const end = offsetFor(width, WINNER_INDEX, spin.jitter);
    if (startedKey.current === key) {
      // This spin already played (e.g. the user switched topics and back): show where it stopped.
      if (lastFinished.current === key) x.set(end);
      return;
    }
    startedKey.current = key;
    pop.set(0);

    if (reduceMotion) {
      // No travel: cross-fade straight to the result.
      x.set(end);
      fade.set(0);
      fade.set(
        withTiming(1, { duration: 350 }, (ok) => {
          if (ok) scheduleOnRN(finish, key);
        }),
      );
      return;
    }

    x.set(offsetFor(width, startIndexFor(width)));
    spinning.set(true);
    // Reduce Motion is decided by the app (the reduceMotion prop, from the user's setting), so the
    // travel itself must not be skipped again by Reanimated's own system-wide check.
    x.set(
      withSequence(
        ReduceMotion.Never,
        // Strong ease-out: fast start, long dramatic slowdown, a hair past the target…
        withTiming(end - SETTLE_OVERSHOOT, {
          duration: spin.duration,
          easing: Easing.bezier(0.06, 0.78, 0.1, 1),
          reduceMotion: ReduceMotion.Never,
        }),
        // …then settle back onto it.
        withTiming(end, { duration: 320, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never }, (ok) => {
          spinning.set(false);
          if (ok) scheduleOnRN(finish, key);
        }),
      ),
    );
    // Only a new spin (or the first layout) should restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key, spin === null, width]);

  useEffect(() => {
    pop.set(revealed ? withSpring(1, { damping: 11, stiffness: 180 }) : withTiming(0, { duration: 120 }));
  }, [revealed, pop]);

  // Tick whenever a new tile crosses the marker (runs on the UI thread).
  useAnimatedReaction(
    () => (spinning.value ? indexAtMarker(x.value, w.value) : -1),
    (current, previous) => {
      if (previous !== null && previous >= 0 && current >= 0 && current !== previous) scheduleOnRN(fireTick);
    },
  );

  const skip = () => {
    if (!spin || !isSpinning || !width || reduceMotion) return;
    const key = spin.key;
    cancelAnimation(x);
    x.set(
      withTiming(
        offsetFor(width, WINNER_INDEX, spin.jitter),
        { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never },
        (ok) => {
        spinning.set(false);
        if (ok) scheduleOnRN(finish, key);
      }),
    );
  };

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: fade.value }));
  const titles = spin?.titles ?? (idleTitles && idleTitles.length ? idleTitles : IDLE_TITLES);

  return (
    <Pressable
      onPress={skip}
      accessibilityRole={isSpinning ? 'button' : undefined}
      accessibilityLabel={isSpinning ? 'Roulette spinning. Tap to skip to the result.' : 'Roulette reel'}
      style={[styles.cabinet, { backgroundColor: c.cabinet, borderColor: c.cabinetEdge }]}
      onLayout={onLayout}
    >
      <Animated.View style={[styles.row, rowStyle]}>
        {titles.map((title, i) => (
          <Tile
            key={i}
            title={title}
            icon={icon}
            accent={accent}
            tileColor={c.tile}
            inkColor={c.tileInk}
            isWinner={i === WINNER_INDEX && revealed}
            thumbnail={i === WINNER_INDEX && revealed ? winnerThumbnail : null}
            pop={i === WINNER_INDEX ? pop : undefined}
          />
        ))}
      </Animated.View>

      {/* Edge fades: the reel appears to run under the cabinet frame. */}
      <LinearGradient
        colors={[c.cabinet, `${c.cabinet}00`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.fade, { left: 0 }]}
      />
      <LinearGradient
        colors={[`${c.cabinet}00`, c.cabinet]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.fade, { right: 0 }]}
      />

      {/* Brass marker */}
      <View style={styles.markerWrap}>
        <View style={[styles.notchTop, { borderTopColor: c.brass }]} />
        <View style={[styles.markerTick, { backgroundColor: c.brass }]} />
        <View style={styles.markerGap} />
        <View style={[styles.markerTick, { backgroundColor: c.brass }]} />
        <View style={[styles.notchBottom, { borderBottomColor: c.brass }]} />
      </View>
    </Pressable>
  );
}

interface TileProps {
  title: string;
  icon: IconName;
  accent: string;
  tileColor: string;
  inkColor: string;
  isWinner: boolean;
  thumbnail: string | null;
  pop?: SharedValue<number>;
}

const Tile = memo(function Tile({ title, icon, accent, tileColor, inkColor, isWinner, thumbnail, pop }: TileProps) {
  const popStyle = useAnimatedStyle(() => {
    const p = pop?.value ?? 0;
    return { transform: [{ scale: 1 + p * 0.07 }], shadowOpacity: p * 0.9 };
  });
  return (
    <Animated.View
      style={[
        styles.tile,
        { backgroundColor: tileColor, borderColor: isWinner ? accent : 'transparent', shadowColor: accent },
        popStyle,
      ]}
    >
      <View style={[styles.tileBand, { backgroundColor: accent }]} />
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumb} contentFit="cover" transition={200} />
      ) : (
        <Ionicons name={title ? icon : 'help'} size={26} color={accent} style={styles.icon} />
      )}
      <Text style={[styles.tileText, { color: inkColor }]} numberOfLines={3} maxFontSizeMultiplier={1.2}>
        {title || ' '}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cabinet: {
    height: TILE_H + 40,
    borderRadius: radius.lg,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: TILE_GAP,
    width: REEL_LENGTH * STEP,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingBottom: 10,
    alignItems: 'center',
    overflow: 'visible',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    shadowOpacity: 0,
  },
  tileBand: { alignSelf: 'stretch', height: 5, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, marginBottom: 12, opacity: 0.9 },
  icon: { marginBottom: 8 },
  thumb: { width: 40, height: 40, borderRadius: 20, marginBottom: 6 },
  tileText: {
    fontFamily: fonts.display,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 56, pointerEvents: 'none' },
  markerWrap: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 20, marginLeft: -10, alignItems: 'center', pointerEvents: 'none' },
  markerTick: { width: 3, height: 14, borderRadius: 2 },
  markerGap: { flex: 1 },
  notchTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  notchBottom: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
