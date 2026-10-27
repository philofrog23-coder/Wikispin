import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useIsWide, useTheme } from '@/ui/theme';

/**
 * Web / desktop tabs. Native tabs have a fixed dark floating bar on the web, so the
 * desktop app uses a themed bottom tab bar instead (iOS and Android keep native tabs).
 */
export default function WebTabLayout() {
  const { c } = useTheme();
  const wide = useIsWide();
  return (
    <Tabs
      screenOptions={
        wide
          ? {
              // Wide screens: a quiet sidebar on the left, labels beside the icons.
              headerShown: false,
              tabBarPosition: 'left',
              tabBarVariant: 'material',
              tabBarLabelPosition: 'beside-icon',
              tabBarActiveTintColor: c.ink,
              tabBarInactiveTintColor: c.muted,
              tabBarActiveBackgroundColor: c.surfaceAlt,
              tabBarStyle: { backgroundColor: c.surface, borderRightColor: c.hairline, width: 200, paddingTop: 24 },
              tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
              sceneStyle: { backgroundColor: c.base },
            }
          : {
              headerShown: false,
              tabBarActiveTintColor: c.ink,
              tabBarInactiveTintColor: c.muted,
              tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.hairline, height: 64, paddingTop: 6, paddingBottom: 8 },
              tabBarLabelStyle: { fontSize: 12, lineHeight: 16 },
              sceneStyle: { backgroundColor: c.base },
            }
      }
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Spin', tabBarIcon: ({ color, size }) => <Ionicons name="dice" color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'Saved', tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color, size }) => <Ionicons name="time" color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={String(color)} size={size} /> }}
      />
    </Tabs>
  );
}
