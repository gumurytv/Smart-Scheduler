import {
  DayOfWeek,
  MasterTimetable,
  DailyOverrides,
  SchoolPeriod,
  AcademyOverrideItem,
  SlotStatus,
  ScheduleItem,
  SchoolTimeConfig,
} from '../types';
import { getDayOfWeekKor } from '../data/initialData';

export interface ResolvedSchoolPeriod extends SchoolPeriod {
  originalSubject: string;
  isModified: boolean;
  isCancelled: boolean;
  isOverlapping: boolean;
  status?: SlotStatus;
  note?: string;
}

export interface ResolvedAcademyItem {
  id: string;
  masterId?: string;
  startTime: string;
  endTime: string;
  subject: string;
  originalSubject?: string;
  originalStartTime?: string;
  originalEndTime?: string;
  isModified: boolean;
  isCancelled: boolean;
  isAdded: boolean;
  isOverlapping: boolean;
  status?: SlotStatus;
  note?: string;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

export function isTimeInRange(nowMinutes: number, startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return nowMinutes >= start && nowMinutes <= end;
}

export function resolveDailyTimetable(
  dateStr: string,
  masterTimetable: MasterTimetable,
  dailyOverrides: DailyOverrides
): {
  dayOfWeek: DayOfWeek;
  school: ResolvedSchoolPeriod[];
  academy: ResolvedAcademyItem[];
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = getDayOfWeekKor(dateObj);

  const dayMaster = masterTimetable[dayOfWeek] || { school: [], academy: [] };
  const dayOverride = dailyOverrides[dateStr];

  // 1. Resolve raw School Periods
  const rawSchool: Omit<ResolvedSchoolPeriod, 'isOverlapping'>[] = dayMaster.school.map((item) => {
    const ov = dayOverride?.school?.[item.period];
    if (!ov) {
      return {
        ...item,
        originalSubject: item.subject,
        isModified: false,
        isCancelled: false,
      };
    }
    const isCancelled = Boolean(ov.isCancelled);
    const isModified = isCancelled || ov.subject !== item.subject;
    return {
      ...item,
      subject: ov.subject,
      originalSubject: item.subject,
      isModified,
      isCancelled,
      status: ov.status ?? (isCancelled ? 'cancelled' : undefined),
      note: ov.note,
    };
  });

  // 2. Resolve raw Academy Items
  let rawAcademyList: Omit<ResolvedAcademyItem, 'isOverlapping'>[] = [];

  if (dayOverride?.academy) {
    const overrideByMasterId = new Map<string, AcademyOverrideItem>();
    const addedItems: AcademyOverrideItem[] = [];

    for (const ovItem of dayOverride.academy) {
      if (ovItem.masterId) {
        overrideByMasterId.set(ovItem.masterId, ovItem);
      } else if (ovItem.isAdded) {
        addedItems.push(ovItem);
      }
    }

    for (const masterItem of dayMaster.academy) {
      const ov = overrideByMasterId.get(masterItem.id);
      if (!ov) {
        rawAcademyList.push({
          id: masterItem.id,
          masterId: masterItem.id,
          startTime: masterItem.startTime,
          endTime: masterItem.endTime,
          subject: masterItem.subject,
          originalSubject: masterItem.subject,
          originalStartTime: masterItem.startTime,
          originalEndTime: masterItem.endTime,
          isModified: false,
          isCancelled: false,
          isAdded: false,
        });
      } else {
        const isCancelled = Boolean(ov.isCancelled);
        const isModified =
          isCancelled ||
          ov.subject !== masterItem.subject ||
          ov.startTime !== masterItem.startTime ||
          ov.endTime !== masterItem.endTime;

        rawAcademyList.push({
          id: ov.id || masterItem.id,
          masterId: masterItem.id,
          startTime: ov.startTime,
          endTime: ov.endTime,
          subject: ov.subject,
          originalSubject: masterItem.subject,
          originalStartTime: masterItem.startTime,
          originalEndTime: masterItem.endTime,
          isModified,
          isCancelled,
          isAdded: false,
          status: ov.status ?? (isCancelled ? 'cancelled' : undefined),
          note: ov.note,
        });
      }
    }

    for (const added of addedItems) {
      rawAcademyList.push({
        id: added.id,
        startTime: added.startTime,
        endTime: added.endTime,
        subject: added.subject,
        isModified: true,
        isCancelled: Boolean(added.isCancelled),
        isAdded: true,
        status: added.status ?? (added.isCancelled ? 'cancelled' : undefined),
        note: added.note,
      });
    }
  } else {
    rawAcademyList = dayMaster.academy.map((masterItem) => ({
      id: masterItem.id,
      masterId: masterItem.id,
      startTime: masterItem.startTime,
      endTime: masterItem.endTime,
      subject: masterItem.subject,
      originalSubject: masterItem.subject,
      originalStartTime: masterItem.startTime,
      originalEndTime: masterItem.endTime,
      isModified: false,
      isCancelled: false,
      isAdded: false,
    }));
  }

  rawAcademyList.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Build unified active intervals to detect any time overlap across school AND academy classes
  const activeUnified = [
    ...rawSchool
      .filter((s) => !s.isCancelled)
      .map((s) => ({
        uid: `school-${s.period}`,
        start: timeToMinutes(s.startTime),
        end: timeToMinutes(s.endTime),
      })),
    ...rawAcademyList
      .filter((a) => !a.isCancelled)
      .map((a) => ({
        uid: `academy-${a.id}`,
        start: timeToMinutes(a.startTime),
        end: timeToMinutes(a.endTime),
      })),
  ];

  const hasOverlapWithOthers = (uid: string, start: number, end: number): boolean => {
    for (const other of activeUnified) {
      if (other.uid === uid) continue;
      if (start < other.end && end > other.start) {
        return true;
      }
    }
    return false;
  };

  const school: ResolvedSchoolPeriod[] = rawSchool.map((item) => {
    if (item.isCancelled) {
      return { ...item, isOverlapping: false };
    }
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    return {
      ...item,
      isOverlapping: hasOverlapWithOthers(`school-${item.period}`, start, end),
    };
  });

  const academy: ResolvedAcademyItem[] = rawAcademyList.map((item) => {
    if (item.isCancelled) {
      return { ...item, isOverlapping: false };
    }
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);
    return {
      ...item,
      isOverlapping: hasOverlapWithOthers(`academy-${item.id}`, start, end),
    };
  });

  return { dayOfWeek, school, academy };
}

// ===================== Time overlap check (보강·일정 등록 시 겹침 알림) =====================

export interface TimeConflict {
  kind: 'school' | 'academy' | 'schedule';
  /** Untranslated subject / title; the caller localizes it. */
  name: string;
  period?: number;
  startTime: string;
  endTime?: string;
}

function scheduleOnDate(dateStr: string, item: ScheduleItem): boolean {
  if (!item.endDate || item.endDate <= item.date) return item.date === dateStr;
  return dateStr >= item.date && dateStr <= item.endDate;
}

/**
 * What already takes place on `dateStr` during start–end (or at `start` when there's no end):
 * school periods and academy classes that aren't cancelled, and events with a time.
 */
export function findTimeConflicts(opts: {
  dateStr: string;
  start: string;
  end?: string;
  masterTimetable: MasterTimetable;
  dailyOverrides: DailyOverrides;
  schedules?: ScheduleItem[];
  ignoreAcademyId?: string;
  ignoreScheduleId?: string;
}): TimeConflict[] {
  const s = timeToMinutes(opts.start);
  const rawEnd = opts.end ? timeToMinutes(opts.end) : s;
  const e = rawEnd > s ? rawEnd : s + 1;
  const overlaps = (a: number, b: number) => s < b && a < e;
  const day = resolveDailyTimetable(opts.dateStr, opts.masterTimetable, opts.dailyOverrides);
  const out: TimeConflict[] = [];

  day.school.forEach((p) => {
    if (p.isCancelled || !p.subject.trim()) return;
    if (overlaps(timeToMinutes(p.startTime), timeToMinutes(p.endTime))) {
      out.push({ kind: 'school', name: p.subject, period: p.period, startTime: p.startTime, endTime: p.endTime });
    }
  });
  day.academy.forEach((a) => {
    if (a.isCancelled || a.id === opts.ignoreAcademyId) return;
    if (overlaps(timeToMinutes(a.startTime), timeToMinutes(a.endTime))) {
      out.push({ kind: 'academy', name: a.subject, startTime: a.startTime, endTime: a.endTime });
    }
  });
  (opts.schedules || []).forEach((it) => {
    if (!it.time || it.id === opts.ignoreScheduleId || !scheduleOnDate(opts.dateStr, it)) return;
    const t = timeToMinutes(it.time);
    if (overlaps(t, t + 1)) out.push({ kind: 'schedule', name: it.title, startTime: it.time });
  });
  return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Lunch break on a school day: preset mode puts it after `lunchAfterPeriod` for `lunchMinutes`;
 * custom mode uses the start/end the user set. Null on days without school periods.
 */
export function getLunchRange(
  config: SchoolTimeConfig | undefined,
  school: Array<{ period: number; endTime: string; subject: string }>
): { start: string; end: string } | null {
  if (!config || !school.some((p) => p.subject.trim())) return null;
  if (config.mode === 'custom') {
    const l = config.customLunch;
    if (!l?.enabled || timeToMinutes(l.end) <= timeToMinutes(l.start)) return null;
    return { start: l.start, end: l.end };
  }
  const before = school.find((p) => p.period === config.lunchAfterPeriod);
  if (!before || config.lunchMinutes <= 0 || config.lunchAfterPeriod >= config.periodCount) return null;
  const start = timeToMinutes(before.endTime);
  const end = Math.min(1440, start + config.lunchMinutes);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { start: before.endTime, end: fmt(end) };
}
