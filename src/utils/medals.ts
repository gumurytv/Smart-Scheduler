// 출석 메달 (Settings → 앱 → 출석 메달): monthly medals and attendance streaks, computed from the
// attendance records only (nothing extra is stored, so backups carry them automatically).
import { AttendanceMap, AttendanceRecord } from '../types';

export type MedalTier = 'gold' | 'silver' | 'bronze';

/** Minimum real attendance rate (%) for each medal, best first. */
export const MEDAL_TIERS: Array<{ tier: MedalTier; min: number }> = [
  { tier: 'gold', min: 100 },
  { tier: 'silver', min: 95 },
  { tier: 'bronze', min: 90 },
];
/** A month needs at least this many counted classes before it can earn a medal. */
export const MEDAL_MIN_CLASSES = 4;
/** Streak badges: classes in a row without a missed class. */
export const STREAK_MILESTONES = [10, 30, 50, 100];

/**
 * Present or late counts as attended, and so does an absence whose makeup was done.
 * Official days off don't count either way (null).
 */
export function attendedForMedal(rec: AttendanceRecord): boolean | null {
  if (rec.status === 'cancelled') return null;
  if (rec.status === 'present' || rec.status === 'late') return true;
  return !!(rec.needsMakeup && rec.makeupCompleted);
}

/** Every counted class up to `untilDate` (inclusive), oldest first. */
function countedClasses(attendance: AttendanceMap, untilDate: string): Array<{ date: string; attended: boolean }> {
  const out: Array<{ date: string; attended: boolean }> = [];
  Object.keys(attendance || {})
    .filter((date) => date <= untilDate)
    .sort()
    .forEach((date) => {
      const day = attendance[date];
      if (!day) return;
      const recs: AttendanceRecord[] = [];
      if (day.school) recs.push(day.school);
      Object.keys(day.academies || {})
        .sort()
        .forEach((name) => recs.push(day.academies![name]));
      recs.forEach((rec) => {
        const attended = attendedForMedal(rec);
        if (attended !== null) out.push({ date, attended });
      });
    });
  return out;
}

export interface MonthMedal {
  /** YYYY-MM */
  month: string;
  attended: number;
  total: number;
  rate: number;
  tier: MedalTier | null;
}

export function tierForRate(rate: number, total: number): MedalTier | null {
  if (total < MEDAL_MIN_CLASSES) return null;
  return MEDAL_TIERS.find((t) => rate >= t.min)?.tier ?? null;
}

/** The medal a month earns (or, for the current month, is on track for). */
export function monthMedal(attendance: AttendanceMap, month: string): MonthMedal {
  let attended = 0;
  let total = 0;
  Object.entries(attendance || {}).forEach(([date, day]) => {
    if (!date.startsWith(month) || !day) return;
    const recs = [day.school, ...Object.values(day.academies || {})];
    recs.forEach((rec) => {
      if (!rec) return;
      const a = attendedForMedal(rec);
      if (a === null) return;
      total++;
      if (a) attended++;
    });
  });
  const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;
  return { month, attended, total, rate, tier: tierForRate(rate, total) };
}

/** Months that have any counted class, newest first, up to and including `currentMonth`. */
export function medalMonths(attendance: AttendanceMap, currentMonth: string): MonthMedal[] {
  const months = new Set<string>();
  Object.keys(attendance || {}).forEach((date) => {
    const m = date.slice(0, 7);
    if (m <= currentMonth) months.add(m);
  });
  return Array.from(months)
    .sort()
    .reverse()
    .map((m) => monthMedal(attendance, m))
    .filter((m) => m.total > 0);
}

export interface StreakInfo {
  current: number;
  best: number;
}

/** Classes in a row without a missed class (a made-up absence keeps the streak going). */
export function attendanceStreak(attendance: AttendanceMap, todayStr: string): StreakInfo {
  let current = 0;
  let best = 0;
  countedClasses(attendance, todayStr).forEach(({ attended }) => {
    current = attended ? current + 1 : 0;
    best = Math.max(best, current);
  });
  return { current, best };
}

/** Everything earned so far, as stable ids (used to celebrate each one once). */
export function earnedMedalIds(attendance: AttendanceMap, todayStr: string): string[] {
  const thisMonth = todayStr.slice(0, 7);
  const ids = medalMonths(attendance, thisMonth)
    .filter((m) => m.month < thisMonth && m.tier)
    .map((m) => `month:${m.month}:${m.tier}`);
  const { best } = attendanceStreak(attendance, todayStr);
  STREAK_MILESTONES.filter((n) => best >= n).forEach((n) => ids.push(`streak:${n}`));
  return ids;
}
