import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { IconName } from '@/core/categories';
import { CC_BY_SA_URL } from '@/core/config';
import { useAppStore, useIsFavorite, type StoredArticle } from '@/core/store';
import { userMessage, type WikiErrorKind } from '@/core/wiki/types';
import { Button, IconButton } from '@/ui/Button';
import { fonts, radius, space, useTheme } from '@/ui/theme';
import { ShareCard, shareArticle } from './ShareCard';

interface Props {
  article: StoredArticle | null;
  /** When the article couldn't be loaded (e.g. offline). */
  unloaded?: { title: string; reason: WikiErrorKind; retrying: boolean; onRetry(): void };
  accent: string;
  icon: IconName;
  categoryLabel: string;
  onSpinAgain?(): void;
  /** "Rabbit hole" follow-ups offered after reading. */
  onSameTopic?(): void;
  onSurprise?(): void;
  animate?: boolean;
}

export function ResultCard({ article, unloaded, accent, icon, categoryLabel, onSpinAgain, onSameTopic, onSurprise, animate = true }: Props) {
  const { c } = useTheme();
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useIsFavorite(article?.title);
  const shareRef = useRef<HostInstance>(null);
  const [backFromReading, setBackFromReading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const read = async () => {
    if (!article) return;
    if (Platform.OS === 'web') {
      // Desktop/web: open the article in the default browser.
      await Linking.openURL(article.url).catch(() => {});
      setBackFromReading(true);
      return;
    }
    await WebBrowser.openBrowserAsync(article.url, {
      controlsColor: accent,
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    }).catch(() => Linking.openURL(article.url));
    setBackFromReading(true);
  };

  const share = async () => {
    if (!article || sharing) return;
    setSharing(true);
    try {
      const result = await shareArticle(shareRef.current, article);
      if (result === 'copied') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // The user closed the share sheet, or sharing isn't available: nothing to do.
    } finally {
      setSharing(false);
    }
  };

  const entering = animate ? FadeInDown.springify().damping(16) : undefined;

  if (!article && unloaded) {
    return (
      <Animated.View entering={entering} style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
        <Header icon={icon} accent={accent} label={categoryLabel} />
        <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
          {unloaded.title}
        </Text>
        <View style={[styles.notice, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="cloud-offline-outline" size={20} color={c.muted} />
          <Text style={[styles.noticeText, { color: c.muted }]}>{userMessage(unloaded.reason)}</Text>
        </View>
        <View style={styles.actions}>
          <Button label="Try again" icon="refresh" onPress={unloaded.onRetry} loading={unloaded.retrying} color={accent} style={styles.flex} />
          {onSpinAgain ? <IconButton icon="shuffle" label="Spin again" onPress={onSpinAgain} /> : null}
        </View>
      </Animated.View>
    );
  }
  if (!article) return null;

  return (
    <Animated.View entering={entering} style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      <Header icon={icon} accent={accent} label={article.subcategoryLabel ?? categoryLabel} />

      {article.thumbnail ? (
        <Image
          source={{ uri: article.thumbnail }}
          style={[styles.image, { backgroundColor: c.surfaceAlt }]}
          contentFit="cover"
          transition={250}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : (
        <View style={[styles.imageFallback, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name={icon} size={44} color={accent} />
        </View>
      )}

      <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
        {article.title}
      </Text>
      {article.description ? <Text style={[styles.description, { color: c.muted }]}>{article.description}</Text> : null}
      <Text style={[styles.extract, { color: c.ink }]} numberOfLines={5}>
        {article.extract}
      </Text>

      <View style={styles.actions}>
        <Button label="Read" icon="book" onPress={read} color={accent} style={styles.flex} accessibilityHint="Opens the full article" />
        <IconButton
          icon={isFavorite ? 'heart' : 'heart-outline'}
          label={isFavorite ? 'Remove from saved' : 'Save'}
          color={isFavorite ? accent : undefined}
          onPress={() => toggleFavorite(article)}
        />
        <IconButton
          icon={copied ? 'checkmark' : sharing ? 'hourglass-outline' : 'share-outline'}
          label={copied ? 'Link copied' : 'Share'}
          onPress={share}
        />
        {onSpinAgain ? <IconButton icon="shuffle" label="Spin again" onPress={onSpinAgain} /> : null}
      </View>

      {backFromReading && (onSameTopic || onSurprise) ? (
        <View style={[styles.rabbit, { borderTopColor: c.hairline }]}>
          <Text style={[styles.rabbitTitle, { color: c.muted }]}>Keep going</Text>
          <View style={styles.rabbitRow}>
            {onSameTopic ? <Button label="More like this" variant="secondary" color={accent} onPress={onSameTopic} style={styles.flex} /> : null}
            {onSurprise ? <Button label="Something different" variant="secondary" onPress={onSurprise} style={styles.flex} /> : null}
          </View>
        </View>
      ) : null}

      <Pressable onPress={() => Linking.openURL(CC_BY_SA_URL)} accessibilityRole="link" hitSlop={8}>
        <Text style={[styles.license, { color: c.muted }]}>Content from Wikipedia, licensed under CC BY-SA 4.0</Text>
      </Pressable>

      {/* Off-screen copy used to render the share image. */}
      <View style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ShareCard ref={shareRef} article={article} accent={accent} icon={icon} categoryLabel={categoryLabel} />
      </View>
    </Animated.View>
  );
}

function Header({ icon, accent, label }: { icon: IconName; accent: string; label: string }) {
  return (
    <View style={styles.header}>
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={[styles.headerText, { color: accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg + 2, gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontSize: 14, fontWeight: '700', fontFamily: fonts.display },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md, marginVertical: space.xs },
  imageFallback: { width: '100%', height: 120, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginVertical: space.xs },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '800', fontFamily: fonts.display },
  description: { fontSize: 15, lineHeight: 20 },
  extract: { fontSize: 16, lineHeight: 24, marginTop: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  flex: { flex: 1 },
  notice: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: radius.sm },
  noticeText: { flex: 1, fontSize: 15 },
  rabbit: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, marginTop: space.xs, gap: space.sm },
  rabbitTitle: { fontSize: 14, fontWeight: '600' },
  rabbitRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  license: { fontSize: 12, marginTop: space.sm, textDecorationLine: 'underline' },
  offscreen: { position: 'absolute', left: -10000, top: 0, pointerEvents: 'none' },
});
