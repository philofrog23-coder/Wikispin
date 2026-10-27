import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { OBSCURITY_LEVELS, type Obscurity } from '@/core/filters';
import { radius, useTheme } from '@/ui/theme';

/** Three-stop "Famous ↔ Obscure" slider with a sliding thumb. */
export function ObscuritySlider({ value, onChange, accent }: { value: Obscurity; onChange(v: Obscurity): void; accent: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, OBSCURITY_LEVELS.findIndex((l) => l.id === value));
  const segment = width / OBSCURITY_LEVELS.length;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * segment, { damping: 18, stiffness: 220 });
  }, [index, segment, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const hint = OBSCURITY_LEVELS[index]?.hint ?? '';

  return (
    <View>
      <View
        style={[styles.track, { backgroundColor: c.surfaceAlt }]}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}
        accessibilityRole="adjustable"
        accessibilityLabel="How famous"
        accessibilityValue={{ text: OBSCURITY_LEVELS[index]?.label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = e.nativeEvent.actionName === 'increment' ? index + 1 : index - 1;
          const level = OBSCURITY_LEVELS[next];
          if (level) onChange(level.id);
        }}
      >
        {width > 0 ? <Animated.View style={[styles.thumb, { width: segment, backgroundColor: accent }, thumbStyle]} /> : null}
        {OBSCURITY_LEVELS.map((level) => {
          const active = level.id === value;
          return (
            <Pressable key={level.id} style={styles.stop} onPress={() => onChange(level.id)} accessible={false}>
              <Text style={[styles.label, { color: active ? c.onAccent : c.ink }]}>{level.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, minHeight: 52 },
  thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill },
  stop: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  label: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13, marginTop: 8, textAlign: 'center' },
});
