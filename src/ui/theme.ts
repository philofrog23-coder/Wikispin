import { Platform, useColorScheme, useWindowDimensions } from 'react-native';
import { getCategory, type CategoryId } from '@/core/categories';

/**
 * Design tokens. Direction: a cool "reading room" page with one loud object, the reel
 * cabinet (deep indigo with a brass marker), which stays dark in both color schemes.
 */
const light = {
  base: '#EEF1F8',
  surface: '#FFFFFF',
  surfaceAlt: '#E3E8F4',
  ink: '#141A33',
  muted: '#5B6386',
  hairline: '#D3D9EA',
  cabinet: '#1B2350',
  cabinetEdge: '#2C3772',
  tile: '#262F66',
  tileInk: '#E9ECFF',
  brass: '#F2B630',
  danger: '#C2364B',
  /** Text and icons on accent-colored fills (dark text in dark mode, where accents are light). */
  onAccent: '#FFFFFF',
};

const dark: typeof light = {
  base: '#0E1230',
  surface: '#181E45',
  surfaceAlt: '#20275A',
  ink: '#EEF0FF',
  muted: '#9AA2CC',
  hairline: '#2A3270',
  cabinet: '#070A20',
  cabinetEdge: '#232B66',
  tile: '#1A2052',
  tileInk: '#E9ECFF',
  brass: '#F5C451',
  danger: '#FF7088',
  onAccent: '#0E1230',
};

export type Palette = typeof light;

export const fonts = {
  /** SF Pro Rounded on iOS; the system face elsewhere. */
  display: Platform.select({ ios: 'ui-rounded', default: undefined }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export function useTheme() {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = scheme === 'dark' ? dark : light;
  return { c, scheme, isDark: scheme === 'dark' };
}

export function useAccent(categoryId: CategoryId): string {
  const { scheme } = useTheme();
  return getCategory(categoryId).accent[scheme];
}

/** At this width and above, web/desktop switches to the wide layout. */
export const WIDE_BREAKPOINT = 900;

export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

/** Column width for reading screens (lists, settings) on wide layouts. */
export const READING_MAX_WIDTH = 760;
