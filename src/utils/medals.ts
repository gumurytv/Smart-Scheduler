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
/** Streak badges: days in a row on which every planned class was attended. */
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

/** What the timetable had planned for a day: school (any period) and the academy classes. */
export type PlannedDay = (date: string) => { school: boolean; academies: Array<{ name: string; cancelled: boolean }> };

const addDayKey = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

/**
 * Days in a row on which every planned class (school and academies) was attended.
 * Present, late and a made-up absence count; official days off are left out. A day with no
 * classes (weekend) is skipped. A missed class ends the streak, and so does an unchecked one once
 * its day can no longer be checked (older than yesterday); today and yesterday wait for the check.
 */
export function attendanceStreak(attendance: AttendanceMap, todayStr: string, planned: PlannedDay): StreakInfo {
  const dates = Object.keys(attendance || {}).filter((d) => d <= todayStr).sort();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const g = new Date(ty, tm - 1, td - 1);
  const graceStart = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
  let current = 0;
  let best = 0;
  if (dates.length === 0) return { current, best };
  for (let date = dates[0]; date <= todayStr; date = addDayKey(date)) {
    const day = attendance[date] || {};
    const plan = planned(date);
    const recs: Array<AttendanceRecord | undefined> = [];
    if (plan.school || day.school) recs.push(day.school);
    const names = new Set(plan.academies.filter((a) => !a.cancelled).map((a) => a.name));
    Object.keys(day.academies || {}).forEach((n) => names.add(n));
    names.forEach((n) => recs.push(day.academies?.[n]));
    const counted = recs.filter((r) => r?.status !== 'cancelled');
    if (counted.length === 0) continue;
    const results = counted.map((r) => (r ? attendedForMedal(r) : undefined));
    if (results.every((x) => x === true)) {
      current += 1;
      best = Math.max(best, current);
    } else if (date >= graceStart && !results.includes(false)) {
      // Today or yesterday (still open for checking) and nothing missed yet: keep the streak.
    } else {
      current = 0;
    }
  }
  return { current, best };
}

/** Everything earned so far, as stable ids (used to celebrate each one once). */
export function earnedMedalIds(attendance: AttendanceMap, todayStr: string, bestStreak: number): string[] {
  const thisMonth = todayStr.slice(0, 7);
  const ids = medalMonths(attendance, thisMonth)
    .filter((m) => m.month < thisMonth && m.tier)
    .map((m) => `month:${m.month}:${m.tier}`);
  STREAK_MILESTONES.filter((n) => bestStreak >= n).forEach((n) => ids.push(`streakday:${n}`));
  return ids;
}
