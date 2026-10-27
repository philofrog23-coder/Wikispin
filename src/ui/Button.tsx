import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { IconName } from '@/core/categories';
import { fonts, radius, useTheme } from './theme';

interface ButtonProps {
  label: string;
  onPress(): void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  big?: boolean;
}

export function Button({ label, onPress, icon, variant = 'primary', color, loading, disabled, style, accessibilityHint, big }: ButtonProps) {
  const { c } = useTheme();
  const tint = color ?? c.ink;
  const bg = variant === 'primary' ? tint : variant === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : tint;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        big && styles.big,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={big ? 22 : 18} color={fg} /> : null}
          <Text style={[styles.label, big && styles.bigLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress(): void;
  color?: string;
  active?: boolean;
}

export function IconButton({ icon, label, onPress, color }: IconButtonProps) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, { backgroundColor: c.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color ?? c.ink} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { minHeight: 60 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '700', fontFamily: fonts.display },
  bigLabel: { fontSize: 20, fontWeight: '800' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
});
