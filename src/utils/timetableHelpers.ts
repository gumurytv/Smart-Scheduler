import {
  DayOfWeek,
  MasterTimetable,
  DailyOverrides,
  SchoolPeriod,
  AcademyOverrideItem,
} from '../types';
import { getDayOfWeekKor } from '../data/initialData';

export interface ResolvedSchoolPeriod extends SchoolPeriod {
  originalSubject: string;
  isModified: boolean;
  isCancelled: boolean;
  isOverlapping: boolean;
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
