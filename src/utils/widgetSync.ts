import { AppLanguage, PlannerState, ScheduleItem } from '../types';
import { formatDateKey, getDayOfWeekKor } from '../data/initialData';
import { resolveDailyTimetable } from './timetableHelpers';
import {
  translateDay,
  translateSubject,
  translateSampleText,
  translateAttendanceStatus,
  formatDateLabel,
} from '../i18n/translations';

export const WIDGET_STORAGE_KEY = 'WIDGET_SYNC_DATA';

export interface WidgetSyncPayload {
  syncedAt: string;
  /** UI language the localized *Label fields were rendered in. */
  language: AppLanguage;
  date: string;
  /** Localized date, e.g. `10월 15일 (목)` / `Oct 15 (Thu)` / `10月15日 (周四)`. */
  dateLabel: string;
  /** Korean weekday key ('월'…'일'), kept as an identifier. */
  dayOfWeek: string;
  dayOfWeekLabel: string;
  schoolTimetable: Array<{
    period: number;
    startTime: string;
    endTime: string;
    subject: string;
    subjectLabel: string;
    isCancelled: boolean;
    isModified: boolean;
  }>;
  academyTimetable: Array<{
    id: string;
    startTime: string;
    endTime: string;
    subject: string;
    subjectLabel: string;
    isCancelled: boolean;
    isAdded: boolean;
    isOverlapping: boolean;
  }>;
  todaySchedules: Array<{
    id: string;
    title: string;
    titleLabel: string;
    category: ScheduleItem['category'];
    time?: string;
  }>;
  attendanceSummary: {
    todaySchoolStatus: string | null;
    todaySchoolStatusLabel: string | null;
    pendingMakeupCount: number;
  };
}

function isDateWithinSchedule(dateStr: string, item: ScheduleItem): boolean {
  if (!item.endDate || item.endDate <= item.date) {
    return item.date === dateStr;
  }
  return dateStr >= item.date && dateStr <= item.endDate;
}

export function buildWidgetSyncPayload(
  state: PlannerState,
  targetDate: Date = new Date()
): WidgetSyncPayload {
  const lang: AppLanguage = state.language || 'ko';
  const dateStr = formatDateKey(targetDate);
  const dayOfWeek = getDayOfWeekKor(targetDate);
  const resolved = resolveDailyTimetable(
    dateStr,
    state.masterTimetable,
    state.dailyOverrides
  );

  const todaySchedules = state.schedules
    .filter((s) => isDateWithinSchedule(dateStr, s))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    .map((s) => ({
      id: s.id,
      title: s.title,
      titleLabel: translateSampleText(s.title, lang),
      category: s.category,
      time: s.time,
    }));

  const pendingMakeupCount = Object.values(state.attendance).reduce((acc, dayAtt) => {
    if (!dayAtt.academies) return acc;
    const count = Object.values(dayAtt.academies).filter(
      (r) => r.needsMakeup && !r.makeupCompleted
    ).length;
    return acc + count;
  }, 0);

  const todaySchoolStatus = state.attendance[dateStr]?.school?.status || null;

  return {
    syncedAt: new Date().toISOString(),
    language: lang,
    date: dateStr,
    dateLabel: formatDateLabel(targetDate, lang),
    dayOfWeek,
    dayOfWeekLabel: translateDay(dayOfWeek, lang),
    schoolTimetable: resolved.school.map((s) => ({
      period: s.period,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      subjectLabel: translateSubject(s.subject, lang),
      isCancelled: s.isCancelled,
      isModified: s.isModified,
    })),
    academyTimetable: resolved.academy.map((a) => ({
      id: a.id,
      startTime: a.startTime,
      endTime: a.endTime,
      subject: a.subject,
      subjectLabel: translateSubject(a.subject, lang),
      isCancelled: a.isCancelled,
      isAdded: a.isAdded,
      isOverlapping: a.isOverlapping,
    })),
    todaySchedules,
    attendanceSummary: {
      todaySchoolStatus,
      todaySchoolStatusLabel: todaySchoolStatus
        ? translateAttendanceStatus(todaySchoolStatus, lang)
        : null,
      pendingMakeupCount,
    },
  };
}

export function syncWidgetData(state: PlannerState): WidgetSyncPayload {
  const payload = buildWidgetSyncPayload(state, new Date());
  const jsonString = JSON.stringify(payload);

  try {
    localStorage.setItem(WIDGET_STORAGE_KEY, jsonString);
  } catch (e) {
    console.error('Failed to save WIDGET_SYNC_DATA to localStorage:', e);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).AndroidWidgetBridge?.updateWidget(jsonString);
  } catch (e) {
    console.warn('AndroidWidgetBridge.updateWidget call skipped or failed:', e);
  }

  return payload;
}
