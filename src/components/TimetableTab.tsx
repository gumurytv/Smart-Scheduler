import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Ban,
  Clock,
  GraduationCap,
  Building2,
  AlertTriangle,
  X,
  Trash2,
  Sparkles,
  AlignJustify,
  CalendarRange,
  StickyNote,
  CalendarClock,
  CalendarDays,
  LayoutGrid,
  Check,
  UserX,
  BookOpen,
  UserRound,
  PenLine,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  UserProfile,
  MasterTimetable,
  DailyOverrides,
  SubjectPool,
  AcademyOverrideItem,
  TimelineConfig,
  AppLanguage,
  ScheduleItem,
  ScheduleCategory,
  AttendanceMap,
  SlotStatus,
  SchoolPeriodOverride,
} from '../types';
import {
  formatDateKey,
  addDays,
  getMondayOfCurrentWeek,
  getDayOfWeekKor,
} from '../data/initialData';
import {
  resolveDailyTimetable,
  isTimeInRange,
  timeToMinutes,
  ResolvedSchoolPeriod,
  ResolvedAcademyItem,
  findTimeConflicts,
  TimeConflict,
} from '../utils/timetableHelpers';
import { ConflictDialog } from './ConflictDialog';
import { tr, translateDay, translateSubject, translateSampleText } from '../i18n/translations';

interface TimetableTabProps {
  language?: AppLanguage;
  subjectPool: SubjectPool;
  masterTimetable: MasterTimetable;
  dailyOverrides: DailyOverrides;
  timelineConfig?: TimelineConfig;
  onUpdateDailyOverrides: (updater: (prev: DailyOverrides) => DailyOverrides) => void;
  schedules?: ScheduleItem[];
  onUpdateSchedules?: (updater: (prev: ScheduleItem[]) => ScheduleItem[]) => void;
  attendance?: AttendanceMap;
  onUpdateAttendance?: (updater: (prev: AttendanceMap) => AttendanceMap) => void;
  profile?: UserProfile;
  onEditProfile?: () => void;
}

const HOUR_HEIGHT_PX = 84;

function minutesToTimeStr(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDurationLocalized(minutes: number, lang: AppLanguage): string {
  if (minutes <= 0) return tr(lang, '0분', '0m', '0分');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'en') {
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
  if (lang === 'zh') {
    if (h > 0 && m > 0) return `${h}小时${m}分`;
    if (h > 0) return `${h}小时`;
    return `${m}分`;
  }
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function getFreeSlotContextLabel(
  startMin: number,
  endMin: number,
  durationMin: number,
  lang: AppLanguage
): string {
  if (startMin <= 8 * 60 + 30 && endMin <= 9 * 60 + 30) {
    return tr(
      lang,
      '등교 준비 · 아침 여유 시간',
      'Morning Prep · Free Time',
      '上学准备 · 早晨空闲时间'
    );
  }
  if (startMin >= 12 * 60 && endMin <= 14 * 60 && durationMin >= 40) {
    return tr(lang, '점심식사 · 휴식 시간', 'Lunch & Break Time', '午餐与午休时间');
  }
  if (startMin >= 15 * 60 && endMin <= 19 * 60) {
    return tr(
      lang,
      '방과후 공강 · 이동/자습 여유',
      'After-School Gap · Transit / Study',
      '放学后空档 · 移动或自习时间'
    );
  }
  if (startMin >= 20 * 60) {
    return tr(
      lang,
      '야간 자유시간 · 자기주도학습',
      'Evening Free Time · Self-Study',
      '晚间自由时间 · 自主学习'
    );
  }
  return tr(lang, '비어있는 여유 시간', 'Available Free Time', '空闲可用时间');
}

interface FreeSlotInterval {
  startMin: number;
  endMin: number;
  durationMin: number;
  startTime: string;
  endTime: string;
  contextLabel: string;
}

interface ConflictZoneInterval {
  id: string;
  startMin: number;
  endMin: number;
  startTime: string;
  endTime: string;
  topPx: number;
  heightPx: number;
  involvedSubjects: string[];
}

interface SpectrumSegment {
  startMin: number;
  endMin: number;
  widthPercent: number;
  leftPercent: number;
  type: 'school' | 'academy' | 'free' | 'conflict';
  label: string;
}

type EditTarget =
  | { kind: 'school'; date: string; period: number }
  | { kind: 'academy'; date: string; id: string };

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateLabel(dateStr: string, lang: AppLanguage): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  const day = translateDay(getDayOfWeekKor(dateObj), lang);
  if (lang === 'en') return `${MONTHS_EN[m - 1]} ${d} (${day})`;
  if (lang === 'zh') return `${m}月${d}日 (${day})`;
  return `${m}월 ${d}일 (${day})`;
}

function getSchedulesForDate(schedules: ScheduleItem[] | undefined, dateStr: string): ScheduleItem[] {
  if (!schedules) return [];
  return schedules
    .filter((s) => {
      if (s.date === dateStr) return true;
      if (s.endDate && s.date <= dateStr && dateStr <= s.endDate) return true;
      return false;
    })
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

function statusLabel(status: SlotStatus, lang: AppLanguage): string {
  if (status === 'cancelled') return tr(lang, '휴강', 'Cancelled', '停课');
  if (status === 'absent') return tr(lang, '결석', 'Absent', '缺席');
  return tr(lang, '자습', 'Self-Study', '自习');
}

function slotTitle(subject: string, status: SlotStatus | undefined, lang: AppLanguage): string {
  if (status === 'selfStudy') return tr(lang, '자습', 'Self-Study', '自习');
  if (status === 'cancelled')
    return `${translateSubject(subject, lang)} (${tr(lang, '휴강', 'Cancelled', '停课')})`;
  return translateSubject(subject, lang);
}

function categoryLabel(cat: ScheduleCategory, lang: AppLanguage): string {
  if (cat === 'school') return tr(lang, '학교', 'School', '学校');
  if (cat === 'academy') return tr(lang, '학원', 'Academy', '补习班');
  return tr(lang, '기타', 'Other', '其他');
}

const StatusTag: React.FC<{ status?: SlotStatus; lang: AppLanguage; large?: boolean }> = ({
  status,
  lang,
  large,
}) => {
  if (!status || status === 'cancelled') return null;
  return (
    <span
      className={`${large ? 'px-2 py-0.5 text-[0.8125rem] shrink-0' : 'px-1.5 py-px text-[0.6875rem] leading-tight shrink-0'} font-bold rounded-full whitespace-nowrap ${
        status === 'absent' ? 'bg-accent-800 text-paper' : 'bg-sage-200 text-sage-900'
      }`}
    >
      {statusLabel(status, lang)}
    </span>
  );
};

const STATUS_OPTIONS: SlotStatus[] = ['cancelled', 'absent', 'selfStudy'];

const EN_MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FULL_WEEKDAYS: { ko: string; en: string; zh: string }[] = [
  { ko: '일요일', en: 'Sunday', zh: '星期日' },
  { ko: '월요일', en: 'Monday', zh: '星期一' },
  { ko: '화요일', en: 'Tuesday', zh: '星期二' },
  { ko: '수요일', en: 'Wednesday', zh: '星期三' },
  { ko: '목요일', en: 'Thursday', zh: '星期四' },
  { ko: '금요일', en: 'Friday', zh: '星期五' },
  { ko: '토요일', en: 'Saturday', zh: '星期六' },
];

function monthLabel(d: Date, lang: AppLanguage): string {
  const mo = d.getMonth() + 1;
  return tr(lang, `${mo}월`, EN_MONTHS_FULL[d.getMonth()], `${mo}月`);
}

function periodLabel(period: number, lang: AppLanguage): string {
  return tr(lang, `${period}교시`, `P${period}`, `第${period}节`);
}

function parseDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Weekday text tint for Sat / Sun (AA on paper/surface). */
function weekendTint(dayLabel: string): string {
  if (dayLabel === '일') return 'text-accent-700';
  if (dayLabel === '토') return 'text-sage-700';
  return '';
}

/** Caprasimo duration: big numerals with small localized units. */
const DurationNum: React.FC<{ minutes: number; lang: AppLanguage; size?: string }> = ({
  minutes,
  lang,
  size = 'text-[1.1875rem]',
}) => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hu = tr(lang, '시간', 'h', '小时');
  const mu = tr(lang, '분', 'm', '分');
  return (
    <span className="inline-flex items-baseline flex-wrap gap-x-0.5 leading-none">
      {h > 0 && (
        <>
          <span className={`font-mono ${size} tabular-nums`}>{h}</span>
          <span className="text-[0.6875rem] font-bold mr-1">{hu}</span>
        </>
      )}
      {(m > 0 || h === 0) && (
        <>
          <span className={`font-mono ${size} tabular-nums`}>{m}</span>
          <span className="text-[0.6875rem] font-bold">{mu}</span>
        </>
      )}
    </span>
  );
};

const SCHEDULE_CAT_TONE: Record<ScheduleCategory, { dot: string; pill: string }> = {
  school: { dot: 'bg-sage-600', pill: 'bg-sage-100 text-sage-900 border-sage-300' },
  academy: { dot: 'bg-accent', pill: 'bg-accent-100 text-accent-900 border-accent-300' },
  other: { dot: 'bg-other', pill: 'bg-other-100 text-other-800 border-other-300' },
};

export const TimetableTab: React.FC<TimetableTabProps> = ({
  language = 'ko',
  subjectPool,
  masterTimetable,
  dailyOverrides,
  timelineConfig,
  onUpdateDailyOverrides,
  schedules,
  onUpdateSchedules,
  onUpdateAttendance,
  profile,
  onEditProfile,
}) => {
  const lang = language;
  const startHour = timelineConfig?.startHour ?? 8;
  const endHour = timelineConfig?.endHour ?? 24;
  const totalHours = Math.max(2, endHour - startHour);
  const timelineStartMin = startHour * 60;
  const timelineEndMin = endHour * 60;
  const totalTimelineMinutes = timelineEndMin - timelineStartMin;

  const startHourFormatted = `${String(startHour).padStart(2, '0')}:00`;
  const endHourFormatted = `${String(endHour).padStart(2, '0')}:00`;

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = formatDateKey(now);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [dailySubMode, setDailySubMode] = useState<'timeline' | 'list'>('timeline');

  // Edit / add sheet targets (keyed by date so they work from the weekly view and the "Now" card too)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // source 'button' = top 보강/특강 추가 button (academy only, any date); 'canvas' = empty time slot
  const [addTarget, setAddTarget] = useState<{ date: string; source: 'button' | 'canvas' } | null>(null);
  // Save that overlaps something: ask before going ahead
  const [pendingConflict, setPendingConflict] = useState<{ conflicts: TimeConflict[]; proceed: () => void } | null>(null);
  const [addKind, setAddKind] = useState<'academy' | 'schedule'>('academy');
  const [tempStartTime, setTempStartTime] = useState<string>('17:00');
  const [tempEndTime, setTempEndTime] = useState<string>('19:00');
  const [tempAcademySubject, setTempAcademySubject] = useState<string>('');
  const [tempNote, setTempNote] = useState<string>('');
  const [newScheduleTitle, setNewScheduleTitle] = useState<string>('');
  const [newScheduleCategory, setNewScheduleCategory] = useState<ScheduleCategory>('other');
  const [newScheduleMemo, setNewScheduleMemo] = useState<string>('');

  const selectedDateStr = formatDateKey(selectedDate);
  const isSelectedToday = selectedDateStr === todayStr;

  const weekMonday = useMemo(() => getMondayOfCurrentWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => {
    return DAYS_OF_WEEK.map((dayLabel, idx) => {
      const dateObj = addDays(weekMonday, idx);
      const dateStr = formatDateKey(dateObj);
      return {
        dayLabel,
        dateObj,
        dateStr,
        dayNumber: dateObj.getDate(),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
      };
    });
  }, [weekMonday, todayStr, selectedDateStr]);

  const dailyData = useMemo(
    () => resolveDailyTimetable(selectedDateStr, masterTimetable, dailyOverrides),
    [selectedDateStr, masterTimetable, dailyOverrides]
  );

  const todayData = useMemo(
    () => resolveDailyTimetable(todayStr, masterTimetable, dailyOverrides),
    [todayStr, masterTimetable, dailyOverrides]
  );

  const editDateStr = editTarget?.date ?? addTarget?.date ?? selectedDateStr;
  const editResolved = useMemo(
    () => resolveDailyTimetable(editDateStr, masterTimetable, dailyOverrides),
    [editDateStr, masterTimetable, dailyOverrides]
  );
  const editingSchoolPeriod: ResolvedSchoolPeriod | null =
    editTarget?.kind === 'school'
      ? editResolved.school.find((s) => s.period === editTarget.period) ?? null
      : null;
  const editingAcademyItem: ResolvedAcademyItem | null =
    editTarget?.kind === 'academy'
      ? editResolved.academy.find(
          (a) => a.id === editTarget.id || (a.masterId && a.masterId === editTarget.id)
        ) ?? null
      : null;
  const isAddingAcademy = addTarget !== null;

  const daySchedules = useMemo(
    () => getSchedulesForDate(schedules, selectedDateStr),
    [schedules, selectedDateStr]
  );

  const weeklyData = useMemo(() => {
    return weekDays.map((wd) => ({
      ...wd,
      resolved: resolveDailyTimetable(wd.dateStr, masterTimetable, dailyOverrides),
    }));
  }, [weekDays, masterTimetable, dailyOverrides]);

  const overlapBadgeLabel = tr(lang, '[시간 겹침]', '[Time Overlap]', '[时间冲突]');

  const timelineLayout = useMemo(() => {
    const occupiedIntervals: Array<{
      uid: string;
      start: number;
      end: number;
      type: 'school' | 'academy';
      label: string;
      isCancelled: boolean;
    }> = [];

    let schoolMinutesTotal = 0;
    let academyMinutesTotal = 0;

    dailyData.school.forEach((s) => {
      const rawStart = timeToMinutes(s.startTime);
      const rawEnd = timeToMinutes(s.endTime);
      if (!s.isCancelled && rawEnd > rawStart) {
        schoolMinutesTotal += rawEnd - rawStart;
      }
      if (rawEnd <= timelineStartMin || rawStart >= timelineEndMin) return;
      const st = Math.max(timelineStartMin, rawStart);
      const et = Math.min(timelineEndMin, Math.max(st + 25, rawEnd));
      occupiedIntervals.push({
        uid: `school-${s.period}`,
        start: st,
        end: et,
        type: 'school',
        label: `${tr(lang, `${s.period}교시`, `P${s.period}`, `第${s.period}节`)} ${translateSubject(
          s.subject,
          lang
        )}`,
        isCancelled: s.isCancelled,
      });
    });

    dailyData.academy.forEach((a) => {
      const rawStart = timeToMinutes(a.startTime);
      const rawEnd = timeToMinutes(a.endTime);
      if (!a.isCancelled && rawEnd > rawStart) {
        academyMinutesTotal += rawEnd - rawStart;
      }
      if (rawEnd <= timelineStartMin || rawStart >= timelineEndMin) return;
      const st = Math.max(timelineStartMin, rawStart);
      const et = Math.min(timelineEndMin, Math.max(st + 25, rawEnd));
      occupiedIntervals.push({
        uid: `academy-${a.id}`,
        start: st,
        end: et,
        type: 'academy',
        label: translateSubject(a.subject, lang),
        isCancelled: a.isCancelled,
      });
    });

    const activeIntervals = occupiedIntervals.filter((x) => !x.isCancelled);

    const rawConflicts: Array<{
      startMin: number;
      endMin: number;
      subjects: Set<string>;
    }> = [];

    for (let i = 0; i < activeIntervals.length; i++) {
      for (let j = i + 1; j < activeIntervals.length; j++) {
        const a = activeIntervals[i];
        const b = activeIntervals[j];
        const overlapStart = Math.max(a.start, b.start);
        const overlapEnd = Math.min(a.end, b.end);
        if (overlapStart < overlapEnd) {
          rawConflicts.push({
            startMin: overlapStart,
            endMin: overlapEnd,
            subjects: new Set([a.label, b.label]),
          });
        }
      }
    }

    rawConflicts.sort((a, b) => a.startMin - b.startMin);
    const mergedConflicts: ConflictZoneInterval[] = [];
    for (const rc of rawConflicts) {
      if (mergedConflicts.length === 0) {
        const topPx = ((rc.startMin - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
        const heightPx = Math.max(28, ((rc.endMin - rc.startMin) / 60) * HOUR_HEIGHT_PX);
        mergedConflicts.push({
          id: `conflict-${rc.startMin}-${rc.endMin}`,
          startMin: rc.startMin,
          endMin: rc.endMin,
          startTime: minutesToTimeStr(rc.startMin),
          endTime: minutesToTimeStr(rc.endMin),
          topPx,
          heightPx,
          involvedSubjects: Array.from(rc.subjects),
        });
      } else {
        const last = mergedConflicts[mergedConflicts.length - 1];
        if (rc.startMin <= last.endMin) {
          last.endMin = Math.max(last.endMin, rc.endMin);
          last.endTime = minutesToTimeStr(last.endMin);
          last.heightPx = Math.max(
            28,
            ((last.endMin - last.startMin) / 60) * HOUR_HEIGHT_PX
          );
          const combined = new Set([...last.involvedSubjects, ...Array.from(rc.subjects)]);
          last.involvedSubjects = Array.from(combined);
        } else {
          const topPx = ((rc.startMin - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
          const heightPx = Math.max(28, ((rc.endMin - rc.startMin) / 60) * HOUR_HEIGHT_PX);
          mergedConflicts.push({
            id: `conflict-${rc.startMin}-${rc.endMin}`,
            startMin: rc.startMin,
            endMin: rc.endMin,
            startTime: minutesToTimeStr(rc.startMin),
            endTime: minutesToTimeStr(rc.endMin),
            topPx,
            heightPx,
            involvedSubjects: Array.from(rc.subjects),
          });
        }
      }
    }

    const sorted = [...activeIntervals].sort((a, b) => a.start - b.start);
    const mergedOccupied: Array<{ start: number; end: number }> = [];
    for (const interval of sorted) {
      if (mergedOccupied.length === 0) {
        mergedOccupied.push({ start: interval.start, end: interval.end });
      } else {
        const last = mergedOccupied[mergedOccupied.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          mergedOccupied.push({ start: interval.start, end: interval.end });
        }
      }
    }

    const freeSlots: FreeSlotInterval[] = [];
    let cursor = timelineStartMin;
    for (const occ of mergedOccupied) {
      if (occ.start > cursor) {
        const gap = occ.start - cursor;
        if (gap >= 20) {
          freeSlots.push({
            startMin: cursor,
            endMin: occ.start,
            durationMin: gap,
            startTime: minutesToTimeStr(cursor),
            endTime: minutesToTimeStr(occ.start),
            contextLabel: getFreeSlotContextLabel(cursor, occ.start, gap, lang),
          });
        }
      }
      cursor = Math.max(cursor, occ.end);
    }
    if (cursor < timelineEndMin) {
      const gap = timelineEndMin - cursor;
      if (gap >= 20) {
        freeSlots.push({
          startMin: cursor,
          endMin: timelineEndMin,
          durationMin: gap,
          startTime: minutesToTimeStr(cursor),
          endTime: minutesToTimeStr(timelineEndMin),
          contextLabel: getFreeSlotContextLabel(cursor, timelineEndMin, gap, lang),
        });
      }
    }

    const totalOccupiedMergedMin = mergedOccupied.reduce(
      (acc, cur) => acc + (cur.end - cur.start),
      0
    );
    const totalFreeMin = Math.max(0, totalTimelineMinutes - totalOccupiedMergedMin);

    const spectrumSegments: SpectrumSegment[] = [
      ...activeIntervals.map((occ) => ({
        startMin: occ.start,
        endMin: occ.end,
        leftPercent: ((occ.start - timelineStartMin) / totalTimelineMinutes) * 100,
        widthPercent: ((occ.end - occ.start) / totalTimelineMinutes) * 100,
        type: occ.type,
        label: occ.label,
      })),
      ...freeSlots.map((fs) => ({
        startMin: fs.startMin,
        endMin: fs.endMin,
        leftPercent: ((fs.startMin - timelineStartMin) / totalTimelineMinutes) * 100,
        widthPercent: ((fs.endMin - fs.startMin) / totalTimelineMinutes) * 100,
        type: 'free' as const,
        label: `${fs.startTime}~${fs.endTime} ${tr(lang, '빈 시간', 'Free', '空闲')}`,
      })),
      ...mergedConflicts.map((cf) => ({
        startMin: cf.startMin,
        endMin: cf.endMin,
        leftPercent: ((cf.startMin - timelineStartMin) / totalTimelineMinutes) * 100,
        widthPercent: ((cf.endMin - cf.startMin) / totalTimelineMinutes) * 100,
        type: 'conflict' as const,
        label: `${overlapBadgeLabel} ${cf.startTime}~${cf.endTime} (${cf.involvedSubjects.join(' · ')})`,
      })),
    ];

    const getColumnPlacement = (uid: string, startA: number, endA: number, isCancelled: boolean) => {
      if (isCancelled) {
        return { totalCols: 1, colIndex: 0 };
      }
      const overlappingUids = activeIntervals
        .filter((other) => startA < other.end && endA > other.start)
        .map((other) => other.uid);

      const totalCols = Math.max(1, overlappingUids.length);
      const colIndex = Math.max(0, overlappingUids.indexOf(uid));
      return { totalCols, colIndex };
    };

    const schoolLayout = dailyData.school
      .filter((item) => {
        const rawStart = timeToMinutes(item.startTime);
        const rawEnd = timeToMinutes(item.endTime);
        return rawEnd > timelineStartMin && rawStart < timelineEndMin;
      })
      .map((item) => {
        const startA = Math.max(timelineStartMin, timeToMinutes(item.startTime));
        const endA = Math.min(timelineEndMin, Math.max(startA + 25, timeToMinutes(item.endTime)));
        const topPx = ((startA - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
        const heightPx = Math.max(36, ((endA - startA) / 60) * HOUR_HEIGHT_PX);
        const { totalCols, colIndex } = getColumnPlacement(
          `school-${item.period}`,
          startA,
          endA,
          item.isCancelled
        );

        return {
          item,
          topPx,
          heightPx,
          totalCols,
          colIndex,
        };
      });

    const academyLayout = dailyData.academy
      .filter((item) => {
        const rawStart = timeToMinutes(item.startTime);
        const rawEnd = timeToMinutes(item.endTime);
        return rawEnd > timelineStartMin && rawStart < timelineEndMin;
      })
      .map((item) => {
        const startA = Math.max(timelineStartMin, timeToMinutes(item.startTime));
        const endA = Math.min(timelineEndMin, Math.max(startA + 25, timeToMinutes(item.endTime)));
        const topPx = ((startA - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
        const heightPx = Math.max(40, ((endA - startA) / 60) * HOUR_HEIGHT_PX);
        const { totalCols, colIndex } = getColumnPlacement(
          `academy-${item.id}`,
          startA,
          endA,
          item.isCancelled
        );

        return {
          item,
          topPx,
          heightPx,
          totalCols,
          colIndex,
        };
      });

    return {
      schoolLayout,
      academyLayout,
      freeSlots,
      conflictZones: mergedConflicts,
      spectrumSegments,
      schoolMinutesTotal: Math.max(0, schoolMinutesTotal),
      academyMinutesTotal: Math.max(0, academyMinutesTotal),
      totalFreeMin,
    };
  }, [dailyData, timelineStartMin, timelineEndMin, totalTimelineMinutes, lang, overlapBadgeLabel]);

  // Daily view steps one day, weekly view steps one week
  const handleStep = (delta: number) => {
    setSelectedDate((prev) => addDays(prev, viewMode === 'daily' ? delta : delta * 7));
  };

  const handleGoToday = () => {
    setSelectedDate(new Date());
  };

  const closeEditSheet = () => setEditTarget(null);
  const closeAddSheet = () => setAddTarget(null);

  // 보강/특강 registered on any date (for the 보강/특강 추가 sheet): upcoming first, then the last two weeks.
  const registeredMakeups = useMemo(() => {
    const twoWeeksAgo = formatDateKey(addDays(new Date(), -14));
    const rows: Array<{ date: string; item: AcademyOverrideItem }> = [];
    Object.entries(dailyOverrides).forEach(([date, ov]) => {
      if (date < twoWeeksAgo) return;
      (ov.academy || []).forEach((item) => {
        if (item.isAdded) rows.push({ date, item });
      });
    });
    rows.sort((a, b) => (a.date + a.item.startTime).localeCompare(b.date + b.item.startTime));
    return {
      upcoming: rows.filter((r) => r.date >= todayStr),
      past: rows.filter((r) => r.date < todayStr).reverse(),
    };
  }, [dailyOverrides, todayStr]);

  const openRegisteredMakeup = (date: string, id: string) => {
    const resolved = resolveDailyTimetable(date, masterTimetable, dailyOverrides).academy.find((a) => a.id === id);
    if (!resolved) return;
    setSelectedDate(parseDateKey(date));
    openEditAcademyModal(resolved, date);
  };

  /** Run `proceed` now, or after the user confirms when start–end overlaps something on that date. */
  const guardOverlap = (
    dateStr: string,
    start: string,
    end: string | undefined,
    proceed: () => void,
    ignore: { academyId?: string; scheduleId?: string } = {}
  ) => {
    const conflicts = findTimeConflicts({
      dateStr,
      start,
      end,
      masterTimetable,
      dailyOverrides,
      schedules,
      ignoreAcademyId: ignore.academyId,
      ignoreScheduleId: ignore.scheduleId,
    });
    if (conflicts.length === 0) proceed();
    else setPendingConflict({ conflicts, proceed });
  };

  const openSchoolEdit = (item: ResolvedSchoolPeriod, dateStr: string = selectedDateStr) => {
    setAddTarget(null);
    setEditTarget({ kind: 'school', date: dateStr, period: item.period });
    setTempNote(item.note ?? '');
  };

  const openEditAcademyModal = (item: ResolvedAcademyItem, dateStr: string = selectedDateStr) => {
    setAddTarget(null);
    setEditTarget({ kind: 'academy', date: dateStr, id: item.id });
    setTempStartTime(item.startTime);
    setTempEndTime(item.endTime);
    setTempAcademySubject(item.subject);
    setTempNote(item.note ?? '');
  };

  const openAddAcademyModal = (
    defaultStart = '18:00',
    defaultEnd = '20:00',
    source: 'button' | 'canvas' = 'canvas',
    dateStr: string = selectedDateStr
  ) => {
    const startMin = timeToMinutes(defaultStart);
    const rawEndMin = timeToMinutes(defaultEnd);
    const reasonableEndMin =
      rawEndMin - startMin > 120 ? Math.min(1440, startMin + 120) : rawEndMin;

    setEditTarget(null);
    setAddTarget({ date: dateStr, source });
    setAddKind('academy');
    setTempStartTime(defaultStart);
    setTempEndTime(minutesToTimeStr(reasonableEndMin));
    setTempAcademySubject(subjectPool.academy[0] || '');
    setNewScheduleTitle('');
    setNewScheduleCategory('other');
    setNewScheduleMemo('');
  };

  // Jump to a date (keeps the current view mode) and open the edit sheet for one of its items
  const openItemOnDate = (
    target: { kind: 'school'; item: ResolvedSchoolPeriod } | { kind: 'academy'; item: ResolvedAcademyItem },
    dateObj: Date
  ) => {
    const dateStr = formatDateKey(dateObj);
    setSelectedDate(dateObj);
    if (target.kind === 'school') openSchoolEdit(target.item, dateStr);
    else openEditAcademyModal(target.item, dateStr);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMin = timelineStartMin + (y / HOUR_HEIGHT_PX) * 60;
    const snapped = Math.max(
      timelineStartMin,
      Math.min(timelineEndMin - 30, Math.floor(rawMin / 30) * 30)
    );
    const end = Math.min(timelineEndMin, snapped + 60);
    openAddAcademyModal(minutesToTimeStr(snapped), minutesToTimeStr(end));
  };

  // ---- Attendance sync for 결석 (absent) ----
  const syncAbsence = (
    dateStr: string,
    kind: 'school' | 'academy',
    subject: string,
    prevStatus: SlotStatus | undefined,
    nextStatus: SlotStatus | undefined
  ) => {
    if (!onUpdateAttendance) return;
    if (nextStatus === 'absent' && prevStatus !== 'absent') {
      onUpdateAttendance((prev) => {
        const day = { ...(prev[dateStr] || {}) };
        if (kind === 'school') {
          day.school = { status: 'absent' };
        } else {
          day.academies = {
            ...(day.academies || {}),
            [subject]: { status: 'absent', needsMakeup: true, makeupCompleted: false },
          };
        }
        return { ...prev, [dateStr]: day };
      });
    } else if (prevStatus === 'absent' && nextStatus !== 'absent') {
      onUpdateAttendance((prev) => {
        const existingDay = prev[dateStr];
        if (!existingDay) return prev;
        const day = { ...existingDay };
        if (kind === 'school') {
          if (day.school?.status !== 'absent') return prev;
          delete day.school;
        } else {
          if (day.academies?.[subject]?.status !== 'absent') return prev;
          const acs = { ...(day.academies || {}) };
          delete acs[subject];
          day.academies = acs;
        }
        return { ...prev, [dateStr]: day };
      });
    }
  };

  // ---- School overrides ----
  const writeSchoolOverride = (
    dateStr: string,
    item: ResolvedSchoolPeriod,
    patch: Partial<SchoolPeriodOverride>
  ) => {
    onUpdateDailyOverrides((prev) => {
      const next = { ...prev };
      const currentDayOv = { ...(next[dateStr] || {}) };
      const currentSchoolOv = { ...(currentDayOv.school || {}) };
      const existing = currentSchoolOv[item.period];
      const merged: SchoolPeriodOverride = {
        subject: existing?.subject ?? item.subject,
        status: existing?.status ?? (existing?.isCancelled ? 'cancelled' : undefined),
        note: existing?.note,
        ...patch,
      };
      merged.isCancelled = merged.status === 'cancelled';
      if (!merged.status) delete merged.status;
      if (!merged.note) delete merged.note;

      if (merged.subject === item.originalSubject && !merged.status && !merged.note) {
        delete currentSchoolOv[item.period];
      } else {
        currentSchoolOv[item.period] = merged;
      }
      currentDayOv.school = currentSchoolOv;
      next[dateStr] = currentDayOv;
      return next;
    });
  };

  const handleSelectSchoolSubject = (newSubject: string) => {
    if (!editingSchoolPeriod) return;
    const patch: Partial<SchoolPeriodOverride> = { subject: newSubject };
    if (editingSchoolPeriod.status === 'cancelled') patch.status = undefined;
    writeSchoolOverride(editDateStr, editingSchoolPeriod, patch);
    closeEditSheet();
  };

  const handleToggleSchoolStatus = (status: SlotStatus) => {
    if (!editingSchoolPeriod) return;
    const nextStatus = editingSchoolPeriod.status === status ? undefined : status;
    writeSchoolOverride(editDateStr, editingSchoolPeriod, { status: nextStatus });
    syncAbsence(
      editDateStr,
      'school',
      editingSchoolPeriod.subject,
      editingSchoolPeriod.status,
      nextStatus
    );
  };

  const handleSaveSchoolNote = () => {
    if (!editingSchoolPeriod) return;
    const trimmed = tempNote.trim();
    if ((editingSchoolPeriod.note ?? '') === trimmed) return;
    writeSchoolOverride(editDateStr, editingSchoolPeriod, { note: trimmed || undefined });
  };

  const handleRestoreSchoolPeriod = () => {
    if (!editingSchoolPeriod) return;
    const periodNum = editingSchoolPeriod.period;
    const dateStr = editDateStr;

    onUpdateDailyOverrides((prev) => {
      const next = { ...prev };
      const currentDayOv = { ...(next[dateStr] || {}) };
      const currentSchoolOv = { ...(currentDayOv.school || {}) };
      delete currentSchoolOv[periodNum];
      currentDayOv.school = currentSchoolOv;
      next[dateStr] = currentDayOv;
      return next;
    });
    syncAbsence(dateStr, 'school', editingSchoolPeriod.subject, editingSchoolPeriod.status, undefined);
    closeEditSheet();
  };

  // ---- Academy overrides ----
  const getUpdatedAcademyOverrides = (
    prev: DailyOverrides,
    dateStr: string,
    modifier: (currentList: AcademyOverrideItem[]) => AcademyOverrideItem[]
  ): DailyOverrides => {
    const next = { ...prev };
    const currentDayOv = { ...(next[dateStr] || {}) };
    const existingList: AcademyOverrideItem[] = currentDayOv.academy
      ? [...currentDayOv.academy]
      : resolveDailyTimetable(dateStr, masterTimetable, prev).academy.map((item) => ({
          id: item.id,
          masterId: item.masterId,
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject,
          isCancelled: item.isCancelled,
          isAdded: item.isAdded,
          status: item.status,
          note: item.note,
          originalSubject: item.originalSubject,
          originalStartTime: item.originalStartTime,
          originalEndTime: item.originalEndTime,
        }));

    currentDayOv.academy = modifier(existingList);
    next[dateStr] = currentDayOv;
    return next;
  };

  const upsertAcademyOverride = (
    dateStr: string,
    item: ResolvedAcademyItem,
    patch: Partial<AcademyOverrideItem>
  ) => {
    onUpdateDailyOverrides((prev) =>
      getUpdatedAcademyOverrides(prev, dateStr, (list) => {
        const foundIdx = list.findIndex(
          (x) => (item.masterId && x.masterId === item.masterId) || x.id === item.id
        );
        const existing = foundIdx >= 0 ? list[foundIdx] : undefined;
        const entry: AcademyOverrideItem = {
          id: item.id,
          masterId: item.masterId,
          startTime: existing?.startTime ?? item.startTime,
          endTime: existing?.endTime ?? item.endTime,
          subject: existing?.subject ?? item.subject,
          isCancelled: existing?.isCancelled ?? item.isCancelled,
          isAdded: item.isAdded,
          status: existing?.status ?? item.status,
          note: existing?.note ?? item.note,
          originalSubject: item.originalSubject,
          originalStartTime: item.originalStartTime,
          originalEndTime: item.originalEndTime,
          ...patch,
        };
        if ('status' in patch) entry.isCancelled = patch.status === 'cancelled';
        if (!entry.status) delete entry.status;
        if (!entry.note) delete entry.note;
        if (!entry.masterId) delete entry.masterId;
        if (foundIdx >= 0) {
          const copy = [...list];
          copy[foundIdx] = entry;
          return copy;
        }
        return [...list, entry];
      })
    );
  };

  const handleSelectAcademySubject = (chosenSubject: string) => {
    if (isAddingAcademy && addTarget) {
      const newItem: AcademyOverrideItem = {
        id: `added-${Date.now()}`,
        startTime: tempStartTime,
        endTime: tempEndTime,
        subject: chosenSubject,
        isCancelled: false,
        isAdded: true,
      };
      const dateStr = addTarget.date;
      guardOverlap(dateStr, tempStartTime, tempEndTime, () => {
        onUpdateDailyOverrides((prev) =>
          getUpdatedAcademyOverrides(prev, dateStr, (list) => [...list, newItem])
        );
        closeAddSheet();
      });
      return;
    }

    if (!editingAcademyItem) return;
    const patch: Partial<AcademyOverrideItem> = {
      startTime: tempStartTime,
      endTime: tempEndTime,
      subject: chosenSubject,
    };
    if (editingAcademyItem.status === 'cancelled') patch.status = undefined;
    const item = editingAcademyItem;
    const dateStr = editDateStr;
    const save = () => {
      upsertAcademyOverride(dateStr, item, patch);
      closeEditSheet();
    };
    // Only ask about overlaps when the time actually moves.
    if (tempStartTime !== item.startTime || tempEndTime !== item.endTime) {
      guardOverlap(dateStr, tempStartTime, tempEndTime, save, { academyId: item.id });
    } else {
      save();
    }
  };

  const handleSaveAcademyTimeOnly = () => {
    if (!editingAcademyItem) return;
    handleSelectAcademySubject(tempAcademySubject || editingAcademyItem.subject);
  };

  const handleToggleAcademyStatus = (status: SlotStatus) => {
    if (!editingAcademyItem) return;
    const nextStatus = editingAcademyItem.status === status ? undefined : status;
    upsertAcademyOverride(editDateStr, editingAcademyItem, { status: nextStatus });
    syncAbsence(
      editDateStr,
      'academy',
      editingAcademyItem.subject,
      editingAcademyItem.status,
      nextStatus
    );
  };

  const handleSaveAcademyNote = () => {
    if (!editingAcademyItem) return;
    const trimmed = tempNote.trim();
    if ((editingAcademyItem.note ?? '') === trimmed) return;
    upsertAcademyOverride(editDateStr, editingAcademyItem, { note: trimmed || undefined });
  };

  const handleRestoreOrDeleteAcademyItem = () => {
    if (!editingAcademyItem) return;
    const dateStr = editDateStr;
    const target = editingAcademyItem;

    if (target.isAdded) {
      onUpdateDailyOverrides((prev) =>
        getUpdatedAcademyOverrides(prev, dateStr, (list) => list.filter((x) => x.id !== target.id))
      );
    } else if (target.masterId) {
      onUpdateDailyOverrides((prev) =>
        getUpdatedAcademyOverrides(prev, dateStr, (list) =>
          list.filter((x) => x.masterId !== target.masterId)
        )
      );
    }
    syncAbsence(dateStr, 'academy', target.subject, target.status, undefined);
    closeEditSheet();
  };

  // ---- Schedule items (일정) ----
  const handleAddScheduleItem = () => {
    if (!onUpdateSchedules || !addTarget) return;
    const title = newScheduleTitle.trim();
    if (!title) return;
    const item: ScheduleItem = {
      id: `sch-${Date.now()}`,
      date: addTarget.date,
      time: tempStartTime || undefined,
      title,
      category: newScheduleCategory,
      memo: newScheduleMemo.trim(),
    };
    const save = () => {
      onUpdateSchedules((prev) => [...prev, item]);
      closeAddSheet();
    };
    if (item.time) guardOverlap(item.date, item.time, undefined, save);
    else save();
  };

  // ---- "Now" card data (always today) ----
  const nowCard = useMemo(() => {
    type Entry = {
      key: string;
      kind: 'school' | 'academy';
      start: number;
      end: number;
      startTime: string;
      endTime: string;
      title: string;
      subject: string;
      badge: string;
      status?: SlotStatus;
      school?: ResolvedSchoolPeriod;
      academy?: ResolvedAcademyItem;
    };
    const entries: Entry[] = [
      ...todayData.school
        .filter((s) => !s.isCancelled)
        .map((s) => ({
          key: `school-${s.period}`,
          kind: 'school' as const,
          start: timeToMinutes(s.startTime),
          end: timeToMinutes(s.endTime),
          startTime: s.startTime,
          endTime: s.endTime,
          title: `${tr(lang, `${s.period}교시`, `P${s.period}`, `第${s.period}节`)} · ${slotTitle(
            s.subject,
            s.status,
            lang
          )}`,
          subject: slotTitle(s.subject, s.status, lang),
          badge: tr(lang, `학교 ${s.period}교시`, `School · P${s.period}`, `学校 第${s.period}节`),
          status: s.status,
          school: s,
        })),
      ...todayData.academy
        .filter((a) => !a.isCancelled)
        .map((a) => ({
          key: `academy-${a.id}`,
          kind: 'academy' as const,
          start: timeToMinutes(a.startTime),
          end: timeToMinutes(a.endTime),
          startTime: a.startTime,
          endTime: a.endTime,
          title: slotTitle(a.subject, a.status, lang),
          subject: slotTitle(a.subject, a.status, lang),
          badge: a.isAdded
            ? tr(lang, '학원 보강/특강', 'Academy · Makeup', '补习班 补课/特讲')
            : tr(lang, '학원', 'Academy', '补习班'),
          status: a.status,
          academy: a,
        })),
    ].sort((a, b) => a.start - b.start);

    const current = entries.filter((e) => e.start <= nowMinutes && nowMinutes < e.end);
    const next = entries.find((e) => e.start > nowMinutes) ?? null;
    const makeups = todayData.academy.filter((a) => a.isAdded);
    const makeupSchedules = getSchedulesForDate(schedules, todayStr).filter(
      (s) => s.category === 'academy' && s.title.includes('보강')
    );
    return { current, next, makeups, makeupSchedules };
  }, [todayData, nowMinutes, schedules, todayStr, lang]);

  const openNowEntry = (entry: {
    kind: 'school' | 'academy';
    school?: ResolvedSchoolPeriod;
    academy?: ResolvedAcademyItem;
  }) => {
    const todayObj = new Date();
    if (entry.kind === 'school' && entry.school) {
      openItemOnDate({ kind: 'school', item: entry.school }, todayObj);
    } else if (entry.academy) {
      openItemOnDate({ kind: 'academy', item: entry.academy }, todayObj);
    }
  };

  // Quick status pills (휴강 / 결석 / 자습) + free-text note, shared by both edit sheets
  const renderStatusAndNote = (
    currentStatus: SlotStatus | undefined,
    onToggle: (s: SlotStatus) => void,
    onSaveNote: () => void,
    savedNote: string
  ) => {
    const dirty = tempNote.trim() !== savedNote;
    return (
      <div className="space-y-3.5 p-3.5 rounded-2xl bg-surface">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.8125rem] font-bold text-ink">
              {tr(lang, '오늘 이 수업은', 'This class today', '今天这节课')}
            </span>
            <span className="text-[0.6875rem] font-semibold text-slate-600">
              {tr(lang, '다시 누르면 해제', 'Tap again to clear', '再次点击取消')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const active = currentStatus === opt;
              const activeCls =
                opt === 'cancelled'
                  ? 'bg-slate-600 text-paper border-transparent'
                  : opt === 'absent'
                  ? 'bg-accent-800 text-paper border-transparent'
                  : 'bg-sage-700 text-paper border-transparent';
              const Icon = opt === 'cancelled' ? Ban : opt === 'absent' ? UserX : BookOpen;
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(opt)}
                  className={`h-10 rounded-full text-[0.8125rem] font-bold border transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 ${
                    active ? activeCls : 'bg-paper text-ink border-divider hover:bg-slate-100'
                  }`}
                >
                  {active ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Icon className="w-3.5 h-3.5" />}
                  {statusLabel(opt, lang)}
                </button>
              );
            })}
          </div>
          {currentStatus === 'absent' && onUpdateAttendance && (
            <p className="text-[0.6875rem] font-semibold text-accent-800">
              {tr(
                lang,
                '출결 기록에도 결석으로 저장돼요.',
                'Also saved as absent in attendance.',
                '也会作为缺席记录到出勤中。'
              )}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
            <StickyNote className="w-3.5 h-3.5 text-slate-600" />
            {tr(lang, '메모', 'Note', '备注')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              onBlur={onSaveNote}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveNote();
              }}
              placeholder={tr(
                lang,
                '예: 숙제 검사, 교실 변경',
                'e.g. Homework check, room change',
                '例如：检查作业、换教室'
              )}
              className="flex-1 min-w-0 h-10 px-4 rounded-full border border-divider bg-paper text-[0.8125rem] text-ink placeholder:text-slate-500 outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={onSaveNote}
              disabled={!dirty}
              className="h-10 px-4 rounded-full bg-accent-700 text-paper text-[0.8125rem] font-bold whitespace-nowrap hover:bg-accent-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-default"
            >
              {dirty ? tr(lang, '저장', 'Save', '保存') : tr(lang, '저장됨', 'Saved', '已保存')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const hoursArray = useMemo(
    () => Array.from({ length: totalHours + 1 }, (_, i) => startHour + i),
    [startHour, totalHours]
  );

  const spectrumTickHours = useMemo(() => {
    const ticks: number[] = [];
    const step = totalHours >= 12 ? 4 : 2;
    for (let h = startHour; h <= endHour; h += step) {
      ticks.push(h);
    }
    if (ticks[ticks.length - 1] !== endHour) {
      ticks.push(endHour);
    }
    return ticks;
  }, [startHour, endHour, totalHours]);

  // ---- Week strip markers (makeups / day changes / schedules) ----
  const weekMarkers = useMemo(() => {
    const map: Record<string, { makeup: boolean; changed: boolean; schedule: boolean }> = {};
    weekDays.forEach((wd) => {
      const ov = dailyOverrides[wd.dateStr];
      const academyOv = ov?.academy || [];
      const makeup = academyOv.some((a) => a.isAdded);
      const changed =
        Object.keys(ov?.school || {}).length > 0 || academyOv.some((a) => !a.isAdded);
      const schedule = getSchedulesForDate(schedules, wd.dateStr).length > 0;
      map[wd.dateStr] = { makeup, changed, schedule };
    });
    return map;
  }, [weekDays, dailyOverrides, schedules]);

  // ---- Weekly school grid rows: every period that exists Mon–Fri, with its usual time ----
  const weeklyPeriods = useMemo(() => {
    const byPeriod = new Map<number, { startTime: string; endTime: string }>();
    weeklyData.slice(0, 5).forEach((wd) => {
      wd.resolved.school.forEach((s) => {
        if (!byPeriod.has(s.period)) byPeriod.set(s.period, { startTime: s.startTime, endTime: s.endTime });
      });
    });
    return Array.from(byPeriod.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([period, t]) => ({ period, ...t }));
  }, [weeklyData]);

  const weekRangeLabel = useMemo(() => {
    const mon = weekDays[0]?.dateObj;
    const sun = weekDays[6]?.dateObj;
    if (!mon || !sun) return '';
    const f = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${f(mon)} – ${f(sun)}`;
  }, [weekDays]);

  const navBtn =
    'w-[34px] h-[34px] rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 active:scale-95 transition-transform shrink-0';

  /** Small date tile used in sheet headers and the weekly academy list. */
  const renderDateBlock = (dateStr: string, tone: 'sage' | 'accent' | 'plain', size: 'sm' | 'md' = 'md') => {
    const d = parseDateKey(dateStr);
    const dayKor = getDayOfWeekKor(d);
    const filled = tone !== 'plain';
    return (
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 ${
          size === 'md' ? 'w-[52px] py-2' : 'w-11 py-1.5'
        } ${
          tone === 'sage'
            ? 'bg-sage-700 text-paper'
            : tone === 'accent'
            ? 'bg-accent-700 text-paper'
            : 'bg-paper text-ink'
        }`}
      >
        <span
          className={`text-[0.6875rem] font-bold leading-none ${
            filled ? 'text-paper/90' : weekendTint(dayKor) || 'text-slate-600'
          }`}
        >
          {translateDay(dayKor, lang)}
        </span>
        <span className={`font-mono leading-none tabular-nums ${size === 'md' ? 'text-[1.375rem]' : 'text-[1.0625rem]'}`}>
          {d.getDate()}
        </span>
      </span>
    );
  };

  /** One timeline block (school period or academy class). Compact single-row layout when short. */
  const renderTimelineBlock = (opts: {
    key: string;
    kind: 'school' | 'academy';
    topPx: number;
    heightPx: number;
    totalCols: number;
    colIndex: number;
    title: string;
    startTime: string;
    endTime: string;
    badge: string;
    status?: SlotStatus;
    note?: string;
    isCurrent: boolean;
    isCancelled: boolean;
    isOverlapping: boolean;
    modifiedFrom?: string;
    isMakeup?: boolean;
    onClick: () => void;
  }) => {
    const h = Math.max(36, opts.heightPx - 3);
    const compact = h < 60;
    const widthPercent = 100 / opts.totalCols;
    const leftPercent = opts.colIndex * widthPercent;
    const isSchool = opts.kind === 'school';

    let shell: string;
    let strip: string;
    let titleCls: string;
    let metaCls: string;
    let badgeCls: string;
    if (opts.isCurrent) {
      shell = isSchool
        ? 'bg-sage-700 shadow-md hover:bg-sage-800'
        : 'bg-accent-700 shadow-md hover:bg-accent-800';
      strip = isSchool ? 'bg-sage-300' : 'bg-accent-300';
      titleCls = 'text-paper';
      metaCls = 'text-paper/90';
      badgeCls = 'bg-paper/20 text-paper';
    } else if (opts.isCancelled) {
      shell = 'bg-paper/80 border border-dashed border-slate-400 hover:bg-paper';
      strip = 'bg-slate-300';
      titleCls = 'text-slate-600 line-through';
      metaCls = 'text-slate-600';
      badgeCls = 'bg-slate-200 text-slate-700';
    } else if (opts.status === 'selfStudy') {
      shell = 'bg-slate-200 hover:bg-slate-300';
      strip = 'bg-slate-500';
      titleCls = 'text-ink';
      metaCls = 'text-slate-700';
      badgeCls = 'bg-paper text-slate-700';
    } else if (isSchool) {
      shell = 'bg-sage-100 hover:bg-sage-200';
      strip = opts.status === 'absent' ? 'bg-accent-800' : 'bg-sage-600';
      titleCls = 'text-sage-900';
      metaCls = 'text-sage-800';
      badgeCls = 'bg-sage-200 text-sage-900';
    } else {
      shell = 'bg-accent-100 hover:bg-accent-200';
      strip = opts.status === 'absent' ? 'bg-accent-800' : 'bg-accent';
      titleCls = 'text-accent-900';
      metaCls = 'text-accent-800';
      badgeCls = opts.isMakeup ? 'bg-accent-700 text-paper' : 'bg-accent-200 text-accent-900';
    }
    const conflictRing =
      opts.isOverlapping && !opts.isCancelled ? 'ring-2 ring-accent-800 ring-offset-1 ring-offset-surface' : '';

    const liveChip = opts.isCurrent && (
      <span className="px-1.5 py-px rounded-full bg-paper text-ink text-[0.6875rem] leading-tight font-bold whitespace-nowrap shrink-0">
        {tr(lang, '수업 중', 'LIVE', '上课中')}
      </span>
    );
    const cancelledChip = opts.isCancelled && (
      <span className="px-1.5 py-px rounded-full bg-slate-200 text-slate-700 text-[0.6875rem] leading-tight font-bold whitespace-nowrap shrink-0">
        {statusLabel('cancelled', lang)}
      </span>
    );
    const conflictIcon = opts.isOverlapping && !opts.isCancelled && (
      <AlertTriangle
        className={`w-3.5 h-3.5 shrink-0 ${opts.isCurrent ? 'text-paper' : 'text-accent-800'}`}
        aria-label={overlapBadgeLabel}
      />
    );

    return (
      <button
        key={opts.key}
        type="button"
        onClick={opts.onClick}
        style={{
          top: `${opts.topPx + 1.5}px`,
          height: `${h}px`,
          left: `calc(${leftPercent}% + 3px)`,
          width: `calc(${widthPercent}% - 6px)`,
        }}
        className={`absolute z-10 rounded-xl text-left transition-colors overflow-hidden flex ${shell} ${conflictRing}`}
      >
        <span className={`w-1.5 shrink-0 ${strip}`} aria-hidden="true" />
        {compact ? (
          <span className="min-w-0 flex-1 flex items-center gap-1.5 px-2.5">
            {conflictIcon}
            <span className={`min-w-0 truncate text-[0.875rem] font-bold ${titleCls}`}>{opts.title}</span>
            <span className={`font-mono text-[0.6875rem] tabular-nums whitespace-nowrap shrink-0 ${metaCls}`}>
              {opts.startTime}
            </span>
            <StatusTag status={opts.status} lang={lang} />
            {cancelledChip}
            {liveChip}
            <span className="flex-1" />
            {opts.totalCols === 1 && (
              <span className={`px-1.5 py-px rounded-full text-[0.6875rem] leading-tight font-bold whitespace-nowrap shrink-0 ${badgeCls}`}>
                {opts.badge}
              </span>
            )}
          </span>
        ) : (
          <span className="min-w-0 flex-1 flex flex-col gap-0.5 px-2.5 py-1.5">
            <span className="flex items-center gap-1.5 min-w-0">
              {conflictIcon}
              <span className={`min-w-0 truncate text-[0.875rem] leading-tight font-bold ${titleCls}`}>{opts.title}</span>
              <StatusTag status={opts.status} lang={lang} />
              {cancelledChip}
              {liveChip}
            </span>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={`font-mono text-[0.6875rem] tabular-nums whitespace-nowrap ${metaCls}`}>
                {opts.startTime} – {opts.endTime}
              </span>
              <span className={`px-1.5 py-px rounded-full text-[0.6875rem] leading-tight font-bold whitespace-nowrap shrink-0 ${badgeCls}`}>
                {opts.badge}
              </span>
              {opts.modifiedFrom && h >= 76 && opts.totalCols === 1 && (
                <span
                  className={`min-w-0 truncate text-[0.6875rem] font-semibold ${opts.isCurrent ? 'text-paper/90' : 'text-slate-700'}`}
                >
                  {tr(
                    lang,
                    `변경됨 · 기존 ${opts.modifiedFrom}`,
                    `Changed · was ${opts.modifiedFrom}`,
                    `已调整 · 原 ${opts.modifiedFrom}`
                  )}
                </span>
              )}
            </span>
            {opts.note && h >= 64 && (
              <span
                className={`flex items-center gap-1 min-w-0 text-[0.6875rem] font-medium ${
                  opts.isCurrent ? 'text-paper/90' : 'text-slate-700'
                }`}
              >
                <StickyNote className="w-3 h-3 shrink-0" />
                <span className="truncate">{opts.note}</span>
              </span>
            )}
          </span>
        )}
      </button>
    );
  };

  /** One row in the list mode (school + academy sections). */
  const renderListRow = (opts: {
    key: string;
    kind: 'school' | 'academy';
    startTime: string;
    endTime: string;
    title: string;
    badge: string;
    status?: SlotStatus;
    note?: string;
    isCurrent: boolean;
    isCancelled: boolean;
    isOverlapping: boolean;
    modifiedFrom?: string;
    isMakeup?: boolean;
    onClick: () => void;
  }) => {
    const isSchool = opts.kind === 'school';
    const strip = opts.isCancelled
      ? 'bg-slate-300'
      : opts.status === 'selfStudy'
      ? 'bg-slate-500'
      : opts.status === 'absent'
      ? 'bg-accent-800'
      : isSchool
      ? 'bg-sage-600'
      : 'bg-accent';
    return (
      <button
        key={opts.key}
        type="button"
        onClick={opts.onClick}
        className={`w-full flex items-stretch gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
          opts.isCurrent
            ? isSchool
              ? 'bg-sage-100 ring-2 ring-inset ring-sage-600'
              : 'bg-accent-100 ring-2 ring-inset ring-accent'
            : 'bg-paper hover:bg-slate-100'
        }`}
      >
        <span className="w-12 shrink-0 flex flex-col justify-center">
          <span
            className={`font-mono text-[1rem] leading-none tabular-nums ${
              opts.isCancelled ? 'text-slate-500' : 'text-ink'
            }`}
          >
            {opts.startTime}
          </span>
          <span className="mt-1 font-mono text-[0.6875rem] leading-none tabular-nums text-slate-600">
            {opts.endTime}
          </span>
        </span>
        <span className={`w-1 rounded-full shrink-0 ${strip}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 flex flex-col justify-center gap-1">
          <span className="flex items-center gap-1.5 min-w-0">
            {opts.isOverlapping && !opts.isCancelled && (
              <AlertTriangle className="w-3.5 h-3.5 text-accent-800 shrink-0" aria-label={overlapBadgeLabel} />
            )}
            <span
              className={`min-w-0 truncate text-[0.875rem] font-bold ${
                opts.isCancelled ? 'line-through text-slate-500' : 'text-ink'
              }`}
            >
              {opts.title}
            </span>
          </span>
          <span className="flex items-center gap-1 flex-wrap">
            <span
              className={`px-1.5 py-px rounded-full text-[0.6875rem] leading-tight font-bold whitespace-nowrap ${
                isSchool
                  ? 'bg-sage-200 text-sage-900'
                  : opts.isMakeup
                  ? 'bg-accent-700 text-paper'
                  : 'bg-accent-200 text-accent-900'
              }`}
            >
              {opts.badge}
            </span>
            {opts.isCurrent && (
              <span className="px-1.5 py-px rounded-full bg-ink text-paper text-[0.6875rem] leading-tight font-bold whitespace-nowrap">
                {tr(lang, '수업 중', 'LIVE', '上课中')}
              </span>
            )}
            <StatusTag status={opts.status} lang={lang} />
            {opts.isCancelled && (
              <span className="px-1.5 py-px rounded-full bg-slate-200 text-slate-700 text-[0.6875rem] leading-tight font-bold whitespace-nowrap">
                {statusLabel('cancelled', lang)}
              </span>
            )}
            {opts.modifiedFrom && (
              <span className="text-[0.6875rem] font-semibold text-slate-600 truncate">
                {tr(lang, `기존 ${opts.modifiedFrom}`, `was ${opts.modifiedFrom}`, `原 ${opts.modifiedFrom}`)}
              </span>
            )}
          </span>
          {opts.note && (
            <span className="flex items-center gap-1 min-w-0 text-[0.6875rem] font-medium text-slate-700">
              <StickyNote className="w-3 h-3 shrink-0" />
              <span className="truncate">{opts.note}</span>
            </span>
          )}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 self-center" />
      </button>
    );
  };

  const showLiveNowLine =
    isSelectedToday && nowMinutes >= timelineStartMin && nowMinutes <= timelineEndMin;
  const liveNowTopPx = ((nowMinutes - timelineStartMin) / 60) * HOUR_HEIGHT_PX;

  return (
    <div className="space-y-4">
      {/* NOW CARD (hero): live clock + current / next item + today's makeup classes (always today) */}
      <section
        aria-label={tr(lang, '지금', 'Now', '现在')}
        className="bg-ink text-paper rounded-[32px] p-5 shadow-md space-y-4"
      >
        {/* Identity row: makes the planner feel like the student's own */}
        {(() => {
          const name = profile?.name?.trim() ?? '';
          const school = profile?.school?.trim() ?? '';
          const grade = profile?.grade?.trim() ?? '';
          const hasProfile = !!(name || school || grade);
          if (!hasProfile) {
            return (
              <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-paper/15">
                <span
                  aria-hidden="true"
                  className="w-11 h-11 rounded-full grid place-items-center shrink-0 border-2 border-dashed border-paper/45 text-paper/85"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </span>
                {/* With large text the button wraps under the message instead of squeezing it */}
                <div className="flex-1 min-w-[100px]">
                  <div className="text-[0.875rem] font-bold text-paper leading-snug break-keep">
                    {tr(lang, '나만의 플래너로 만들어 보세요', 'Make this planner your own', '打造专属于你的计划本')}
                  </div>
                  <div className="text-[0.6875rem] font-medium text-paper/75 leading-snug break-keep">
                    {tr(
                      lang,
                      '이름과 학교를 넣으면 여기에 표시돼요',
                      'Add your name and school to show them here',
                      '填写姓名和学校后会显示在这里'
                    )}
                  </div>
                </div>
                {onEditProfile && (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="h-8 px-3 ml-auto rounded-full bg-paper text-ink text-[0.6875rem] font-bold inline-flex items-center gap-1 shrink-0 whitespace-nowrap hover:bg-paper/90 transition-colors"
                  >
                    <UserRound className="w-3.5 h-3.5" strokeWidth={2.5} />
                    {tr(lang, '이름·학교 입력', 'Add name & school', '填写姓名·学校')}
                  </button>
                )}
              </div>
            );
          }
          const hour = now.getHours();
          const greeting =
            hour < 12
              ? tr(lang, '좋은 아침이에요', 'Good morning', '早上好')
              : hour < 18
                ? tr(lang, '좋은 오후예요', 'Good afternoon', '下午好')
                : tr(lang, '좋은 저녁이에요', 'Good evening', '晚上好');
          const words = name.split(/\s+/).filter(Boolean);
          const initials =
            words.length >= 2 && /^[A-Za-z]/.test(words[0])
              ? (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase()
              : (Array.from(name)[0] ?? '').toUpperCase();
          const content = (
            <>
              <span
                aria-hidden="true"
                className="w-12 h-12 rounded-full bg-sage-700 text-paper grid place-items-center shrink-0 ring-2 ring-paper/30 ring-offset-2 ring-offset-ink text-[1.125rem] font-bold"
              >
                {initials || <UserRound className="w-5 h-5" strokeWidth={2.5} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[0.75rem] font-semibold text-paper/80 truncate">
                  {name
                    ? tr(lang, `${greeting},`, `${greeting},`, `${greeting}，`)
                    : greeting}
                </span>
                {name && (
                  <span className="block text-[1.25rem] leading-tight font-bold text-paper truncate">
                    {tr(lang, `${name} 님`, name, name)}
                  </span>
                )}
                {(school || grade) && (
                  <span className="mt-1.5 flex items-center gap-1.5 min-w-0">
                    {school && (
                      <span className="inline-flex items-center gap-1 min-w-0 h-6 px-2.5 rounded-full bg-paper/15 text-paper text-[0.6875rem] font-bold">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{school}</span>
                      </span>
                    )}
                    {grade && (
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-paper/15 text-paper text-[0.6875rem] font-bold whitespace-nowrap shrink-0 max-w-[45%]">
                        <span className="truncate">{grade}</span>
                      </span>
                    )}
                  </span>
                )}
              </span>
            </>
          );
          return onEditProfile ? (
            <button
              type="button"
              onClick={onEditProfile}
              aria-label={tr(
                lang,
                `내 정보 수정: ${[name, school, grade].filter(Boolean).join(', ')}`,
                `Edit my profile: ${[name, school, grade].filter(Boolean).join(', ')}`,
                `编辑我的信息：${[name, school, grade].filter(Boolean).join('，')}`
              )}
              className="group w-full flex items-center gap-3 pb-4 border-b border-paper/15 text-left rounded-t-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
            >
              {content}
              <PenLine
                aria-hidden="true"
                className="w-4 h-4 text-paper/60 group-hover:text-paper shrink-0 self-start mt-1"
                strokeWidth={2.5}
              />
            </button>
          ) : (
            <div className="flex items-center gap-3 pb-4 border-b border-paper/15">{content}</div>
          );
        })()}

        {/* Clock + date */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[0.8125rem] font-bold text-paper/85 tracking-wide">
              <span className="relative inline-flex w-2.5 h-2.5" aria-hidden="true">
                <span className="absolute inset-0 rounded-full bg-accent-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-accent-400" />
              </span>
              {tr(lang, '지금', 'Now', '现在')}
              <span className="text-paper/60 font-semibold">· {tr(lang, '실시간', 'Live', '实时')}</span>
            </div>
            <div className="mt-1 font-mono text-[60px] leading-[0.95] tabular-nums text-paper">
              {minutesToTimeStr(nowMinutes)}
            </div>
          </div>
          <div className="pb-1.5 text-[1rem] font-bold text-paper/90 tabular-nums whitespace-nowrap">
            {formatDateLabel(todayStr, lang)}
          </div>
        </div>

        {/* Current (hero line) */}
        {nowCard.current.length === 0 ? (
          <div className="px-4 py-4 rounded-[24px] bg-paper/10">
            <div className="text-[24px] leading-tight font-bold text-paper">
              {tr(lang, '지금은 빈 시간', 'Free right now', '现在是空闲时间')}
            </div>
            {nowCard.next && (
              <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap text-[0.9375rem] font-semibold text-paper/85">
                <span>{tr(lang, '다음 수업까지', 'Next class in', '距离下节课')}</span>
                <span className="font-mono text-[1.375rem] leading-none tabular-nums text-accent-300">
                  {formatDurationLocalized(nowCard.next.start - nowMinutes, lang)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {nowCard.current.map((entry) => {
              const total = Math.max(1, entry.end - entry.start);
              const elapsed = Math.min(total, Math.max(0, nowMinutes - entry.start));
              const pct = Math.round((elapsed / total) * 100);
              const isSchool = entry.kind === 'school';
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => openNowEntry(entry)}
                  className={`w-full px-4 py-4 rounded-[24px] text-left transition-colors ${
                    isSchool ? 'bg-sage-800 hover:bg-sage-700' : 'bg-accent-800 hover:bg-accent-700'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[0.8125rem] font-bold whitespace-nowrap ${
                        isSchool ? 'bg-sage-300 text-sage-900' : 'bg-accent-300 text-accent-900'
                      }`}
                    >
                      {entry.badge}
                    </span>
                    <span className="text-[0.8125rem] font-semibold text-paper/85">
                      {tr(lang, '수업 중', 'In class', '上课中')}
                    </span>
                    <StatusTag status={entry.status} lang={lang} large />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="min-w-0 text-[26px] leading-tight font-bold text-paper truncate">
                      {entry.subject}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-[28px] leading-none tabular-nums text-paper">
                        {formatDurationLocalized(entry.end - nowMinutes, lang)}
                      </div>
                      <div className="text-[0.8125rem] font-semibold text-paper/85 mt-1">
                        {tr(lang, '남음', 'left', '剩余')}
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-3 h-2.5 rounded-full bg-paper/20 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={tr(lang, '진행률', 'Progress', '进度')}
                  >
                    <div
                      className={`h-full rounded-full ${isSchool ? 'bg-sage-300' : 'bg-accent-300'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[0.8125rem] font-semibold text-paper/85 tabular-nums">
                    <span className="font-mono">{entry.startTime}</span>
                    <span>
                      {tr(
                        lang,
                        `${formatDurationLocalized(elapsed, lang)} 지남`,
                        `${formatDurationLocalized(elapsed, lang)} elapsed`,
                        `已过${formatDurationLocalized(elapsed, lang)}`
                      )}
                    </span>
                    <span className="font-mono">{entry.endTime}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Next */}
        {nowCard.next ? (
          <button
            type="button"
            onClick={() => nowCard.next && openNowEntry(nowCard.next)}
            className="w-full px-4 py-3 rounded-[20px] bg-paper/10 text-left flex items-center justify-between gap-3 hover:bg-paper/15 transition-colors"
          >
            <div className="min-w-0 flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  nowCard.next.kind === 'school' ? 'bg-sage-400' : 'bg-accent-400'
                }`}
              />
              <span className="text-[0.8125rem] font-bold text-paper/80 shrink-0">
                {tr(lang, '다음', 'Next', '下一个')}
              </span>
              <span className="text-[1.0625rem] font-bold text-paper truncate">{nowCard.next.title}</span>
              <StatusTag status={nowCard.next.status} lang={lang} large />
            </div>
            <div className="shrink-0 text-right whitespace-nowrap">
              <div className="font-mono text-[1.125rem] leading-none text-paper tabular-nums">
                {nowCard.next.startTime}
              </div>
              <div className="mt-1 text-[0.8125rem] font-bold text-accent-300 tabular-nums">
                {tr(
                  lang,
                  `${formatDurationLocalized(nowCard.next.start - nowMinutes, lang)} 후`,
                  `in ${formatDurationLocalized(nowCard.next.start - nowMinutes, lang)}`,
                  `${formatDurationLocalized(nowCard.next.start - nowMinutes, lang)}后`
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className="px-4 py-3 rounded-[20px] bg-paper/10 text-[0.9375rem] font-semibold text-paper/85">
            {tr(lang, '오늘 남은 수업이 없어요', 'No more classes today', '今天没有剩余课程')}
          </div>
        )}

        {/* Today's makeup / special classes: contrasting light panel inside the hero */}
        <div className="rounded-[24px] bg-paper text-ink p-4 space-y-2.5">
          <div className="text-[1rem] font-bold text-ink inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            {tr(lang, '오늘 보강/특강', "Today's makeup / special classes", '今日补课/特讲')}
            <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-accent-700 text-paper font-mono text-[0.8125rem] tabular-nums inline-flex items-center justify-center">
              {nowCard.makeups.length + nowCard.makeupSchedules.length}
            </span>
          </div>
          {nowCard.makeups.length === 0 && nowCard.makeupSchedules.length === 0 ? (
            <div className="px-3.5 py-3 rounded-2xl bg-surface text-[0.875rem] font-semibold text-slate-700">
              {tr(lang, '오늘 예정된 보강/특강이 없어요', 'No makeup or special classes today', '今天没有补课/特讲')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {nowCard.makeups.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openNowEntry({ kind: 'academy', academy: m })}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-colors ${
                    m.isCancelled
                      ? 'border border-dashed border-slate-400 bg-surface text-slate-700 line-through'
                      : 'bg-accent-700 text-paper shadow-xs hover:bg-accent-800'
                  }`}
                >
                  <span className="font-mono tabular-nums text-[1rem] shrink-0">
                    {m.startTime}~{m.endTime}
                  </span>
                  <span className="text-[1rem] font-bold truncate flex-1">{slotTitle(m.subject, m.status, lang)}</span>
                  <StatusTag status={m.status} lang={lang} large />
                </button>
              ))}
              {nowCard.makeupSchedules.map((s) => (
                <div
                  key={s.id}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-surface border border-accent-300 text-ink"
                >
                  {s.time && <span className="font-mono tabular-nums text-[1rem] shrink-0">{s.time}</span>}
                  <span className="text-[1rem] font-bold truncate">{translateSampleText(s.title, lang)}</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => openAddAcademyModal('18:00', '20:00', 'button', todayStr)}
            className="w-full h-12 rounded-full bg-accent-700 text-paper text-[0.9375rem] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-800 shadow-xs"
          >
            <Plus className="w-4 h-4" strokeWidth={2.75} />
            {tr(lang, '보강/특강 추가', 'Add makeup / special class', '添加补课/特讲')}
          </button>
        </div>
      </section>

      {/* CONTROLS: view segment + date row + week strip */}
      <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3.5">
        <div
          className="grid grid-cols-2 p-1 rounded-full bg-paper"
          role="tablist"
          aria-label={tr(lang, '보기 방식', 'View', '视图')}
        >
          {(
            [
              { key: 'daily', icon: CalendarDays, label: tr(lang, '일별', 'Daily', '每日') },
              { key: 'weekly', icon: LayoutGrid, label: tr(lang, '주간', 'Weekly', '每周') },
            ] as const
          ).map(({ key, icon: Icon, label }) => {
            const active = viewMode === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(key)}
                className={`h-9 rounded-full text-[0.8125rem] font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  active ? 'bg-accent-700 text-paper shadow-xs' : 'text-slate-700 hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={2.5} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Date row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[44px] leading-none tabular-nums text-ink">
              {selectedDate.getDate()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-[0.9375rem] font-bold text-ink truncate">{monthLabel(selectedDate, lang)}</span>
                {isSelectedToday && (
                  <span className="px-2 py-px rounded-full text-[0.6875rem] font-bold bg-accent-700 text-paper whitespace-nowrap">
                    {tr(lang, '오늘', 'TODAY', '今天')}
                  </span>
                )}
              </div>
              <div className="text-[0.75rem] font-semibold text-slate-600 truncate tabular-nums">
                {viewMode === 'daily'
                  ? (() => {
                      const w = FULL_WEEKDAYS[selectedDate.getDay()];
                      return `${tr(lang, w.ko, w.en, w.zh)} · ${selectedDate.getFullYear()}`;
                    })()
                  : `${tr(lang, '이번 주', 'Week', '本周')} · ${weekRangeLabel}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleStep(-1)}
              className={navBtn}
              aria-label={
                viewMode === 'daily'
                  ? tr(lang, '이전 날짜', 'Previous day', '前一天')
                  : tr(lang, '이전 주', 'Previous week', '上一周')
              }
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.75} />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              disabled={isSelectedToday}
              className={`px-3 h-[34px] rounded-full text-[0.75rem] font-bold whitespace-nowrap transition-colors ${
                isSelectedToday
                  ? 'bg-paper/60 text-slate-500 cursor-default'
                  : 'bg-accent-700 text-paper hover:bg-accent-800'
              }`}
            >
              {tr(lang, '오늘', 'Today', '今天')}
            </button>
            <button
              type="button"
              onClick={() => handleStep(1)}
              className={navBtn}
              aria-label={
                viewMode === 'daily'
                  ? tr(lang, '다음 날짜', 'Next day', '后一天')
                  : tr(lang, '다음 주', 'Next week', '下一周')
              }
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.75} />
            </button>
          </div>
        </div>

        {/* Week strip (Mon–Sun) */}
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={tr(lang, '이번 주', 'This week', '本周')}>
          {weekDays.map((wd) => {
            const mk = weekMarkers[wd.dateStr] || { makeup: false, changed: false, schedule: false };
            const tone = wd.isSelected
              ? 'bg-accent-700 text-paper'
              : wd.isToday
              ? 'bg-paper ring-[1.5px] ring-inset ring-accent text-accent-800'
              : 'bg-paper/70 text-ink hover:bg-paper';
            const extra = [
              mk.makeup ? tr(lang, '보강 있음', 'makeup', '有补课') : '',
              mk.changed ? tr(lang, '변경 있음', 'changed', '有调整') : '',
              mk.schedule ? tr(lang, '일정 있음', 'schedule', '有日程') : '',
            ].filter(Boolean);
            return (
              <button
                key={wd.dateStr}
                type="button"
                onClick={() => setSelectedDate(wd.dateObj)}
                aria-pressed={wd.isSelected}
                aria-label={`${formatDateLabel(wd.dateStr, lang)}${extra.length ? ` · ${extra.join(', ')}` : ''}`}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors min-w-0 ${tone}`}
              >
                <span
                  className={`text-[0.6875rem] font-semibold leading-tight ${
                    wd.isSelected
                      ? 'text-paper/90'
                      : wd.isToday
                      ? 'text-accent-800'
                      : weekendTint(wd.dayLabel) || 'text-slate-600'
                  }`}
                >
                  {translateDay(wd.dayLabel, lang)}
                </span>
                <span className="font-mono text-[1rem] leading-none tabular-nums">{wd.dayNumber}</span>
                <span className="h-1.5 flex items-center gap-0.5" aria-hidden="true">
                  {mk.makeup && (
                    <span className={`w-1.5 h-1.5 rounded-full ${wd.isSelected ? 'bg-paper' : 'bg-accent'}`} />
                  )}
                  {mk.changed && (
                    <span className={`w-1.5 h-1.5 rounded-full ${wd.isSelected ? 'bg-paper/70' : 'bg-slate-500'}`} />
                  )}
                  {mk.schedule && (
                    <span className={`w-1.5 h-1.5 rounded-full ${wd.isSelected ? 'bg-other-200' : 'bg-other'}`} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-3 text-[0.6875rem] font-semibold text-slate-600 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {tr(lang, '보강/특강', 'Makeup', '补课/特讲')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            {tr(lang, '변경', 'Changed', '调整')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-other" />
            {tr(lang, '일정', 'Schedule', '日程')}
          </span>
        </div>
      </section>

      {/* VIEW MODE 1: DAILY DETAILED VIEW */}
      {viewMode === 'daily' ? (
        <div className="space-y-4">
          {/* Day summary: spectrum + stat tiles + conflicts */}
          <section className="bg-surface rounded-2xl p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink min-w-0">
                <Clock className="w-4 h-4 text-accent-700 shrink-0" strokeWidth={2.5} />
                <span className="truncate">{tr(lang, '하루 한눈에', 'Day at a glance', '一天概览')}</span>
              </h2>
              <span className="text-[0.6875rem] font-mono text-slate-600 tabular-nums whitespace-nowrap">
                {startHourFormatted} – {endHourFormatted}
              </span>
            </div>

            {/* Spectrum bar with hour ticks */}
            <div>
              <div className="relative h-3 w-full rounded-full bg-paper overflow-hidden">
                {timelineLayout.spectrumSegments
                  .filter((seg) => seg.type !== 'free')
                  .map((seg, i) => (
                    <div
                      key={i}
                      title={seg.label}
                      style={{ left: `${seg.leftPercent}%`, width: `${seg.widthPercent}%` }}
                      className={`absolute top-0 bottom-0 ${
                        seg.type === 'conflict'
                          ? 'bg-accent-800 z-10'
                          : seg.type === 'school'
                          ? 'bg-sage-600'
                          : 'bg-accent'
                      }`}
                    />
                  ))}
                {showLiveNowLine && (
                  <div
                    className="absolute -top-px -bottom-px w-0.5 bg-ink z-20"
                    style={{ left: `${((nowMinutes - timelineStartMin) / totalTimelineMinutes) * 100}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="relative h-5 mt-1" aria-hidden="true">
                {spectrumTickHours.map((h, idx) => {
                  const pct = ((h - startHour) / totalHours) * 100;
                  const isFirst = idx === 0;
                  const isLast = idx === spectrumTickHours.length - 1;
                  return (
                    <span
                      key={h}
                      className={`absolute top-0 flex flex-col ${
                        isFirst ? 'items-start' : isLast ? 'items-end -translate-x-full' : 'items-center -translate-x-1/2'
                      }`}
                      style={{ left: `${pct}%` }}
                    >
                      <span className="w-px h-1 bg-slate-400" />
                      <span className="font-mono text-[0.6875rem] leading-none text-slate-600 tabular-nums mt-0.5">{h}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    key: 'school',
                    icon: GraduationCap,
                    label: tr(lang, '학교', 'School', '学校'),
                    min: timelineLayout.schoolMinutesTotal,
                    iconCls: 'bg-sage-700 text-paper',
                    numCls: 'text-sage-900',
                  },
                  {
                    key: 'academy',
                    icon: Building2,
                    label: tr(lang, '학원', 'Academy', '补习班'),
                    min: timelineLayout.academyMinutesTotal,
                    iconCls: 'bg-accent-700 text-paper',
                    numCls: 'text-accent-900',
                  },
                  {
                    key: 'free',
                    icon: Sparkles,
                    label: tr(lang, '빈 시간', 'Free', '空闲'),
                    min: timelineLayout.totalFreeMin,
                    iconCls: 'bg-slate-200 text-slate-700',
                    numCls: 'text-ink',
                  },
                ] as const
              ).map(({ key, icon: Icon, label, min, iconCls, numCls }) => (
                <div key={key} className="p-2.5 rounded-xl bg-paper min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconCls}`}>
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-[0.6875rem] font-bold text-slate-700 truncate">{label}</span>
                  </div>
                  <div className={`mt-2 ${numCls}`}>
                    <DurationNum minutes={min} lang={lang} />
                  </div>
                </div>
              ))}
            </div>

            {/* Conflict warning */}
            {timelineLayout.conflictZones.length > 0 && (
              <div className="rounded-xl bg-accent-800 text-paper p-3 space-y-2" role="alert">
                <div className="flex items-center gap-2 text-[0.8125rem] font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      lang,
                      `시간이 겹치는 구간 ${timelineLayout.conflictZones.length}곳`,
                      `${timelineLayout.conflictZones.length} overlapping time range(s)`,
                      `${timelineLayout.conflictZones.length} 处时间冲突`
                    )}
                  </span>
                </div>
                <div className="space-y-1">
                  {timelineLayout.conflictZones.map((cz) => (
                    <div
                      key={cz.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-paper/15 text-[0.75rem] min-w-0"
                    >
                      <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                        {cz.startTime}–{cz.endTime}
                      </span>
                      <span className="font-semibold truncate text-paper/90">
                        {cz.involvedSubjects.join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div
                className="flex-1 grid grid-cols-2 p-1 rounded-full bg-paper"
                role="tablist"
                aria-label={tr(lang, '표시 방식', 'Display', '显示方式')}
              >
                {(
                  [
                    { key: 'timeline', icon: CalendarRange, label: tr(lang, '타임라인', 'Timeline', '时间轴') },
                    { key: 'list', icon: AlignJustify, label: tr(lang, '목록형', 'List', '列表') },
                  ] as const
                ).map(({ key, icon: Icon, label }) => {
                  const active = dailySubMode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setDailySubMode(key)}
                      className={`h-8 rounded-full text-[0.75rem] font-bold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                        active ? 'bg-ink text-paper' : 'text-slate-700 hover:text-ink'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => openAddAcademyModal('18:00', '20:00')}
                className="h-10 px-3.5 rounded-full border border-divider bg-paper text-accent-800 text-[0.75rem] font-bold inline-flex items-center gap-1 hover:bg-accent-100 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" strokeWidth={2.75} />
                {tr(lang, '보강 추가', 'Makeup', '加补课')}
              </button>
            </div>
          </section>

          {dailySubMode === 'timeline' ? (
            /* VERTICAL TIMELINE VIEW */
            <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-2 flex-wrap">
                <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                  <CalendarRange className="w-4 h-4 text-accent-700" strokeWidth={2.5} />
                  {tr(lang, '타임라인', 'Timeline', '时间轴')}
                </h2>
                <div className="flex items-center gap-2.5 text-[0.6875rem] font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sage-600" />
                    {tr(lang, '학교', 'School', '学校')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    {tr(lang, '학원', 'Academy', '补习班')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full border border-dashed border-slate-500" />
                    {tr(lang, '빈 시간', 'Free', '空闲')}
                  </span>
                </div>
              </div>

              <div className="relative select-none pl-1 pr-3 pt-3 pb-4">
                <div className="relative flex" style={{ height: `${totalHours * HOUR_HEIGHT_PX}px` }}>
                  {/* Hour gutter */}
                  <div className="w-11 shrink-0 relative" aria-hidden="true">
                    {hoursArray.map((hour) => (
                      <span
                        key={hour}
                        className="absolute right-2 -translate-y-1/2 font-mono text-[0.75rem] leading-none text-slate-600 tabular-nums"
                        style={{ top: `${(hour - startHour) * HOUR_HEIGHT_PX}px` }}
                      >
                        {String(hour).padStart(2, '0')}
                      </span>
                    ))}
                  </div>

                  {/* Canvas */}
                  <div
                    className="flex-1 relative cursor-pointer min-w-0"
                    onClick={handleCanvasClick}
                    title={tr(lang, '빈 곳을 눌러 추가', 'Tap empty space to add', '点击空白处添加')}
                  >
                    {hoursArray.map((hour, idx) => {
                      const topPx = idx * HOUR_HEIGHT_PX;
                      const isLast = hour === endHour;
                      return (
                        <React.Fragment key={hour}>
                          <div
                            className="absolute left-0 right-0 border-t border-divider pointer-events-none"
                            style={{ top: `${topPx}px` }}
                          />
                          {!isLast && (
                            <div
                              className="absolute left-0 right-0 border-t border-dashed border-slate-300/50 pointer-events-none"
                              style={{ top: `${topPx + HOUR_HEIGHT_PX / 2}px` }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Conflict bands */}
                    {timelineLayout.conflictZones.map((cz) => (
                      <div
                        key={cz.id}
                        style={{ top: `${cz.topPx}px`, height: `${cz.heightPx}px` }}
                        className="absolute left-0 right-0 z-20 pointer-events-none rounded-xl border-2 border-dashed border-accent-800 bg-accent-800/10 flex items-start justify-end"
                      >
                        <span className="-mt-2.5 mr-2 px-2 py-px rounded-full bg-accent-800 text-paper text-[0.6875rem] font-bold shadow-xs inline-flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="font-mono tabular-nums">
                            {cz.startTime}–{cz.endTime}
                          </span>
                        </span>
                      </div>
                    ))}

                    {/* Free slots */}
                    {timelineLayout.freeSlots.map((slot) => {
                      const topPx = ((slot.startMin - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
                      const heightPx = Math.max(26, (slot.durationMin / 60) * HOUR_HEIGHT_PX - 6);
                      const roomy = heightPx >= 52;
                      return (
                        <button
                          key={`free-${slot.startTime}-${slot.endTime}`}
                          type="button"
                          onClick={() => openAddAcademyModal(slot.startTime, slot.endTime)}
                          aria-label={`${slot.startTime}–${slot.endTime} ${tr(lang, '빈 시간에 추가', 'Add in free time', '在空闲时间添加')}`}
                          style={{ top: `${topPx + 3}px`, height: `${heightPx}px` }}
                          className="group absolute left-[3px] right-[3px] rounded-xl border border-dashed border-slate-400/70 bg-[image:repeating-linear-gradient(135deg,color-mix(in_srgb,var(--color-slate-300)_35%,transparent)_0_5px,transparent_5px_11px)] hover:bg-paper/60 hover:border-accent transition-colors px-3 flex items-center justify-between gap-2 text-left overflow-hidden"
                        >
                          <span className="min-w-0 flex-1 flex flex-col">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-[0.6875rem] text-slate-700 tabular-nums whitespace-nowrap">
                                {slot.startTime} – {slot.endTime}
                              </span>
                              <span className="text-[0.6875rem] font-bold text-slate-600 whitespace-nowrap">
                                · {formatDurationLocalized(slot.durationMin, lang)}
                              </span>
                            </span>
                            {roomy && (
                              <span className="text-[0.6875rem] font-medium text-slate-600 truncate mt-0.5">
                                {slot.contextLabel}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-paper border border-divider text-[0.6875rem] font-bold text-accent-800 group-hover:bg-accent-700 group-hover:text-paper group-hover:border-transparent transition-colors">
                            <Plus className="w-3 h-3" strokeWidth={3} />
                            {tr(lang, '추가', 'Add', '添加')}
                          </span>
                        </button>
                      );
                    })}

                    {/* School blocks */}
                    {timelineLayout.schoolLayout.map(({ item, topPx, heightPx, totalCols, colIndex }) =>
                      renderTimelineBlock({
                        key: `school-${item.period}`,
                        kind: 'school',
                        topPx,
                        heightPx,
                        totalCols,
                        colIndex,
                        title: item.isCancelled
                          ? translateSubject(item.subject, lang)
                          : slotTitle(item.subject, item.status, lang),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        badge: periodLabel(item.period, lang),
                        status: item.status,
                        note: item.note,
                        isCurrent:
                          isSelectedToday &&
                          !item.isCancelled &&
                          isTimeInRange(nowMinutes, item.startTime, item.endTime),
                        isCancelled: item.isCancelled,
                        isOverlapping: item.isOverlapping,
                        modifiedFrom:
                          item.isModified && item.originalSubject !== item.subject
                            ? translateSubject(item.originalSubject, lang)
                            : undefined,
                        onClick: () => openSchoolEdit(item),
                      })
                    )}

                    {/* Academy blocks */}
                    {timelineLayout.academyLayout.map(({ item, topPx, heightPx, totalCols, colIndex }) =>
                      renderTimelineBlock({
                        key: `academy-${item.id}`,
                        kind: 'academy',
                        topPx,
                        heightPx,
                        totalCols,
                        colIndex,
                        title: item.isCancelled
                          ? translateSubject(item.subject, lang)
                          : slotTitle(item.subject, item.status, lang),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        badge: item.isAdded
                          ? tr(lang, '보강', 'Makeup', '补课')
                          : tr(lang, '학원', 'Academy', '补习班'),
                        status: item.status,
                        note: item.note,
                        isCurrent:
                          isSelectedToday &&
                          !item.isCancelled &&
                          isTimeInRange(nowMinutes, item.startTime, item.endTime),
                        isCancelled: item.isCancelled,
                        isOverlapping: item.isOverlapping,
                        modifiedFrom:
                          item.isModified && !item.isAdded && item.originalSubject && item.originalSubject !== item.subject
                            ? translateSubject(item.originalSubject, lang)
                            : undefined,
                        isMakeup: item.isAdded,
                        onClick: () => openEditAcademyModal(item),
                      })
                    )}

                    {/* Schedule markers (일정) */}
                    {daySchedules
                      .filter((sch) => sch.time)
                      .map((sch) => {
                        const m = timeToMinutes(sch.time as string);
                        if (m < timelineStartMin || m > timelineEndMin) return null;
                        const topPx = ((m - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
                        const tone = SCHEDULE_CAT_TONE[sch.category] || SCHEDULE_CAT_TONE.other;
                        return (
                          <div
                            key={`sch-${sch.id}`}
                            className={`absolute right-1.5 z-20 pointer-events-none max-w-[58%] -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-xs text-[0.6875rem] ${tone.pill}`}
                            style={{ top: `${Math.max(10, topPx)}px` }}
                          >
                            <CalendarClock className="w-3 h-3 shrink-0" />
                            <span className="font-mono tabular-nums shrink-0">{sch.time}</span>
                            <span className="font-bold truncate">{translateSampleText(sch.title, lang)}</span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Now line (spans gutter + canvas) */}
                  {showLiveNowLine && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center -translate-y-1/2"
                      style={{ top: `${liveNowTopPx}px` }}
                      aria-label={`${tr(lang, '지금', 'Now', '现在')} ${minutesToTimeStr(nowMinutes)}`}
                    >
                      <span className="w-11 shrink-0 flex justify-end pr-0.5">
                        <span className="px-1.5 py-0.5 rounded-full bg-accent-700 text-paper font-mono text-[0.6875rem] leading-none tabular-nums shadow-xs">
                          {minutesToTimeStr(nowMinutes)}
                        </span>
                      </span>
                      <span className="w-2 h-2 rounded-full bg-accent-700 shrink-0 -ml-0.5" />
                      <span className="flex-1 border-t-2 border-accent-700" />
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            /* LIST VIEW */
            <div className="space-y-4">
              <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                    <GraduationCap className="w-4 h-4 text-sage-700" strokeWidth={2.5} />
                    {tr(lang, '학교', 'School', '学校')}
                    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-sage-700 text-paper font-mono text-[0.6875rem] tabular-nums inline-flex items-center justify-center">
                      {dailyData.school.length}
                    </span>
                  </h2>
                  <span className="text-[0.6875rem] font-semibold text-slate-600">
                    {tr(lang, '눌러서 이 날만 변경', 'Tap to edit this day', '点击修改当天')}
                  </span>
                </div>
                {dailyData.school.length === 0 ? (
                  <p className="py-6 text-center text-[0.8125rem] font-medium text-slate-600 rounded-xl bg-paper">
                    {tr(
                      lang,
                      '등록된 정규 학교 수업이 없습니다.',
                      'No regular school classes scheduled.',
                      '当天没有登记常规学校课程。'
                    )}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dailyData.school.map((item) =>
                      renderListRow({
                        key: `school-${item.period}`,
                        kind: 'school',
                        startTime: item.startTime,
                        endTime: item.endTime,
                        title: item.isCancelled
                          ? translateSubject(item.subject, lang)
                          : slotTitle(item.subject, item.status, lang),
                        badge: periodLabel(item.period, lang),
                        status: item.status,
                        note: item.note,
                        isCurrent:
                          isSelectedToday &&
                          !item.isCancelled &&
                          isTimeInRange(nowMinutes, item.startTime, item.endTime),
                        isCancelled: item.isCancelled,
                        isOverlapping: item.isOverlapping,
                        modifiedFrom:
                          item.isModified && item.originalSubject !== item.subject
                            ? translateSubject(item.originalSubject, lang)
                            : undefined,
                        onClick: () => openSchoolEdit(item),
                      })
                    )}
                  </div>
                )}
              </section>

              <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                    <Building2 className="w-4 h-4 text-accent-700" strokeWidth={2.5} />
                    {tr(lang, '학원', 'Academy', '补习班')}
                    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent-700 text-paper font-mono text-[0.6875rem] tabular-nums inline-flex items-center justify-center">
                      {dailyData.academy.length}
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => openAddAcademyModal('18:00', '20:00')}
                    className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-accent-700 text-paper text-[0.75rem] font-bold hover:bg-accent-800 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.75} />
                    {tr(lang, '보강/특강', 'Makeup', '补课/特讲')}
                  </button>
                </div>
                {dailyData.academy.length === 0 ? (
                  <p className="py-6 text-center text-[0.8125rem] font-medium text-slate-600 rounded-xl bg-paper">
                    {tr(
                      lang,
                      '이 날 예정된 학원 수업이 없습니다.',
                      'No academy classes scheduled for this day.',
                      '当天没有安排补习班课程。'
                    )}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dailyData.academy.map((item) =>
                      renderListRow({
                        key: `academy-${item.id}`,
                        kind: 'academy',
                        startTime: item.startTime,
                        endTime: item.endTime,
                        title: item.isCancelled
                          ? translateSubject(item.subject, lang)
                          : slotTitle(item.subject, item.status, lang),
                        badge: item.isAdded
                          ? tr(lang, '보강', 'Makeup', '补课')
                          : tr(lang, '학원', 'Academy', '补习班'),
                        status: item.status,
                        note: item.note,
                        isCurrent:
                          isSelectedToday &&
                          !item.isCancelled &&
                          isTimeInRange(nowMinutes, item.startTime, item.endTime),
                        isCancelled: item.isCancelled,
                        isOverlapping: item.isOverlapping,
                        modifiedFrom:
                          item.isModified && !item.isAdded && item.originalSubject && item.originalSubject !== item.subject
                            ? translateSubject(item.originalSubject, lang)
                            : undefined,
                        isMakeup: item.isAdded,
                        onClick: () => openEditAcademyModal(item),
                      })
                    )}
                  </div>
                )}
              </section>

              {daySchedules.length > 0 && (
                <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
                  <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                    <CalendarClock className="w-4 h-4 text-other-700" strokeWidth={2.5} />
                    {tr(lang, '이날의 일정', 'Schedules on this day', '当天日程')}
                    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-other-700 text-paper font-mono text-[0.6875rem] tabular-nums inline-flex items-center justify-center">
                      {daySchedules.length}
                    </span>
                  </h2>
                  <div className="space-y-1.5">
                    {daySchedules.map((sch) => {
                      const tone = SCHEDULE_CAT_TONE[sch.category] || SCHEDULE_CAT_TONE.other;
                      return (
                        <div key={sch.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-paper">
                          <span className="w-12 shrink-0 font-mono text-[0.875rem] leading-none text-ink tabular-nums">
                            {sch.time || (
                              <span className="font-sans text-[0.6875rem] font-bold text-slate-600">
                                {tr(lang, '종일', 'All day', '全天')}
                              </span>
                            )}
                          </span>
                          <span className={`w-1 self-stretch rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.875rem] font-bold text-ink truncate">
                              {translateSampleText(sch.title, lang)}
                            </div>
                            {sch.memo && (
                              <div className="text-[0.6875rem] text-slate-600 truncate">
                                {translateSampleText(sch.memo, lang)}
                              </div>
                            )}
                          </div>
                          <span
                            className={`px-2 py-px rounded-full border text-[0.6875rem] font-bold shrink-0 ${tone.pill}`}
                          >
                            {categoryLabel(sch.category, lang)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: WEEKLY OVERVIEW */
        <div className="space-y-4">
          <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink min-w-0">
                <GraduationCap className="w-4 h-4 text-sage-700 shrink-0" strokeWidth={2.5} />
                <span className="truncate">{tr(lang, '학교 시간표 · 월~금', 'School · Mon–Fri', '学校课表 · 周一至周五')}</span>
              </h2>
              <span className="text-[0.6875rem] font-semibold text-slate-600 whitespace-nowrap">
                {tr(lang, '칸을 눌러 수정', 'Tap a cell to edit', '点击单元格修改')}
              </span>
            </div>

            {weeklyPeriods.length === 0 ? (
              <p className="py-6 text-center text-[0.8125rem] font-medium text-slate-600 rounded-xl bg-paper">
                {tr(lang, '이번 주 학교 수업이 없어요.', 'No school classes this week.', '本周没有学校课程。')}
              </p>
            ) : (
              <div className="rounded-xl bg-paper overflow-x-auto">
                <table className="w-full text-center border-collapse table-fixed min-w-[320px]">
                  <thead>
                    <tr className="border-b border-divider">
                      <th className="sticky left-0 z-10 bg-paper w-[54px] py-2 px-1 text-[0.6875rem] font-semibold text-slate-600 border-r border-divider">
                        {tr(lang, '교시', 'Per', '课时')}
                      </th>
                      {weeklyData.slice(0, 5).map((wd) => (
                        <th key={wd.dateStr} className="p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDate(wd.dateObj);
                              setViewMode('daily');
                            }}
                            aria-label={formatDateLabel(wd.dateStr, lang)}
                            className={`w-full py-1 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
                              wd.isToday
                                ? 'bg-accent-700 text-paper'
                                : wd.isSelected
                                ? 'bg-surface text-ink ring-[1.5px] ring-inset ring-accent'
                                : 'text-ink hover:bg-surface'
                            }`}
                          >
                            <span className={`text-[0.6875rem] font-bold ${wd.isToday ? 'text-paper/90' : 'text-slate-600'}`}>
                              {translateDay(wd.dayLabel, lang)}
                            </span>
                            <span className="font-mono text-[0.875rem] leading-none tabular-nums">{wd.dayNumber}</span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyPeriods.map(({ period, startTime }) => (
                      <tr key={period} className="border-b border-divider last:border-b-0">
                        <td className="sticky left-0 z-10 bg-paper px-1 py-1 border-r border-divider">
                          <div className="flex flex-col items-center leading-tight">
                            <span className="text-[0.6875rem] font-bold text-sage-800">{periodLabel(period, lang)}</span>
                            <span className="font-mono text-[0.6875rem] text-slate-600 tabular-nums">{startTime}</span>
                          </div>
                        </td>
                        {weeklyData.slice(0, 5).map((wd) => {
                          const cell = wd.resolved.school.find((s) => s.period === period);
                          if (!cell) {
                            return (
                              <td key={wd.dateStr} className={`p-0.5 ${wd.isToday ? 'bg-accent-100/60' : ''}`}>
                                <span className="block py-2 text-[0.6875rem] text-slate-400">–</span>
                              </td>
                            );
                          }
                          const cellTone = cell.isCancelled
                            ? 'bg-paper border border-dashed border-slate-400 text-slate-600 line-through'
                            : cell.status === 'absent'
                            ? 'bg-accent-100 text-accent-900'
                            : cell.status === 'selfStudy'
                            ? 'bg-slate-200 text-ink'
                            : wd.isToday
                            ? 'bg-sage-200 text-sage-900'
                            : 'bg-sage-100 text-sage-900';
                          return (
                            <td key={wd.dateStr} className={`p-0.5 ${wd.isToday ? 'bg-accent-100/60' : ''}`}>
                              <button
                                type="button"
                                onClick={() => openItemOnDate({ kind: 'school', item: cell }, wd.dateObj)}
                                aria-label={`${formatDateLabel(wd.dateStr, lang)} ${periodLabel(period, lang)} ${translateSubject(cell.subject, lang)}`}
                                className={`relative w-full min-h-[40px] px-0.5 py-1 rounded-lg flex flex-col items-center justify-center gap-0.5 hover:brightness-95 active:scale-95 transition ${cellTone}`}
                              >
                                <span className="w-full truncate text-[0.6875rem] font-bold leading-tight">
                                  {cell.status === 'selfStudy'
                                    ? tr(lang, '자습', 'Study', '自习')
                                    : translateSubject(cell.subject, lang)}
                                </span>
                                {(cell.status === 'absent' || cell.isCancelled) && (
                                  <span
                                    className={`px-1 rounded-full text-[0.6875rem] leading-tight font-bold no-underline ${
                                      cell.isCancelled ? 'bg-slate-200 text-slate-700' : 'bg-accent-800 text-paper'
                                    }`}
                                  >
                                    {statusLabel(cell.isCancelled ? 'cancelled' : 'absent', lang)}
                                  </span>
                                )}
                                {(cell.note || (cell.isModified && !cell.isCancelled)) && (
                                  <span className="absolute top-0.5 right-0.5 flex gap-0.5" aria-hidden="true">
                                    {cell.isModified && !cell.isCancelled && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                    )}
                                    {cell.note && <span className="w-1.5 h-1.5 rounded-full bg-other" />}
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center gap-3 text-[0.6875rem] font-semibold text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                {tr(lang, '과목 변경', 'Changed', '已调课')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-other" />
                {tr(lang, '메모', 'Note', '备注')}
              </span>
            </div>
          </section>

          <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
            <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
              <Building2 className="w-4 h-4 text-accent-700" strokeWidth={2.5} />
              {tr(lang, '학원 · 월~일', 'Academies · Mon–Sun', '补习班 · 周一至周日')}
            </h2>
            <div className="space-y-1.5">
              {weeklyData.map((wd) => (
                <div
                  key={wd.dateStr}
                  className={`flex items-center gap-3 p-2 rounded-xl ${
                    wd.isToday ? 'bg-accent-100 ring-[1.5px] ring-inset ring-accent' : 'bg-paper'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(wd.dateObj);
                      setViewMode('daily');
                    }}
                    aria-label={formatDateLabel(wd.dateStr, lang)}
                    className="shrink-0 rounded-xl hover:brightness-95 active:scale-95 transition"
                  >
                    {renderDateBlock(wd.dateStr, wd.isToday ? 'accent' : 'plain', 'sm')}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                    {wd.resolved.academy.length === 0 ? (
                      <span className="text-[0.75rem] font-medium text-slate-500">
                        {tr(lang, '학원 없음', 'No academy', '无补习班')}
                      </span>
                    ) : (
                      wd.resolved.academy.map((ac) => (
                        <button
                          key={ac.id}
                          type="button"
                          onClick={() => openItemOnDate({ kind: 'academy', item: ac }, wd.dateObj)}
                          className={`max-w-full px-2.5 py-1 rounded-full text-[0.75rem] inline-flex items-center gap-1.5 active:scale-95 transition ${
                            ac.isCancelled
                              ? 'bg-paper border border-dashed border-slate-400 text-slate-600'
                              : ac.status === 'selfStudy'
                              ? 'bg-slate-200 text-ink'
                              : ac.isAdded
                              ? 'bg-accent-700 text-paper hover:bg-accent-800'
                              : 'bg-accent-100 text-accent-900 hover:bg-accent-200 border border-accent-200'
                          } ${ac.isOverlapping && !ac.isCancelled ? 'ring-2 ring-accent-800' : ''}`}
                        >
                          {ac.isOverlapping && !ac.isCancelled && (
                            <AlertTriangle className="w-3 h-3 shrink-0" aria-label={overlapBadgeLabel} />
                          )}
                          <span className="font-mono text-[0.6875rem] tabular-nums shrink-0">{ac.startTime}</span>
                          <span className={`font-bold truncate ${ac.isCancelled ? 'line-through' : ''}`}>
                            {ac.isCancelled ? translateSubject(ac.subject, lang) : slotTitle(ac.subject, ac.status, lang)}
                          </span>
                          {ac.isCancelled && (
                            <span className="text-[0.6875rem] font-bold">{statusLabel('cancelled', lang)}</span>
                          )}
                          <StatusTag status={ac.status} lang={lang} />
                          {ac.note && <StickyNote className="w-3 h-3 shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* SHEET 1: SCHOOL PERIOD EDIT */}
      {editingSchoolPeriod && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
          onClick={() => {
            handleSaveSchoolNote();
            closeEditSheet();
          }}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 pb-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {renderDateBlock(editDateStr, 'sage')}
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-bold text-ink truncate">
                    {translateSubject(editingSchoolPeriod.subject, lang)}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="px-2 py-px rounded-full bg-sage-200 text-sage-900 text-[0.6875rem] font-bold">
                      {periodLabel(editingSchoolPeriod.period, lang)}
                    </span>
                    <span className="font-mono text-[0.75rem] text-slate-700 tabular-nums">
                      {editingSchoolPeriod.startTime} – {editingSchoolPeriod.endTime}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSaveSchoolNote();
                  closeEditSheet();
                }}
                className="w-9 h-9 shrink-0 rounded-full bg-surface flex items-center justify-center text-slate-600 hover:bg-slate-200"
                aria-label={tr(lang, '닫기', 'Close', '关闭')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[0.75rem] font-medium text-slate-600 -mt-1">
              {formatDateLabel(editDateStr, lang)} ·{' '}
              {tr(
                lang,
                '여기서 바꾼 내용은 이 날짜에만 적용됩니다.',
                'Changes here apply to this date only.',
                '此处的修改仅适用于当天。'
              )}
            </p>

            {renderStatusAndNote(
              editingSchoolPeriod.status,
              handleToggleSchoolStatus,
              handleSaveSchoolNote,
              editingSchoolPeriod.note ?? ''
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                  <GraduationCap className="w-4 h-4 text-sage-700" />
                  {tr(lang, '과목 바꾸기', 'Change subject', '更换科目')}
                </span>
                <span className="text-[0.6875rem] font-semibold text-slate-600">
                  {tr(lang, '누르면 바로 적용', 'Applies instantly', '点击立即生效')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {subjectPool.school.map((subj) => {
                  const isCurrent = !editingSchoolPeriod.isCancelled && editingSchoolPeriod.subject === subj;
                  const isOriginal = editingSchoolPeriod.originalSubject === subj;
                  return (
                    <button
                      key={subj}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => handleSelectSchoolSubject(subj)}
                      className={`min-h-[44px] px-2 py-1.5 rounded-full text-[0.8125rem] font-semibold border transition-all flex flex-col items-center justify-center leading-tight ${
                        isCurrent
                          ? 'bg-sage-700 text-paper border-transparent'
                          : 'bg-surface text-ink border-transparent hover:bg-sage-100 active:scale-95'
                      }`}
                    >
                      <span className="truncate max-w-full">{translateSubject(subj, lang)}</span>
                      {isOriginal && (
                        <span className={`text-[0.6875rem] font-medium ${isCurrent ? 'text-paper/85' : 'text-slate-600'}`}>
                          {tr(lang, '기본', 'Default', '默认')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRestoreSchoolPeriod}
              className="w-full h-11 rounded-full border border-divider text-ink text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
              {tr(lang, '기본 시간표로 원상복구', 'Restore Default', '恢复默认课表')}
            </button>
          </div>
        </div>
      )}

      {/* SHEET 2: ACADEMY EDIT */}
      {editingAcademyItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
          onClick={() => {
            handleSaveAcademyNote();
            closeEditSheet();
          }}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 pb-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {renderDateBlock(editDateStr, 'accent')}
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-bold text-ink truncate">
                    {translateSubject(editingAcademyItem.subject, lang)}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span
                      className={`px-2 py-px rounded-full text-[0.6875rem] font-bold ${
                        editingAcademyItem.isAdded ? 'bg-accent-700 text-paper' : 'bg-accent-200 text-accent-900'
                      }`}
                    >
                      {editingAcademyItem.isAdded
                        ? tr(lang, '당일 보강', 'Makeup', '临时补课')
                        : tr(lang, '학원', 'Academy', '补习班')}
                    </span>
                    <span className="font-mono text-[0.75rem] text-slate-700 tabular-nums">
                      {editingAcademyItem.startTime} – {editingAcademyItem.endTime}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSaveAcademyNote();
                  closeEditSheet();
                }}
                className="w-9 h-9 shrink-0 rounded-full bg-surface flex items-center justify-center text-slate-600 hover:bg-slate-200"
                aria-label={tr(lang, '닫기', 'Close', '关闭')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[0.75rem] font-medium text-slate-600 -mt-1">
              {formatDateLabel(editDateStr, lang)} ·{' '}
              {tr(
                lang,
                '여기서 바꾼 내용은 이 날짜에만 적용됩니다.',
                'Changes here apply to this date only.',
                '此处的修改仅适用于当天。'
              )}
            </p>

            {renderStatusAndNote(
              editingAcademyItem.status,
              handleToggleAcademyStatus,
              handleSaveAcademyNote,
              editingAcademyItem.note ?? ''
            )}

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                <Clock className="w-4 h-4 text-accent-700" />
                {tr(lang, '수업 시간', 'Class time', '上课时间')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value)}
                  aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
                  className="flex-1 min-w-0 h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
                />
                <span className="text-sm font-bold text-slate-500">–</span>
                <input
                  type="time"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value)}
                  aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                  className="flex-1 min-w-0 h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveAcademyTimeOnly}
                disabled={
                  tempStartTime === editingAcademyItem.startTime && tempEndTime === editingAcademyItem.endTime
                }
                className="w-full h-11 rounded-full bg-accent-700 text-paper text-[0.8125rem] font-bold hover:bg-accent-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-default inline-flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" strokeWidth={2.75} />
                {tr(lang, '시간 저장', 'Save time', '保存时间')}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                  <Building2 className="w-4 h-4 text-accent-700" />
                  {tr(lang, '학원 바꾸기', 'Change academy', '更换补习班')}
                </span>
                <span className="text-[0.6875rem] font-semibold text-slate-600">
                  {tr(lang, '누르면 바로 적용', 'Applies instantly', '点击立即生效')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {subjectPool.academy.map((acName) => {
                  const isCurrent = !editingAcademyItem.isCancelled && editingAcademyItem.subject === acName;
                  return (
                    <button
                      key={acName}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => handleSelectAcademySubject(acName)}
                      className={`min-h-[42px] px-3 py-2 rounded-full text-[0.8125rem] font-semibold transition-all flex items-center justify-center ${
                        isCurrent
                          ? 'bg-accent-700 text-paper'
                          : 'bg-surface text-ink hover:bg-accent-100 active:scale-95'
                      }`}
                    >
                      <span className="truncate">{translateSubject(acName, lang)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRestoreOrDeleteAcademyItem}
              className={`w-full h-11 rounded-full border text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                editingAcademyItem.isAdded
                  ? 'border-accent-300 text-accent-800 hover:bg-accent-100'
                  : 'border-divider text-ink hover:bg-slate-100'
              }`}
            >
              {editingAcademyItem.isAdded ? (
                <>
                  <Trash2 className="w-4 h-4" />
                  {tr(lang, '추가 보강 삭제', 'Delete Makeup', '删除补课')}
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 text-slate-600" />
                  {tr(lang, '기본 시간표로 원상복구', 'Restore Default', '恢复默认课表')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SHEET 3: ADD (academy makeup/special class OR schedule item) */}
      {isAddingAcademy && addTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
          onClick={closeAddSheet}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 pb-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {renderDateBlock(addTarget.date, 'accent')}
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-bold text-ink truncate">
                    {addTarget.source === 'button'
                      ? tr(lang, '보강/특강 추가', 'Add makeup / special class', '添加补课/特讲')
                      : tr(lang, '이 시간에 추가하기', 'Add at this time', '在此时间添加')}
                  </h3>
                  <div className="text-[0.75rem] font-semibold text-slate-600 truncate">
                    {formatDateLabel(addTarget.date, lang)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAddSheet}
                className="w-9 h-9 shrink-0 rounded-full bg-surface flex items-center justify-center text-slate-600 hover:bg-slate-200"
                aria-label={tr(lang, '닫기', 'Close', '关闭')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addTarget.source === 'button' && (
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                  <CalendarClock className="w-4 h-4 text-accent-700" />
                  {tr(lang, '날짜', 'Date', '日期')}
                </span>
                <input
                  type="date"
                  value={addTarget.date}
                  onChange={(e) => e.target.value && setAddTarget({ ...addTarget, date: e.target.value })}
                  aria-label={tr(lang, '보강 날짜', 'Makeup date', '补课日期')}
                  className="w-full h-11 px-4 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
                />
              </label>
            )}

            {onUpdateSchedules && addTarget.source !== 'button' && (
              <div className="grid grid-cols-2 p-1 rounded-full bg-surface" role="tablist">
                {(
                  [
                    { key: 'academy', icon: Building2, label: tr(lang, '학원 보강/특강', 'Academy makeup', '补习班补课/特讲') },
                    { key: 'schedule', icon: CalendarClock, label: tr(lang, '일정', 'Schedule', '日程') },
                  ] as const
                ).map(({ key, icon: Icon, label }) => {
                  const active = addKind === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setAddKind(key)}
                      className={`h-9 rounded-full text-[0.8125rem] font-bold inline-flex items-center justify-center gap-1.5 transition-colors min-w-0 ${
                        active ? 'bg-accent-700 text-paper shadow-xs' : 'text-slate-700 hover:text-ink'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {addKind === 'academy' || !onUpdateSchedules || addTarget.source === 'button' ? (
              <>
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                    <Clock className="w-4 h-4 text-accent-700" />
                    {tr(lang, '수업 시간', 'Class time', '上课时间')}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={tempStartTime}
                      onChange={(e) => setTempStartTime(e.target.value)}
                      aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
                      className="flex-1 min-w-0 h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
                    />
                    <span className="text-sm font-bold text-slate-500">–</span>
                    <input
                      type="time"
                      value={tempEndTime}
                      onChange={(e) => setTempEndTime(e.target.value)}
                      aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                      className="flex-1 min-w-0 h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
                      <Building2 className="w-4 h-4 text-accent-700" />
                      {tr(lang, '학원 선택', 'Pick an academy', '选择补习班')}
                    </span>
                    <span className="text-[0.6875rem] font-semibold text-slate-600">
                      {tr(lang, '누르면 바로 추가', 'Adds instantly', '点击立即添加')}
                    </span>
                  </div>
                  {subjectPool.academy.length === 0 ? (
                    <p className="px-4 py-3 rounded-2xl bg-surface text-[0.8125rem] text-slate-700">
                      {tr(
                        lang,
                        '설정에서 학원 후보를 먼저 추가해 주세요.',
                        'Add academies in Settings first.',
                        '请先在设置中添加补习班。'
                      )}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {subjectPool.academy.map((acName) => (
                        <button
                          key={acName}
                          type="button"
                          onClick={() => handleSelectAcademySubject(acName)}
                          className="min-h-[44px] px-3 py-2 rounded-full text-[0.8125rem] font-semibold flex items-center justify-center gap-1 bg-surface text-ink hover:bg-accent-700 hover:text-paper active:scale-95 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.75} />
                          <span className="truncate">{translateSubject(acName, lang)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {addTarget.source === 'button' && (
                  <div className="space-y-2 pt-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[0.8125rem] font-bold text-ink">
                        {tr(lang, '등록된 보강/특강', 'Registered makeups', '已登记的补课/特讲')}
                      </span>
                      <span className="text-[0.6875rem] font-semibold text-slate-600">
                        {tr(lang, '누르면 수정할 수 있어요', 'Tap to edit', '点击可修改')}
                      </span>
                    </span>
                    {registeredMakeups.upcoming.length + registeredMakeups.past.length === 0 ? (
                      <p className="px-4 py-3 rounded-2xl bg-surface text-[0.75rem] text-slate-600">
                        {tr(lang, '아직 등록된 보강/특강이 없어요', 'No makeups registered yet', '还没有登记补课/特讲')}
                      </p>
                    ) : (
                      [
                        ...registeredMakeups.upcoming.map((r) => ({ ...r, past: false })),
                        ...registeredMakeups.past.slice(0, 5).map((r) => ({ ...r, past: true })),
                      ].map(({ date, item, past }) => (
                        <button
                          key={`${date}-${item.id}`}
                          type="button"
                          onClick={() => openRegisteredMakeup(date, item.id)}
                          className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-200 ${
                            past ? 'bg-surface/60 opacity-70' : 'bg-surface'
                          }`}
                        >
                          <span className="w-12 shrink-0 text-center">
                            <span className="block font-mono text-[0.9375rem] leading-none tabular-nums text-accent-700">
                              {Number(date.slice(8, 10))}
                            </span>
                            <span className="block text-[0.625rem] font-semibold text-slate-600 mt-0.5">
                              {translateDay(getDayOfWeekKor(parseDateKey(date)), lang)}
                              {` · ${Number(date.slice(5, 7))}${tr(lang, '월', '/', '月')}`}
                            </span>
                          </span>
                          <span className="flex-1 min-w-0">
                            <span
                              className={`block text-[0.875rem] font-bold text-ink truncate ${item.isCancelled ? 'line-through opacity-70' : ''}`}
                            >
                              {translateSubject(item.subject, lang)}
                            </span>
                            <span className="block font-mono text-[0.75rem] tabular-nums text-slate-600">
                              {item.startTime}~{item.endTime}
                            </span>
                          </span>
                          {past ? (
                            <span className="text-[0.6875rem] font-bold text-slate-600 shrink-0">
                              {tr(lang, '지난 보강', 'Past', '已过')}
                            </span>
                          ) : date === todayStr ? (
                            <span className="px-2 py-0.5 rounded-full bg-accent-700 text-paper text-[0.6875rem] font-bold shrink-0">
                              {tr(lang, '오늘', 'Today', '今天')}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                  <input
                    type="time"
                    value={tempStartTime}
                    onChange={(e) => setTempStartTime(e.target.value)}
                    aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
                    className="w-[118px] h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    value={newScheduleTitle}
                    onChange={(e) => setNewScheduleTitle(e.target.value)}
                    aria-label={tr(lang, '제목', 'Title', '标题')}
                    placeholder={tr(lang, '제목 (예: 수행평가 준비)', 'Title (e.g. Prepare for quiz)', '标题（例如：准备测验）')}
                    className="min-w-0 h-11 px-4 rounded-full border border-divider bg-surface text-[0.875rem] text-ink placeholder:text-slate-500 outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-[0.8125rem] font-bold text-ink">{tr(lang, '분류', 'Category', '分类')}</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['school', 'academy', 'other'] as ScheduleCategory[]).map((cat) => {
                      const active = newScheduleCategory === cat;
                      const Icon = cat === 'school' ? GraduationCap : cat === 'academy' ? Building2 : CalendarClock;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setNewScheduleCategory(cat)}
                          className={`h-10 rounded-full text-[0.8125rem] font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                            active
                              ? cat === 'school'
                                ? 'bg-sage-700 text-paper'
                                : cat === 'academy'
                                ? 'bg-accent-700 text-paper'
                                : 'bg-other-700 text-paper'
                              : 'bg-surface text-ink hover:bg-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {categoryLabel(cat, lang)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <textarea
                  value={newScheduleMemo}
                  onChange={(e) => setNewScheduleMemo(e.target.value)}
                  rows={2}
                  aria-label={tr(lang, '메모', 'Memo', '备注')}
                  placeholder={tr(lang, '메모 (선택)', 'Memo (optional)', '备注（可选）')}
                  className="w-full px-4 py-2.5 rounded-2xl border border-divider bg-surface text-[0.875rem] text-ink placeholder:text-slate-500 outline-none focus:border-accent resize-none"
                />
                <button
                  type="button"
                  onClick={handleAddScheduleItem}
                  disabled={!newScheduleTitle.trim()}
                  className="w-full h-12 rounded-full bg-accent-700 text-paper text-[0.875rem] font-bold hover:bg-accent-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.75} />
                  {tr(lang, '일정 추가', 'Add schedule', '添加日程')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {pendingConflict && (
        <ConflictDialog
          lang={lang}
          conflicts={pendingConflict.conflicts}
          onCancel={() => setPendingConflict(null)}
          onConfirm={() => {
            const go = pendingConflict.proceed;
            setPendingConflict(null);
            go();
          }}
        />
      )}
    </div>
  );
};
