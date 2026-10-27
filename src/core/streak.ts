export interface StreakState {
  /** Local calendar day of the last spin, "YYYY-MM-DD". */
  lastDay: string | null;
  days: number;
  discovered: number;
}

export const EMPTY_STREAK: StreakState = { lastDay: null, days: 0, discovered: 0 };

export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ua = Date.UTC(ay ?? 0, (am ?? 1) - 1, ad ?? 1);
  const ub = Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((ub - ua) / 86_400_000);
}

/** Called once per successful discovery. */
export function recordDiscovery(state: StreakState, now: Date): StreakState {
  const today = localDay(now);
  let days = state.days;
  if (state.lastDay === null) days = 1;
  else {
    const diff = dayDiff(state.lastDay, today);
    if (diff === 1) days += 1;
    else if (diff !== 0) days = 1;
  }
  return { lastDay: today, days, discovered: state.discovered + 1 };
}

/** The streak shown on screen: 0 if the user missed yesterday. */
export function visibleStreak(state: StreakState, now: Date): number {
  if (!state.lastDay) return 0;
  const diff = dayDiff(state.lastDay, localDay(now));
  return diff <= 1 ? state.days : 0;
}
