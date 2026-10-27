import * as Haptics from 'expo-haptics';

/** Minimum gap between tick haptics so a fast reel feels like taps, not a buzz. */
const MIN_TICK_GAP_MS = 45;
let lastTick = 0;

export const haptics = {
  tick(enabled: boolean) {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastTick < MIN_TICK_GAP_MS) return;
    lastTick = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success(enabled: boolean) {
    if (!enabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  selection(enabled: boolean) {
    if (!enabled) return;
    Haptics.selectionAsync().catch(() => {});
  },
};
