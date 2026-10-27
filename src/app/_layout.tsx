import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ServicesProvider } from '@/core/services';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const { c, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.base, card: c.surface, text: c.ink, border: c.hairline, primary: c.ink },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ServicesProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ contentStyle: { backgroundColor: c.base } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="filters"
              options={{
                title: 'Filters',
                presentation: 'formSheet',
                sheetAllowedDetents: [0.8, 1],
                sheetGrabberVisible: true,
                headerShown: false,
              }}
            />
            <Stack.Screen name="article" options={{ title: '', presentation: 'modal', headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </ServicesProvider>
    </GestureHandlerRootView>
  );
}
