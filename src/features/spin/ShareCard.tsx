import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { Platform, Share, StyleSheet, Text, View, type HostInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { IconName } from '@/core/categories';
import { APP_NAME } from '@/core/config';
import type { StoredArticle } from '@/core/store';
import { fonts } from '@/ui/theme';

interface Props {
  article: StoredArticle;
  accent: string;
  icon: IconName;
  categoryLabel: string;
}

/** Image rendered off-screen and captured for sharing. Always uses the dark cabinet look. */
export const ShareCard = forwardRef<HostInstance, Props>(function ShareCard({ article, accent, icon, categoryLabel }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={[styles.band, { backgroundColor: accent }]} />
      <View style={styles.header}>
        <Ionicons name={icon} size={18} color={accent} />
        <Text style={[styles.category, { color: accent }]}>
          {article.subcategoryLabel ? `${categoryLabel}: ${article.subcategoryLabel}` : categoryLabel}
        </Text>
      </View>
      {article.thumbnail ? <Image source={{ uri: article.thumbnail }} style={styles.image} contentFit="cover" /> : null}
      <Text style={styles.title}>{article.title}</Text>
      {article.description ? <Text style={styles.description}>{article.description}</Text> : null}
      <Text style={styles.extract} numberOfLines={6}>
        {article.extract}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.brand}>I spun this on {APP_NAME}</Text>
        <Text style={styles.license}>Text from Wikipedia, CC BY-SA 4.0</Text>
      </View>
    </View>
  );
});

/** Shares the card. On desktop/web without a share sheet, copies the link instead. */
export async function shareArticle(view: HostInstance | null, article: StoredArticle): Promise<'shared' | 'copied'> {
  const message = `${article.title}: ${article.url}`;
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: article.title, url: article.url });
        return 'shared';
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e; // user closed the sheet
        // Share sheet unavailable here (common in desktop shells): fall through to copying.
      }
    }
    await nav?.clipboard?.writeText(message);
    return 'copied';
  }
  let uri: string | null = null;
  try {
    if (view) uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  } catch {
    uri = null; // fall back to a text-only share
  }
  if (Platform.OS === 'ios') {
    await Share.share(uri ? { url: uri, message } : { message, url: article.url });
    return 'shared';
  }
  if (uri && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: message });
    return 'shared';
  }
  await Share.share({ message });
  return 'shared';
}

const styles = StyleSheet.create({
  card: { width: 360, padding: 24, paddingTop: 0, backgroundColor: '#1B2350', borderRadius: 28, overflow: 'hidden' },
  band: { height: 8, marginHorizontal: -24, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  category: { fontSize: 14, fontWeight: '700', fontFamily: fonts.display },
  image: { width: '100%', height: 180, borderRadius: 18, marginBottom: 16, backgroundColor: '#262F66' },
  title: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '800', fontFamily: fonts.display },
  description: { color: '#B9C0EA', fontSize: 15, marginTop: 6 },
  extract: { color: '#E9ECFF', fontSize: 15, lineHeight: 22, marginTop: 14 },
  footer: { marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2C3772' },
  brand: { color: '#F2B630', fontSize: 15, fontWeight: '800', fontFamily: fonts.display },
  license: { color: '#8C94C4', fontSize: 11, marginTop: 4 },
});
