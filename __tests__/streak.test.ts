import { EMPTY_STREAK, recordDiscovery, visibleStreak } from '@/core/streak';

const day = (d: number, h = 12) => new Date(2026, 9, d, h);

describe('streak', () => {
  it('starts at one day and counts discoveries', () => {
    const s = recordDiscovery(EMPTY_STREAK, day(1));
    expect(s).toMatchObject({ days: 1, discovered: 1, lastDay: '2026-10-01' });
  });

  it('does not grow twice on the same day', () => {
    const s = recordDiscovery(recordDiscovery(EMPTY_STREAK, day(1, 9)), day(1, 22));
    expect(s.days).toBe(1);
    expect(s.discovered).toBe(2);
  });

  it('grows on consecutive days, including across a month boundary', () => {
    let s = recordDiscovery(EMPTY_STREAK, new Date(2026, 8, 30));
    s = recordDiscovery(s, day(1));
    s = recordDiscovery(s, day(2));
    expect(s.days).toBe(3);
  });

  it('resets after a missed day', () => {
    let s = recordDiscovery(EMPTY_STREAK, day(1));
    s = recordDiscovery(s, day(2));
    s = recordDiscovery(s, day(5));
    expect(s.days).toBe(1);
  });

  it('shows zero once yesterday was missed, before the next spin', () => {
    const s = recordDiscovery(EMPTY_STREAK, day(1));
    expect(visibleStreak(s, day(2))).toBe(1);
    expect(visibleStreak(s, day(3))).toBe(0);
  });
});
