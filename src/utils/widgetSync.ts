import {
  AppLanguage,
  DAYS_OF_WEEK,
  DEFAULT_WIDGET_CONFIG,
  DayOfWeek,
  HOME_WIDGET_IDS,
  HomeWidgetId,
  PlannerState,
  ScheduleCategory,
  ScheduleItem,
  SlotStatus,
  WidgetConfig,
} from '../types';
import { addDays, formatDateKey, getDayOfWeekKor, getMondayOfCurrentWeek } from '../data/initialData';
import { resolveDailyTimetable, timeToMinutes } from './timetableHelpers';
import {
  tr,
  translateDay,
  translateSubject,
  translateSampleText,
  translateAttendanceStatus,
  formatDateLabel,
  formatYearMonthLabel,
} from '../i18n/translations';
import { pushNowWidget } from '../native/nowWidget';

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
  /** Home-screen widgets the user picked (Settings → 홈 화면 위젯) + the data each one needs. */
  widgets: HomeWidgetsPayload;
}

// ===================== Home-screen widget data =====================

export interface WidgetSlotInfo {
  startTime: string;
  endTime: string;
  subject: string;
  subjectLabel: string;
  isCancelled: boolean;
  isModified: boolean;
  status?: SlotStatus;
  statusLabel?: string;
  note?: string;
}

export interface WeeklySchoolWidgetData {
  title: string;
  weekStart: string;
  periodCount: number;
  /** Localized period labels, index 0 = period 1 (`1교시` / `P1` / `第1节`). */
  periodLabels: string[];
  days: Array<{
    day: DayOfWeek;
    dayLabel: string;
    date: string;
    dayNum: number;
    isToday: boolean;
    /** Index 0 = period 1; null when that day has no such period. */
    periods: Array<(WidgetSlotInfo & { period: number }) | null>;
  }>;
}

export interface WeeklyAcademyWidgetData {
  title: string;
  weekStart: string;
  days: Array<{
    day: DayOfWeek;
    dayLabel: string;
    date: string;
    dayNum: number;
    isToday: boolean;
    items: Array<WidgetSlotInfo & { id: string; isAdded: boolean; isOverlapping: boolean }>;
  }>;
}

export interface NowWidgetEntry {
  kind: 'school' | 'academy';
  startTime: string;
  endTime: string;
  title: string;
  badge: string;
  status?: SlotStatus;
  statusLabel?: string;
  progressPct: number;
  remainingMin: number;
  remainingLabel: string;
  startsInMin: number;
  startsInLabel: string;
}

export interface NowWidgetData {
  generatedAt: string;
  timeLabel: string;
  dateLabel: string;
  current: NowWidgetEntry[];
  next: NowWidgetEntry | null;
  makeups: Array<{
    id: string;
    startTime: string;
    endTime: string;
    subjectLabel: string;
    isCancelled: boolean;
    status?: SlotStatus;
    statusLabel?: string;
  }>;
  makeupSchedules: Array<{ id: string; time?: string; titleLabel: string }>;
}

export type TimelinePhase = 'past' | 'current' | 'upcoming';

export interface TimelineWidgetItem {
  key: string;
  kind: 'school' | 'academy' | 'schedule';
  kindLabel: string;
  startTime: string;
  endTime: string;
  title: string;
  isCancelled: boolean;
  isAdded: boolean;
  status?: SlotStatus;
  statusLabel?: string;
  note?: string;
  phase: TimelinePhase;
}

export interface TimelineWidgetData {
  date: string;
  dateLabel: string;
  nowTime: string;
  startHour: number;
  endHour: number;
  items: TimelineWidgetItem[];
  freeSlots: Array<{ startTime: string; endTime: string; durationMin: number; durationLabel: string }>;
  totalFreeLabel: string;
}

export interface MonthCalendarWidgetData {
  year: number;
  month: number; // 1-12
  title: string;
  /** Sunday-first localized weekday headers. */
  weekHeader: string[];
  cells: Array<{
    date: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    counts: Record<ScheduleCategory, number>;
    titles: Array<{ titleLabel: string; category: ScheduleCategory; time?: string }>;
  }>;
}

export interface HomeWidgetsData {
  weeklySchool?: WeeklySchoolWidgetData;
  weeklyAcademy?: WeeklyAcademyWidgetData;
  now?: NowWidgetData;
  timeline?: TimelineWidgetData;
  monthCalendar?: MonthCalendarWidgetData;
}

export interface HomeWidgetsPayload {
  enabled: HomeWidgetId[];
  theme: WidgetConfig['theme'];
  data: HomeWidgetsData;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function minutesToTimeStr(total: number): string {
  const c = Math.max(0, Math.min(1440, Math.round(total)));
  return `${pad2(Math.floor(c / 60))}:${pad2(c % 60)}`;
}

export function formatWidgetDuration(minutes: number, lang: AppLanguage): string {
  if (minutes <= 0) return tr(lang, '0분', '0m', '0分');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return tr(lang, `${h}시간 ${m}분`, `${h}h ${m}m`, `${h}小时${m}分`);
  if (h > 0) return tr(lang, `${h}시간`, `${h}h`, `${h}小时`);
  return tr(lang, `${m}분`, `${m}m`, `${m}分`);
}

export function widgetStatusLabel(status: SlotStatus | undefined, lang: AppLanguage): string | undefined {
  if (!status) return undefined;
  if (status === 'cancelled') return tr(lang, '휴강', 'Cancelled', '停课');
  if (status === 'absent') return tr(lang, '결석', 'Absent', '缺席');
  return tr(lang, '자습', 'Self-Study', '自习');
}

function slotTitle(subject: string, status: SlotStatus | undefined, lang: AppLanguage): string {
  if (status === 'selfStudy') return tr(lang, '자습', 'Self-Study', '自习');
  return translateSubject(subject, lang);
}

function periodLabel(period: number, lang: AppLanguage): string {
  return tr(lang, `${period}교시`, `P${period}`, `第${period}节`);
}

/** Resolved, normalized widget config (falls back to DEFAULT_WIDGET_CONFIG; keeps HOME_WIDGET_IDS order). */
export function getWidgetConfig(state: PlannerState): WidgetConfig {
  const cfg = state.widgetConfig ?? DEFAULT_WIDGET_CONFIG;
  const enabledSet = new Set(Array.isArray(cfg.enabled) ? cfg.enabled : DEFAULT_WIDGET_CONFIG.enabled);
  return {
    enabled: HOME_WIDGET_IDS.filter((id) => enabledSet.has(id)),
    theme: cfg.theme === 'dark' ? 'dark' : 'light',
  };
}

function buildWeekDays(now: Date) {
  const monday = getMondayOfCurrentWeek(now);
  const todayStr = formatDateKey(now);
  return DAYS_OF_WEEK.map((day, idx) => {
    const d = addDays(monday, idx);
    const date = formatDateKey(d);
    return { day, date, dayNum: d.getDate(), isToday: date === todayStr };
  });
}

function buildWeeklySchool(state: PlannerState, now: Date, lang: AppLanguage): WeeklySchoolWidgetData {
  const week = buildWeekDays(now).slice(0, 5);
  const resolvedDays = week.map((wd) => ({
    wd,
    resolved: resolveDailyTimetable(wd.date, state.masterTimetable, state.dailyOverrides),
  }));
  const periodCount = Math.max(
    1,
    ...resolvedDays.flatMap((r) => r.resolved.school.map((s) => s.period))
  );
  return {
    title: tr(lang, '주간 학교 시간표', 'Weekly School', '每周学校课表'),
    weekStart: week[0].date,
    periodCount,
    periodLabels: Array.from({ length: periodCount }, (_, i) => periodLabel(i + 1, lang)),
    days: resolvedDays.map(({ wd, resolved }) => ({
      day: wd.day,
      dayLabel: translateDay(wd.day, lang),
      date: wd.date,
      dayNum: wd.dayNum,
      isToday: wd.isToday,
      periods: Array.from({ length: periodCount }, (_, i) => {
        const cell = resolved.school.find((s) => s.period === i + 1);
        if (!cell) return null;
        return {
          period: cell.period,
          startTime: cell.startTime,
          endTime: cell.endTime,
          subject: cell.subject,
          subjectLabel: slotTitle(cell.subject, cell.status, lang),
          isCancelled: cell.isCancelled,
          isModified: cell.isModified,
          status: cell.status,
          statusLabel: widgetStatusLabel(cell.status, lang),
          note: cell.note,
        };
      }),
    })),
  };
}

function buildWeeklyAcademy(state: PlannerState, now: Date, lang: AppLanguage): WeeklyAcademyWidgetData {
  const week = buildWeekDays(now);
  return {
    title: tr(lang, '주간 학원 시간표', 'Weekly Academies', '每周补习班课表'),
    weekStart: week[0].date,
    days: week.map((wd) => {
      const resolved = resolveDailyTimetable(wd.date, state.masterTimetable, state.dailyOverrides);
      return {
        day: wd.day,
        dayLabel: translateDay(wd.day, lang),
        date: wd.date,
        dayNum: wd.dayNum,
        isToday: wd.isToday,
        items: resolved.academy.map((a) => ({
          id: a.id,
          startTime: a.startTime,
          endTime: a.endTime,
          subject: a.subject,
          subjectLabel: slotTitle(a.subject, a.status, lang),
          isCancelled: a.isCancelled,
          isModified: a.isModified,
          isAdded: a.isAdded,
          isOverlapping: a.isOverlapping,
          status: a.status,
          statusLabel: widgetStatusLabel(a.status, lang),
          note: a.note,
        })),
      };
    }),
  };
}

function buildNow(state: PlannerState, now: Date, lang: AppLanguage): NowWidgetData {
  const todayStr = formatDateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const resolved = resolveDailyTimetable(todayStr, state.masterTimetable, state.dailyOverrides);

  const raw = [
    ...resolved.school
      .filter((s) => !s.isCancelled && s.subject.trim() !== '')
      .map((s) => ({
        kind: 'school' as const,
        startTime: s.startTime,
        endTime: s.endTime,
        title: `${periodLabel(s.period, lang)} · ${slotTitle(s.subject, s.status, lang)}`,
        badge: tr(lang, `학교 ${s.period}교시`, `School · P${s.period}`, `学校 第${s.period}节`),
        status: s.status,
      })),
    ...resolved.academy
      .filter((a) => !a.isCancelled)
      .map((a) => ({
        kind: 'academy' as const,
        startTime: a.startTime,
        endTime: a.endTime,
        title: slotTitle(a.subject, a.status, lang),
        badge: a.isAdded
          ? tr(lang, '학원 보강/특강', 'Academy · Makeup', '补习班 补课/特讲')
          : tr(lang, '학원', 'Academy', '补习班'),
        status: a.status,
      })),
  ]
    .map((e) => {
      const start = timeToMinutes(e.startTime);
      const end = timeToMinutes(e.endTime);
      const total = Math.max(1, end - start);
      const elapsed = Math.min(total, Math.max(0, nowMin - start));
      const remainingMin = Math.max(0, end - nowMin);
      const startsInMin = Math.max(0, start - nowMin);
      const entry: NowWidgetEntry & { start: number; end: number } = {
        ...e,
        start,
        end,
        statusLabel: widgetStatusLabel(e.status, lang),
        progressPct: Math.round((elapsed / total) * 100),
        remainingMin,
        remainingLabel: formatWidgetDuration(remainingMin, lang),
        startsInMin,
        startsInLabel: formatWidgetDuration(startsInMin, lang),
      };
      return entry;
    })
    .sort((a, b) => a.start - b.start);

  const strip = ({ start: _s, end: _e, ...rest }: NowWidgetEntry & { start: number; end: number }) => rest;
  const current = raw.filter((e) => e.start <= nowMin && nowMin < e.end).map(strip);
  const nextRaw = raw.find((e) => e.start > nowMin);

  return {
    generatedAt: now.toISOString(),
    timeLabel: minutesToTimeStr(nowMin),
    dateLabel: formatDateLabel(now, lang),
    current,
    next: nextRaw ? strip(nextRaw) : null,
    makeups: resolved.academy
      .filter((a) => a.isAdded)
      .map((a) => ({
        id: a.id,
        startTime: a.startTime,
        endTime: a.endTime,
        subjectLabel: slotTitle(a.subject, a.status, lang),
        isCancelled: a.isCancelled,
        status: a.status,
        statusLabel: widgetStatusLabel(a.status, lang),
      })),
    makeupSchedules: state.schedules
      .filter((s) => isDateWithinSchedule(todayStr, s) && s.category === 'academy' && s.title.includes('보강'))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
      .map((s) => ({ id: s.id, time: s.time, titleLabel: translateSampleText(s.title, lang) })),
  };
}

function buildTimeline(state: PlannerState, now: Date, lang: AppLanguage): TimelineWidgetData {
  const todayStr = formatDateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startHour = state.timelineConfig?.startHour ?? 8;
  const endHour = Math.max(startHour + 2, state.timelineConfig?.endHour ?? 24);
  const rangeStart = startHour * 60;
  const rangeEnd = endHour * 60;
  const resolved = resolveDailyTimetable(todayStr, state.masterTimetable, state.dailyOverrides);

  const phaseOf = (start: number, end: number): TimelinePhase =>
    nowMin >= end ? 'past' : nowMin >= start ? 'current' : 'upcoming';

  const items: TimelineWidgetItem[] = [
    ...resolved.school
      .filter((s) => s.subject.trim() !== '')
      .map((s) => ({
        key: `school-${s.period}`,
        kind: 'school' as const,
        kindLabel: periodLabel(s.period, lang),
        startTime: s.startTime,
        endTime: s.endTime,
        title: slotTitle(s.subject, s.status, lang),
        isCancelled: s.isCancelled,
        isAdded: false,
        status: s.status,
        statusLabel: widgetStatusLabel(s.status, lang),
        note: s.note,
        phase: phaseOf(timeToMinutes(s.startTime), timeToMinutes(s.endTime)),
      })),
    ...resolved.academy.map((a) => ({
      key: `academy-${a.id}`,
      kind: 'academy' as const,
      kindLabel: a.isAdded
        ? tr(lang, '보강/특강', 'Makeup', '补课/特讲')
        : tr(lang, '학원', 'Academy', '补习班'),
      startTime: a.startTime,
      endTime: a.endTime,
      title: slotTitle(a.subject, a.status, lang),
      isCancelled: a.isCancelled,
      isAdded: a.isAdded,
      status: a.status,
      statusLabel: widgetStatusLabel(a.status, lang),
      note: a.note,
      phase: phaseOf(timeToMinutes(a.startTime), timeToMinutes(a.endTime)),
    })),
    ...state.schedules
      .filter((s) => isDateWithinSchedule(todayStr, s) && s.time)
      .map((s) => ({
        key: `schedule-${s.id}`,
        kind: 'schedule' as const,
        kindLabel: tr(lang, '일정', 'Event', '日程'),
        startTime: s.time as string,
        endTime: s.time as string,
        title: translateSampleText(s.title, lang),
        isCancelled: false,
        isAdded: false,
        note: s.memo ? translateSampleText(s.memo, lang) : undefined,
        phase: phaseOf(timeToMinutes(s.time as string), timeToMinutes(s.time as string) + 1),
      })),
  ].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Free slots: gaps >= 20 min between active school/academy classes inside the timeline range
  const occupied = [...resolved.school, ...resolved.academy]
    .filter((x) => !x.isCancelled && x.subject.trim() !== '')
    .map((x) => ({
      start: Math.max(rangeStart, timeToMinutes(x.startTime)),
      end: Math.min(rangeEnd, timeToMinutes(x.endTime)),
    }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const iv of occupied) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  const freeSlots: TimelineWidgetData['freeSlots'] = [];
  let cursor = rangeStart;
  const pushGap = (from: number, to: number) => {
    if (to - from >= 20) {
      freeSlots.push({
        startTime: minutesToTimeStr(from),
        endTime: minutesToTimeStr(to),
        durationMin: to - from,
        durationLabel: formatWidgetDuration(to - from, lang),
      });
    }
  };
  for (const occ of merged) {
    if (occ.start > cursor) pushGap(cursor, occ.start);
    cursor = Math.max(cursor, occ.end);
  }
  if (cursor < rangeEnd) pushGap(cursor, rangeEnd);
  const totalFree = Math.max(
    0,
    rangeEnd - rangeStart - merged.reduce((acc, m) => acc + (m.end - m.start), 0)
  );

  return {
    date: todayStr,
    dateLabel: formatDateLabel(now, lang),
    nowTime: minutesToTimeStr(nowMin),
    startHour,
    endHour,
    items,
    freeSlots,
    totalFreeLabel: formatWidgetDuration(totalFree, lang),
  };
}

function buildMonthCalendar(state: PlannerState, now: Date, lang: AppLanguage): MonthCalendarWidgetData {
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = formatDateKey(now);
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((startWeekday + totalDays) / 7) * 7;

  const cells: MonthCalendarWidgetData['cells'] = [];
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(year, month, 1 - startWeekday + i);
    const date = formatDateKey(d);
    const events = state.schedules
      .filter((s) => isDateWithinSchedule(date, s))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    const counts: Record<ScheduleCategory, number> = { school: 0, academy: 0, other: 0 };
    events.forEach((e) => {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
    });
    cells.push({
      date,
      dayNum: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: date === todayStr,
      counts,
      titles: events.map((e) => ({
        titleLabel: translateSampleText(e.title, lang),
        category: e.category,
        time: e.time,
      })),
    });
  }

  return {
    year,
    month: month + 1,
    title: formatYearMonthLabel(now, lang),
    weekHeader: (['일', '월', '화', '수', '목', '금', '토'] as DayOfWeek[]).map((d) =>
      translateDay(d, lang).replace('周', '')
    ),
    cells,
  };
}

/**
 * Builds the data for the given home-screen widgets (all five when `ids` is omitted).
 * Used both by the native widget payload and by the in-app preview gallery.
 */
export function buildHomeWidgetsData(
  state: PlannerState,
  now: Date = new Date(),
  ids: HomeWidgetId[] = HOME_WIDGET_IDS
): HomeWidgetsData {
  const lang: AppLanguage = state.language || 'ko';
  const data: HomeWidgetsData = {};
  if (ids.includes('weeklySchool')) data.weeklySchool = buildWeeklySchool(state, now, lang);
  if (ids.includes('weeklyAcademy')) data.weeklyAcademy = buildWeeklyAcademy(state, now, lang);
  if (ids.includes('now')) data.now = buildNow(state, now, lang);
  if (ids.includes('timeline')) data.timeline = buildTimeline(state, now, lang);
  if (ids.includes('monthCalendar')) data.monthCalendar = buildMonthCalendar(state, now, lang);
  return data;
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
    widgets: (() => {
      const cfg = getWidgetConfig(state);
      return {
        enabled: cfg.enabled,
        theme: cfg.theme,
        data: buildHomeWidgetsData(state, targetDate, cfg.enabled),
      };
    })(),
  };
}

// ===================== Native 「지금」 widget =====================

/**
 * Payload for the Android 「지금」 widget. The widget runs while the app is closed, so instead
 * of a snapshot of "now" it gets the classes of the next 8 days and works out the current and
 * next class from the clock itself. Labels are pre-translated; `{d}` marks a duration.
 */
export interface NativeNowWidgetPayload {
  v: 1;
  lang: AppLanguage;
  labels: Record<
    | 'now'
    | 'next'
    | 'tomorrow'
    | 'free'
    | 'untilNextTpl'
    | 'leftTpl'
    | 'laterTpl'
    | 'done'
    | 'doneSub'
    | 'none'
    | 'noneSub',
    string
  >;
  dur: { h: string; m: string; sep: string };
  days: Array<{
    date: string;
    dateLabel: string;
    /** Sorted by start. s/e = HH:MM, t = title, b = badge (e.g. 학교 3교시). */
    items: Array<{ s: string; e: string; t: string; b: string }>;
  }>;
}

export function buildNativeNowWidget(state: PlannerState, now: Date = new Date()): NativeNowWidgetPayload {
  const lang: AppLanguage = state.language || 'ko';
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = addDays(now, i);
    const date = formatDateKey(d);
    const resolved = resolveDailyTimetable(date, state.masterTimetable, state.dailyOverrides);
    const items = [
      ...resolved.school
        .filter((x) => !x.isCancelled && x.subject.trim() !== '')
        .map((x) => ({
          s: x.startTime,
          e: x.endTime,
          t: `${periodLabel(x.period, lang)} · ${slotTitle(x.subject, x.status, lang)}`,
          b: tr(lang, `학교 ${x.period}교시`, `School · P${x.period}`, `学校 第${x.period}节`),
        })),
      ...resolved.academy
        .filter((x) => !x.isCancelled)
        .map((x) => ({
          s: x.startTime,
          e: x.endTime,
          t: slotTitle(x.subject, x.status, lang),
          b: x.isAdded
            ? tr(lang, '학원 보강/특강', 'Academy · Makeup', '补习班 补课/特讲')
            : tr(lang, '학원', 'Academy', '补习班'),
        })),
    ].sort((a, b) => timeToMinutes(a.s) - timeToMinutes(b.s));
    return { date, dateLabel: formatDateLabel(d, lang), items };
  });

  return {
    v: 1,
    lang,
    labels: {
      now: tr(lang, '지금', 'Now', '现在'),
      next: tr(lang, '다음', 'Next', '下一节'),
      tomorrow: tr(lang, '내일', 'Tomorrow', '明天'),
      free: tr(lang, '지금은 빈 시간', 'Free time now', '现在是空闲时间'),
      untilNextTpl: tr(lang, '다음 수업까지 {d}', 'Next class in {d}', '距下节课还有{d}'),
      leftTpl: tr(lang, '{d} 남음', '{d} left', '剩余{d}'),
      laterTpl: tr(lang, '{d} 후', 'in {d}', '{d}后'),
      done: tr(lang, '오늘 일정 끝', 'All done for today', '今天的课程结束了'),
      doneSub: tr(lang, '오늘도 수고했어요', 'Great job today', '今天辛苦了'),
      none: tr(lang, '오늘은 수업이 없어요', 'No classes today', '今天没有课'),
      noneSub: tr(lang, '편하게 쉬어요', 'Enjoy your day', '好好休息'),
    },
    dur: lang === 'zh' ? { h: '小时', m: '分', sep: '' } : lang === 'en' ? { h: 'h', m: 'm', sep: ' ' } : { h: '시간', m: '분', sep: ' ' },
    days,
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

  pushNowWidget(JSON.stringify(buildNativeNowWidget(state)));

  return payload;
}
