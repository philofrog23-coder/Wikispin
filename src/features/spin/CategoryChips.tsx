import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CATEGORIES, type CategoryId } from '@/core/categories';
import { fonts, radius, useTheme } from '@/ui/theme';

interface Props {
  selected: CategoryId;
  onSelect(id: CategoryId): void;
  disabled?: boolean;
}

export function CategoryChips({ selected, onSelect, disabled }: Props) {
  const { c, scheme } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {CATEGORIES.map((cat) => {
        const active = cat.id === selected;
        const accent = cat.accent[scheme];
        return (
          <Pressable
            key={cat.id}
            disabled={disabled}
            onPress={() => onSelect(cat.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={cat.label}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? accent : c.surface,
                borderColor: active ? accent : c.hairline,
                opacity: disabled && !active ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name={cat.icon} size={16} color={active ? c.onAccent : accent} />
            <Text style={[styles.label, { color: active ? c.onAccent : c.ink }]}>{cat.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: 15, fontWeight: '700', fontFamily: fonts.display },
});
