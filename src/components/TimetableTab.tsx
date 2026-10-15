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
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
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
} from '../utils/timetableHelpers';
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
      className={`${large ? 'px-2 py-0.5 text-[13px] shrink-0' : 'px-1.5 py-0.5 text-[10px]'} font-bold rounded-full whitespace-nowrap ${
        status === 'absent' ? 'bg-accent-800 text-paper' : 'bg-sage-200 text-sage-900'
      }`}
    >
      {statusLabel(status, lang)}
    </span>
  );
};

const STATUS_OPTIONS: SlotStatus[] = ['cancelled', 'absent', 'selfStudy'];

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
  const [addTarget, setAddTarget] = useState<{ date: string } | null>(null);
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

  const handleShiftWeek = (deltaWeeks: number) => {
    setSelectedDate((prev) => addDays(prev, deltaWeeks * 7));
  };

  const handleGoToday = () => {
    setSelectedDate(new Date());
  };

  const closeEditSheet = () => setEditTarget(null);
  const closeAddSheet = () => setAddTarget(null);

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

  const openAddAcademyModal = (defaultStart = '18:00', defaultEnd = '20:00') => {
    const startMin = timeToMinutes(defaultStart);
    const rawEndMin = timeToMinutes(defaultEnd);
    const reasonableEndMin =
      rawEndMin - startMin > 120 ? Math.min(1440, startMin + 120) : rawEndMin;

    setEditTarget(null);
    setAddTarget({ date: selectedDateStr });
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
      onUpdateDailyOverrides((prev) =>
        getUpdatedAcademyOverrides(prev, dateStr, (list) => [...list, newItem])
      );
      closeAddSheet();
      return;
    }

    if (!editingAcademyItem) return;
    const patch: Partial<AcademyOverrideItem> = {
      startTime: tempStartTime,
      endTime: tempEndTime,
      subject: chosenSubject,
    };
    if (editingAcademyItem.status === 'cancelled') patch.status = undefined;
    upsertAcademyOverride(editDateStr, editingAcademyItem, patch);
    closeEditSheet();
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
    onUpdateSchedules((prev) => [...prev, item]);
    closeAddSheet();
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
      <div className="space-y-3 p-3 rounded-2xl bg-surface">
        <div className="space-y-1.5">
          <span className="block text-[11px] font-semibold text-slate-600">
            {tr(lang, '빠른 표시 (다시 누르면 해제)', 'Quick mark (tap again to clear)', '快速标记（再次点击取消）')}
          </span>
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const active = currentStatus === opt;
              const activeCls =
                opt === 'cancelled'
                  ? 'bg-slate-500 text-paper border-transparent'
                  : opt === 'absent'
                  ? 'bg-accent-800 text-paper border-transparent'
                  : 'bg-sage text-paper border-transparent';
              return (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(opt)}
                  className={`flex-1 h-9 rounded-full text-xs font-bold border transition-all active:scale-95 inline-flex items-center justify-center gap-1 ${
                    active ? activeCls : 'bg-paper text-ink border-divider hover:bg-slate-200'
                  }`}
                >
                  {opt === 'cancelled' && <Ban className="w-3.5 h-3.5" />}
                  {statusLabel(opt, lang)}
                </button>
              );
            })}
          </div>
          {currentStatus === 'absent' && onUpdateAttendance && (
            <p className="text-[10px] text-slate-600">
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
          <label className="block text-[11px] font-semibold text-slate-600">
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
              className="flex-1 min-w-0 h-10 px-4 rounded-full border border-divider bg-paper text-[13px] text-ink outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={onSaveNote}
              disabled={!dirty}
              className="h-10 px-3.5 rounded-full bg-accent text-paper text-xs font-bold whitespace-nowrap hover:bg-accent-600 disabled:opacity-40 disabled:cursor-default"
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
        {/* Clock + date */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[13px] font-bold text-paper/85 tracking-wide">
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
          <div className="pb-1.5 text-[16px] font-bold text-paper/90 tabular-nums whitespace-nowrap">
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
              <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap text-[15px] font-semibold text-paper/85">
                <span>{tr(lang, '다음 수업까지', 'Next class in', '距离下节课')}</span>
                <span className="font-mono text-[22px] leading-none tabular-nums text-accent-300">
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
                      className={`px-2.5 py-0.5 rounded-full text-[13px] font-bold whitespace-nowrap ${
                        isSchool ? 'bg-sage-300 text-sage-900' : 'bg-accent-300 text-accent-900'
                      }`}
                    >
                      {entry.badge}
                    </span>
                    <span className="text-[13px] font-semibold text-paper/85">
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
                      <div className="text-[13px] font-semibold text-paper/85 mt-1">
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
                  <div className="mt-1.5 flex items-center justify-between text-[13px] font-semibold text-paper/85 tabular-nums">
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
              <span className="text-[13px] font-bold text-paper/80 shrink-0">
                {tr(lang, '다음', 'Next', '下一个')}
              </span>
              <span className="text-[17px] font-bold text-paper truncate">{nowCard.next.title}</span>
              <StatusTag status={nowCard.next.status} lang={lang} large />
            </div>
            <div className="shrink-0 text-right whitespace-nowrap">
              <div className="font-mono text-[18px] leading-none text-paper tabular-nums">
                {nowCard.next.startTime}
              </div>
              <div className="mt-1 text-[13px] font-bold text-accent-300 tabular-nums">
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
          <div className="px-4 py-3 rounded-[20px] bg-paper/10 text-[15px] font-semibold text-paper/85">
            {tr(lang, '오늘 남은 수업이 없어요', 'No more classes today', '今天没有剩余课程')}
          </div>
        )}

        {/* Today's makeup / special classes: contrasting light panel inside the hero */}
        <div className="rounded-[24px] bg-paper text-ink p-4 space-y-2.5">
          <div className="text-[16px] font-bold text-ink inline-flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            {tr(lang, '오늘 보강/특강', "Today's makeup / special classes", '今日补课/特讲')}
            <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-accent-700 text-paper font-mono text-[13px] tabular-nums inline-flex items-center justify-center">
              {nowCard.makeups.length + nowCard.makeupSchedules.length}
            </span>
          </div>
          {nowCard.makeups.length === 0 && nowCard.makeupSchedules.length === 0 ? (
            <div className="px-3.5 py-3 rounded-2xl bg-surface text-[14px] font-semibold text-slate-700">
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
                  <span className="font-mono tabular-nums text-[16px] shrink-0">
                    {m.startTime}~{m.endTime}
                  </span>
                  <span className="text-[16px] font-bold truncate flex-1">{slotTitle(m.subject, m.status, lang)}</span>
                  <StatusTag status={m.status} lang={lang} large />
                </button>
              ))}
              {nowCard.makeupSchedules.map((s) => (
                <div
                  key={s.id}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-surface border border-accent-300 text-ink"
                >
                  {s.time && <span className="font-mono tabular-nums text-[16px] shrink-0">{s.time}</span>}
                  <span className="text-[16px] font-bold truncate">{translateSampleText(s.title, lang)}</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => openAddAcademyModal('18:00', '20:00')}
            className="w-full h-12 rounded-full bg-accent-700 text-paper text-[15px] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-800 shadow-xs"
          >
            <Plus className="w-4 h-4" strokeWidth={2.75} />
            {tr(lang, '당일 보강/특강 추가', 'Add makeup / special class', '添加当天补课/特讲')}
          </button>
        </div>
      </section>

      {/* Top Controls Card: View Switch + Week Navigation + 7 Day Tabs */}
      <div className="bg-surface rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-full border border-divider overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`h-[30px] px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'daily'
                  ? 'bg-accent text-paper'
                  : 'text-ink hover:bg-slate-100'
              }`}
            >
              {tr(lang, '일별 상세 보기', 'Daily Detail', '每日详情')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`h-[30px] px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'weekly'
                  ? 'bg-accent text-paper'
                  : 'text-ink hover:bg-slate-100'
              }`}
            >
              {tr(lang, '주간 한눈에 보기', 'Weekly Grid', '每周总览')}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleShiftWeek(-1)}
              className="w-8 h-8 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-200 active:scale-95 transition-transform"
              aria-label={tr(lang, '이전 주', 'Previous week', '上一周')}
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.75} />
            </button>
            {!isSelectedToday && (
              <button
                type="button"
                onClick={handleGoToday}
                className="px-2.5 h-8 rounded-full bg-accent text-paper text-xs font-bold hover:bg-accent-600 transition-colors whitespace-nowrap shrink-0"
              >
                {tr(lang, '오늘', 'Today', '今天')}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleShiftWeek(1)}
              className="w-8 h-8 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-200 active:scale-95 transition-transform"
              aria-label={tr(lang, '다음 주', 'Next week', '下一周')}
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.75} />
            </button>
          </div>
        </div>

        {/* Selected Date Caption */}
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold text-ink tabular-nums">
            {formatDateLabel(selectedDateStr, lang)}
          </div>
          <div className="text-[11px] text-slate-600 tabular-nums">
            {startHourFormatted}~{endHourFormatted} ·{' '}
            {tr(lang, '터치 시 수정', 'Tap to edit', '点击修改')}
          </div>
        </div>

        {/* Mon ~ Sun 7 Day Tabs */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((wd) => {
            const hasOverride =
              Boolean(
                dailyOverrides[wd.dateStr]?.school &&
                  Object.keys(dailyOverrides[wd.dateStr]?.school || {}).length > 0
              ) ||
              Boolean(
                dailyOverrides[wd.dateStr]?.academy &&
                  (dailyOverrides[wd.dateStr]?.academy || []).length > 0
              );

            return (
              <button
                key={wd.dateStr}
                type="button"
                onClick={() => setSelectedDate(wd.dateObj)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full border transition-all min-h-[48px] ${
                  wd.isSelected
                    ? 'bg-accent text-paper border-transparent'
                    : wd.isToday
                    ? 'bg-paper text-ink border-accent'
                    : 'bg-paper text-ink border-transparent hover:bg-slate-200'
                }`}
              >
                {wd.isToday && (
                  <span
                    className={`text-[9px] font-bold tracking-tight px-1.5 py-0.2 rounded-full mb-0.5 whitespace-nowrap ${
                      wd.isSelected
                        ? 'bg-paper text-accent-800'
                        : 'bg-accent text-paper'
                    }`}
                  >
                    {tr(lang, '오늘', 'TODAY', '今天')}
                  </span>
                )}
                <span
                  className={`text-[10px] font-semibold ${
                    wd.isSelected
                      ? 'text-paper/80'
                      : wd.dayLabel === '일'
                      ? 'text-accent-700'
                      : wd.dayLabel === '토'
                      ? 'text-sage-700'
                      : 'text-ink/80'
                  }`}
                >
                  {translateDay(wd.dayLabel, lang)}
                </span>
                <span
                  className={`text-[15px] leading-none font-mono tabular-nums ${
                    wd.isSelected ? 'text-paper' : 'text-ink'
                  }`}
                >
                  {wd.dayNumber}
                </span>
                {hasOverride && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      wd.isSelected ? 'bg-accent-100' : 'bg-accent'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW MODE 1: DAILY DETAILED VIEW */}
      {viewMode === 'daily' ? (
        <div className="space-y-4">
          {/* Visual Time Spectrum & Free-Time Summary Card */}
          <div className="bg-surface rounded-2xl p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-accent" strokeWidth={2.75} />
                <span className="text-[13px] font-bold text-ink tabular-nums">
                  {startHourFormatted} ~ {endHourFormatted}{' '}
                  {tr(lang, '시간 밀도 및 공강 현황', 'Time Density & Free Slots', '时间分布与空档概况')}
                </span>
              </div>

              <div className="inline-flex shrink-0 rounded-full border border-divider overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDailySubMode('timeline')}
                  className={`inline-flex items-center gap-1 h-[30px] px-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    dailySubMode === 'timeline'
                      ? 'bg-accent text-paper'
                      : 'text-ink hover:bg-slate-100'
                  }`}
                >
                  <CalendarRange className="w-3 h-3" />
                  {tr(
                    lang,
                    `${String(startHour).padStart(2, '0')}~${String(endHour).padStart(2, '0')}시 표`,
                    'Timeline',
                    '时间轴'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDailySubMode('list')}
                  className={`inline-flex items-center gap-1 h-[30px] px-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    dailySubMode === 'list'
                      ? 'bg-accent text-paper'
                      : 'text-ink hover:bg-slate-100'
                  }`}
                >
                  <AlignJustify className="w-3 h-3" />
                  {tr(lang, '목록형', 'List', '列表')}
                </button>
              </div>
            </div>

            {/* Horizontal Visual Spectrum Bar */}
            <div className="space-y-1">
              <div className="relative h-3.5 w-full rounded-full bg-slate-200 overflow-hidden">
                {timelineLayout.spectrumSegments.map((seg, i) => (
                  <div
                    key={i}
                    title={seg.label}
                    style={{
                      left: `${seg.leftPercent}%`,
                      width: `${seg.widthPercent}%`,
                    }}
                    className={`absolute top-0 bottom-0 ${
                      seg.type === 'conflict'
                        ? 'bg-accent-800 z-10'
                        : seg.type === 'school'
                        ? 'bg-sage'
                        : seg.type === 'academy'
                        ? 'bg-accent'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 tabular-nums px-0.5">
                {spectrumTickHours.map((h) => (
                  <span key={h}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>
            </div>

            {/* 3 Summary Metric Boxes */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-sage-100">
                <div className="text-[11px] font-semibold text-sage-800 flex items-center justify-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />{' '}
                  {tr(lang, '학교 수업', 'School', '学校课程')}
                </div>
                <div className="text-[15px] leading-tight text-sage-900 font-mono tabular-nums mt-0.5">
                  {formatDurationLocalized(timelineLayout.schoolMinutesTotal, lang)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-accent-100">
                <div className="text-[11px] font-semibold text-accent-800 flex items-center justify-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />{' '}
                  {tr(lang, '학원 수업', 'Academy', '补习班')}
                </div>
                <div className="text-[15px] leading-tight text-accent-900 font-mono tabular-nums mt-0.5">
                  {formatDurationLocalized(timelineLayout.academyMinutesTotal, lang)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-200">
                <div className="text-[11px] font-semibold text-slate-700 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />{' '}
                  {tr(lang, '비어있는 시간', 'Free Time', '空闲时间')}
                </div>
                <div className="text-[15px] leading-tight text-slate-900 font-mono tabular-nums mt-0.5">
                  {formatDurationLocalized(timelineLayout.totalFreeMin, lang)}
                </div>
              </div>
            </div>

            {/* CONFLICT ALERT BANNER */}
            {timelineLayout.conflictZones.length > 0 && (
              <div className="px-3 py-2.5 rounded-xl bg-accent-800 text-accent-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-100">
                    <AlertTriangle className="w-4 h-4 text-accent-100 shrink-0" />
                    <span>
                      {tr(
                        lang,
                        `[시간 겹침] 충돌 구간이 ${timelineLayout.conflictZones.length}곳 감지되었습니다`,
                        `${overlapBadgeLabel} ${timelineLayout.conflictZones.length} conflict(s) detected`,
                        `检测到 ${timelineLayout.conflictZones.length} 处 ${overlapBadgeLabel} 时段`
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {timelineLayout.conflictZones.map((cz) => (
                    <div
                      key={cz.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-[11px] text-accent-900"
                    >
                      <AlertTriangle className="w-3 h-3 text-accent-800 shrink-0" />
                      <span className="font-bold text-accent-800">{overlapBadgeLabel}</span>
                      <span className="font-mono font-bold tabular-nums">
                        {cz.startTime}~{cz.endTime}
                      </span>
                      <span className="text-accent-800 font-semibold">
                        ({cz.involvedSubjects.join(' · ')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick add action */}
            <button
              type="button"
              onClick={() => openAddAcademyModal('18:00', '20:00')}
              className="w-full h-11 rounded-full border-2 border-dashed border-accent bg-accent-100/60 text-accent-800 text-[14px] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-100"
            >
              <Plus className="w-4 h-4" strokeWidth={2.75} />
              {tr(lang, '당일 보강/특강 추가', 'Add makeup / special class', '添加当天补课/特讲')}
            </button>
          </div>

          {dailySubMode === 'timeline' ? (
            /* VERTICAL TIMELINE VIEW */
            <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-divider flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-700 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sage" />
                    {tr(lang, '학교', 'School', '学校')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    {tr(lang, '학원', 'Academy', '补习班')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    {tr(lang, '빈 시간', 'Free', '空闲')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-accent-800">
                    <AlertTriangle className="w-3 h-3 text-accent-800" />
                    {overlapBadgeLabel}
                  </span>
                </div>
                <span className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {startHourFormatted} ~ {endHourFormatted}
                </span>
              </div>

              <div className="relative select-none px-2.5 py-4">
                <div
                  className="relative flex"
                  style={{ height: `${totalHours * HOUR_HEIGHT_PX}px` }}
                >
                  {/* Left Time Axis Column */}
                  <div className="w-14 shrink-0 relative border-r border-divider pr-2">
                    {hoursArray.map((hour) => {
                      const topPx = (hour - startHour) * HOUR_HEIGHT_PX;
                      return (
                        <div
                          key={hour}
                          className="absolute right-2 -translate-y-1/2 flex items-center gap-1"
                          style={{ top: `${topPx}px` }}
                        >
                          <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                            {String(hour).padStart(2, '0')}:00
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Schedule Canvas Column */}
                  <div
                    className="flex-1 relative ml-1.5 cursor-pointer"
                    onClick={handleCanvasClick}
                    title={tr(lang, '빈 곳을 눌러 추가', 'Tap empty space to add', '点击空白处添加')}
                  >
                    {hoursArray.map((hour, idx) => {
                      const topPx = idx * HOUR_HEIGHT_PX;
                      const isLast = hour === endHour;
                      return (
                        <React.Fragment key={hour}>
                          {!isLast && idx % 2 === 1 && (
                            <div
                              className="absolute left-0 right-0 bg-slate-50/40 pointer-events-none"
                              style={{
                                top: `${topPx}px`,
                                height: `${HOUR_HEIGHT_PX}px`,
                              }}
                            />
                          )}
                          <div
                            className="absolute left-0 right-0 border-t border-divider pointer-events-none"
                            style={{ top: `${topPx}px` }}
                          />
                          {!isLast && (
                            <div
                              className="absolute left-0 right-0 border-t border-dashed border-slate-200/50 pointer-events-none"
                              style={{ top: `${topPx + HOUR_HEIGHT_PX / 2}px` }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* CONFLICT ZONE OVERLAY BAND */}
                    {timelineLayout.conflictZones.map((cz) => (
                      <div
                        key={cz.id}
                        style={{
                          top: `${cz.topPx}px`,
                          height: `${cz.heightPx}px`,
                        }}
                        className="absolute -left-1.5 right-0 z-20 pointer-events-none border-y-2 border-accent-800 bg-accent-800/10 flex items-start justify-center"
                      >
                        <div className="-mt-2.5 px-2 py-0.5 rounded-full bg-accent-800 text-accent-100 text-[10px] font-bold shadow-sm inline-flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 text-accent-100 shrink-0" />
                          <span>{overlapBadgeLabel}</span>
                          <span className="font-mono tabular-nums">
                            {cz.startTime}~{cz.endTime}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* FREE TIME SLOTS */}
                    {timelineLayout.freeSlots.map((slot) => {
                      const topPx =
                        ((slot.startMin - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
                      const heightPx = (slot.durationMin / 60) * HOUR_HEIGHT_PX;

                      return (
                        <button
                          key={`free-${slot.startTime}-${slot.endTime}`}
                          type="button"
                          onClick={() => openAddAcademyModal(slot.startTime, slot.endTime)}
                          style={{
                            top: `${topPx + 2}px`,
                            height: `${Math.max(26, heightPx - 4)}px`,
                          }}
                          className="group absolute left-0.5 right-0.5 rounded border border-dashed border-slate-300 bg-[image:repeating-linear-gradient(135deg,var(--color-slate-200)_0_6px,transparent_6px_12px)] hover:bg-slate-100 hover:border-slate-400 transition-colors px-3 py-1.5 flex items-center justify-between text-left overflow-hidden"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span className="text-[11px] font-mono text-slate-800 tabular-nums whitespace-nowrap">
                                {slot.startTime} ~ {slot.endTime}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 whitespace-nowrap">
                                {tr(lang, '빈 시간', 'Free', '空闲')} ·{' '}
                                {formatDurationLocalized(slot.durationMin, lang)}
                              </span>
                            </div>
                            {slot.durationMin >= 45 && (
                              <p className="text-[11px] font-medium text-slate-600 mt-0.5 truncate">
                                {slot.contextLabel}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-accent-700 group-hover:text-accent-800 shrink-0 ml-2 px-2 py-1 rounded-full bg-paper border border-divider">
                            {tr(lang, '+ 추가', '+ Add', '+ 添加')}
                          </span>
                        </button>
                      );
                    })}

                    {/* SCHOOL PERIOD BLOCKS */}
                    {timelineLayout.schoolLayout.map(
                      ({ item, topPx, heightPx, totalCols, colIndex }) => {
                        const isCurrentClass =
                          isSelectedToday &&
                          !item.isCancelled &&
                          isTimeInRange(nowMinutes, item.startTime, item.endTime);

                        const widthPercent = 100 / totalCols;
                        const leftPercent = colIndex * widthPercent;

                        return (
                          <button
                            key={`school-${item.period}`}
                            type="button"
                            onClick={() => openSchoolEdit(item)}
                            style={{
                              top: `${topPx + 1}px`,
                              height: `${Math.max(36, heightPx - 2)}px`,
                              left: `calc(${leftPercent}% + 2px)`,
                              width: `calc(${widthPercent}% - 4px)`,
                            }}
                            className={`absolute z-10 rounded px-3 py-1.5 text-left transition-all flex items-center justify-between gap-2 overflow-hidden border ${
                              isCurrentClass
                                ? 'bg-sage text-paper border-transparent shadow-md'
                                : item.isCancelled
                                ? 'bg-paper text-slate-500 border-dashed border-slate-400 line-through'
                                : item.isOverlapping
                                ? 'bg-orange-50/95 text-ink border-orange-500 ring-1 ring-orange-400 hover:bg-orange-100/80'
                                : item.status === 'selfStudy'
                                ? 'bg-slate-200 text-ink border-transparent hover:bg-slate-300'
                                : item.isModified
                                ? 'bg-sage-100 text-sage-900 border-amber-400 hover:bg-sage-200'
                                : 'bg-sage-100 text-sage-900 border-transparent hover:bg-sage-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[11px] font-mono font-bold tabular-nums whitespace-nowrap ${
                                    isCurrentClass
                                      ? 'text-paper/80'
                                      : item.isCancelled
                                      ? 'text-slate-500'
                                      : item.isOverlapping
                                      ? 'text-orange-900'
                                      : 'text-sage-800'
                                  }`}
                                >
                                  {tr(lang, `${item.period}교시`, `P${item.period}`, `第${item.period}节`)} ·{' '}
                                  {item.startTime} ~ {item.endTime}
                                </span>

                                {item.isOverlapping && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-paper rounded-md whitespace-nowrap shadow-2xs">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {overlapBadgeLabel}
                                  </span>
                                )}

                                {isCurrentClass && (
                                  <span className="px-1.5 py-0.2 text-[10px] font-bold bg-ink text-paper rounded-full whitespace-nowrap">
                                    {tr(lang, '수업 중', 'LIVE', '上课中')}
                                  </span>
                                )}

                                {item.isModified && (
                                  <span
                                    className={`px-1.5 py-0.2 text-[10px] font-bold rounded whitespace-nowrap ${
                                      isCurrentClass
                                        ? 'bg-amber-300 text-slate-950'
                                        : 'bg-amber-200/90 text-amber-950'
                                    }`}
                                  >
                                    {tr(
                                      lang,
                                      `변경됨 (기존: ${translateSubject(item.originalSubject, lang)})`,
                                      `Modified (${translateSubject(item.originalSubject, lang)})`,
                                      `已调课 (原: ${translateSubject(item.originalSubject, lang)})`
                                    )}
                                  </span>
                                )}
                              </div>

                              <div className="mt-0.5 flex items-center gap-2">
                                <span
                                  className={`text-sm font-bold truncate ${
                                    isCurrentClass
                                      ? 'text-paper'
                                      : item.isCancelled
                                      ? 'text-slate-500 line-through'
                                      : 'text-sage-900'
                                  }`}
                                >
                                  {slotTitle(item.subject, item.status, lang)}
                                </span>
                                <StatusTag status={item.status} lang={lang} />
                              </div>
                              {item.note && (
                                <p
                                  className={`mt-0.5 text-[10px] font-medium flex items-center gap-1 min-w-0 ${
                                    isCurrentClass ? 'text-paper/85' : 'text-slate-700'
                                  }`}
                                >
                                  <StickyNote className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{item.note}</span>
                                </p>
                              )}
                            </div>

                            <span
                              className={`text-[11px] font-semibold shrink-0 ${
                                isCurrentClass ? 'text-paper/80' : 'text-sage-700'
                              }`}
                            >
                              {tr(lang, '변경', 'Edit', '修改')}
                            </span>
                          </button>
                        );
                      }
                    )}

                    {/* ACADEMY SCHEDULE BLOCKS */}
                    {timelineLayout.academyLayout.map(
                      ({ item, topPx, heightPx, totalCols, colIndex }) => {
                        const isCurrentAcademy =
                          isSelectedToday &&
                          !item.isCancelled &&
                          isTimeInRange(nowMinutes, item.startTime, item.endTime);

                        const widthPercent = 100 / totalCols;
                        const leftPercent = colIndex * widthPercent;

                        return (
                          <button
                            key={`academy-${item.id}`}
                            type="button"
                            onClick={() => openEditAcademyModal(item)}
                            style={{
                              top: `${topPx + 1}px`,
                              height: `${Math.max(40, heightPx - 2)}px`,
                              left: `calc(${leftPercent}% + 2px)`,
                              width: `calc(${widthPercent}% - 4px)`,
                            }}
                            className={`absolute z-10 rounded px-2.5 py-2 text-left transition-all flex flex-col justify-between overflow-hidden border ${
                              isCurrentAcademy
                                ? 'bg-accent text-paper border-transparent shadow-md'
                                : item.isCancelled
                                ? 'bg-paper text-slate-500 border-dashed border-slate-400 line-through'
                                : item.isOverlapping
                                ? 'bg-orange-50/95 text-ink border-orange-500 ring-1 ring-orange-400 hover:bg-orange-100/85'
                                : item.status === 'selfStudy'
                                ? 'bg-slate-200 text-ink border-transparent hover:bg-slate-300'
                                : 'bg-accent-100 text-accent-900 border-transparent hover:bg-accent-200'
                            }`}
                          >
                            <div className="min-w-0 w-full">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold tabular-nums whitespace-nowrap ${
                                    isCurrentAcademy
                                      ? 'text-paper/80'
                                      : item.isCancelled
                                      ? 'text-slate-500'
                                      : item.isOverlapping
                                      ? 'text-orange-900'
                                      : 'text-accent-800'
                                  }`}
                                >
                                  <Clock className="w-3 h-3 shrink-0" />
                                  {item.startTime} ~ {item.endTime}
                                </span>

                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.isOverlapping && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-paper rounded-md whitespace-nowrap shadow-2xs">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      {overlapBadgeLabel}
                                    </span>
                                  )}
                                  {isCurrentAcademy && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-ink text-paper rounded-full whitespace-nowrap">
                                      {tr(lang, '수업 중', 'LIVE', '上课中')}
                                    </span>
                                  )}
                                  {item.isAdded && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-sage-100 text-sage-800 rounded-full whitespace-nowrap">
                                      {tr(lang, '당일 보강', 'Makeup', '临时补课')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-sm font-bold truncate ${
                                    isCurrentAcademy
                                      ? 'text-paper'
                                      : item.isCancelled
                                      ? 'text-slate-500 line-through'
                                      : 'text-accent-900'
                                  }`}
                                >
                                  {slotTitle(item.subject, item.status, lang)}
                                </span>
                                <StatusTag status={item.status} lang={lang} />

                                {item.isModified && !item.isAdded && item.originalSubject && (
                                  <span
                                    className={`px-1.5 py-0.2 text-[10px] font-bold rounded whitespace-nowrap ${
                                      isCurrentAcademy
                                        ? 'bg-amber-300 text-slate-950'
                                        : 'bg-amber-200/90 text-amber-950'
                                    }`}
                                  >
                                    {tr(
                                      lang,
                                      `변경됨 (기존: ${translateSubject(item.originalSubject, lang)})`,
                                      `Modified (${translateSubject(item.originalSubject, lang)})`,
                                      `已调课 (原: ${translateSubject(item.originalSubject, lang)})`
                                    )}
                                  </span>
                                )}
                              </div>
                              {item.note && (
                                <p
                                  className={`mt-0.5 text-[10px] font-medium flex items-center gap-1 min-w-0 ${
                                    isCurrentAcademy ? 'text-paper/85' : 'text-slate-700'
                                  }`}
                                >
                                  <StickyNote className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{item.note}</span>
                                </p>
                              )}
                            </div>

                            <div
                              className={`text-[10px] font-semibold self-end ${
                                isCurrentAcademy
                                  ? 'text-paper/80'
                                  : item.isOverlapping
                                  ? 'text-orange-800'
                                  : 'text-accent-700'
                              }`}
                            >
                              {tr(lang, '터치하여 수정', 'Tap to edit', '点击修改')}
                            </div>
                          </button>
                        );
                      }
                    )}

                    {/* SCHEDULE ITEM MARKERS (일정) */}
                    {daySchedules
                      .filter((sch) => sch.time)
                      .map((sch) => {
                        const m = timeToMinutes(sch.time as string);
                        if (m < timelineStartMin || m > timelineEndMin) return null;
                        const topPx = ((m - timelineStartMin) / 60) * HOUR_HEIGHT_PX;
                        return (
                          <div
                            key={`sch-${sch.id}`}
                            className="absolute right-1 z-20 pointer-events-none max-w-[55%] -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-paper border border-divider shadow-xs text-[10px] text-ink"
                            style={{ top: `${Math.max(10, topPx)}px` }}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                sch.category === 'school'
                                  ? 'bg-sage'
                                  : sch.category === 'academy'
                                  ? 'bg-accent'
                                  : 'bg-slate-500'
                              }`}
                            />
                            <span className="font-mono tabular-nums">{sch.time}</span>
                            <span className="font-semibold truncate">{sch.title}</span>
                          </div>
                        );
                      })}

                    {/* CURRENT TIME LIVE INDICATOR LINE */}
                    {showLiveNowLine && (
                      <div
                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                        style={{ top: `${liveNowTopPx}px` }}
                      >
                        <span className="-ml-1.5 px-1.5 py-0.5 rounded-full bg-ink text-paper text-[9px] font-mono tabular-nums shadow-xs">
                          {tr(lang, '지금', 'NOW', '现在')} {minutesToTimeStr(nowMinutes)}
                        </span>
                        <div className="flex-1 border-t-2 border-ink" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            /* SUB-MODE: SECTION LIST VIEW */
            <div className="space-y-4">
              <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-sage" />
                    <h2 className="text-[13px] font-bold text-ink">
                      {tr(lang, '학교 시간표', 'School Schedule', '学校课表')}
                    </h2>
                    <span className="text-xs text-slate-600 tabular-nums">
                      · {translateDay(dailyData.dayOfWeek, lang)} ({dailyData.school.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600">
                    {tr(lang, '터치하여 당일 변경', 'Tap to edit', '点击修改当天')}
                  </span>
                </div>

                {dailyData.school.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs font-medium text-slate-600">
                      {tr(
                        lang,
                        '등록된 정규 학교 수업이 없습니다.',
                        'No regular school classes scheduled.',
                        '当天没有登记常规学校课程。'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-divider">
                    {dailyData.school.map((item) => {
                      const isCurrentClass =
                        isSelectedToday &&
                        !item.isCancelled &&
                        isTimeInRange(nowMinutes, item.startTime, item.endTime);

                      return (
                        <button
                          key={item.period}
                          type="button"
                          onClick={() => openSchoolEdit(item)}
                          className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors min-h-[60px] ${
                            isCurrentClass
                              ? 'bg-sage-100 ring-2 ring-inset ring-sage'
                              : item.isCancelled
                              ? 'opacity-60'
                              : item.isOverlapping
                              ? 'bg-orange-50/60 hover:bg-orange-50'
                              : 'hover:bg-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-sage-800 font-mono tabular-nums whitespace-nowrap">
                                {tr(lang, `${item.period}교시`, `P${item.period}`, `第${item.period}节`)} ·{' '}
                                {item.startTime} ~ {item.endTime}
                              </span>
                              {item.isOverlapping && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  {overlapBadgeLabel}
                                </span>
                              )}
                              {isCurrentClass && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-sage text-paper rounded-full whitespace-nowrap">
                                  {tr(lang, '수업 중', 'LIVE', '上课中')}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[13px] font-bold ${
                                  item.isCancelled
                                    ? 'line-through text-slate-500'
                                    : 'text-ink'
                                }`}
                              >
                                {slotTitle(item.subject, item.status, lang)}
                              </span>
                              <StatusTag status={item.status} lang={lang} />
                              {item.isModified && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 rounded-full whitespace-nowrap">
                                  {tr(
                                    lang,
                                    `변경됨 (기존: ${translateSubject(item.originalSubject, lang)})`,
                                    `Modified (${translateSubject(item.originalSubject, lang)})`,
                                    `已调课 (原: ${translateSubject(item.originalSubject, lang)})`
                                  )}
                                </span>
                              )}
                            </div>
                            {item.note && (
                              <p
                                className="mt-0.5 text-[10px] font-medium flex items-center gap-1 min-w-0 text-slate-700"
                              >
                                <StickyNote className="w-3 h-3 shrink-0" />
                                <span className="truncate">{item.note}</span>
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-accent-700 shrink-0">
                            {tr(lang, '변경', 'Edit', '修改')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-accent" />
                    <h2 className="text-[13px] font-bold text-ink">
                      {tr(lang, '학원 시간표', 'Academy Schedule', '补习班课表')}
                    </h2>
                    <span className="text-xs text-slate-600 tabular-nums">
                      · {dailyData.academy.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddAcademyModal('18:00', '20:00')}
                    className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-accent text-paper text-[13px] font-bold hover:bg-accent-600 shadow-xs"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.75} />
                    {tr(lang, '당일 보강/특강 추가', 'Add Makeup', '添加补课/特讲')}
                  </button>
                </div>

                {dailyData.academy.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs font-medium text-slate-600">
                      {tr(
                        lang,
                        '이 날 예정된 학원 수업이 없습니다.',
                        'No academy classes scheduled for this day.',
                        '当天没有安排补习班课程。'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-divider">
                    {dailyData.academy.map((item) => {
                      const isCurrentAcademy =
                        isSelectedToday &&
                        !item.isCancelled &&
                        isTimeInRange(nowMinutes, item.startTime, item.endTime);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openEditAcademyModal(item)}
                          className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors min-h-[64px] ${
                            isCurrentAcademy
                              ? 'bg-accent-100 ring-2 ring-inset ring-accent'
                              : item.isCancelled
                              ? 'opacity-60'
                              : item.isOverlapping
                              ? 'bg-orange-50/60 hover:bg-orange-50'
                              : 'hover:bg-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-xs text-accent-800 font-mono tabular-nums whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5" />
                                {item.startTime} ~ {item.endTime}
                              </span>
                              {item.isOverlapping && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 rounded-full whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  {overlapBadgeLabel}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[13px] font-bold ${
                                  item.isCancelled
                                    ? 'line-through text-slate-500'
                                    : 'text-ink'
                                }`}
                              >
                                {slotTitle(item.subject, item.status, lang)}
                              </span>
                              <StatusTag status={item.status} lang={lang} />
                            </div>
                            {item.note && (
                              <p
                                className="mt-0.5 text-[10px] font-medium flex items-center gap-1 min-w-0 text-slate-700"
                              >
                                <StickyNote className="w-3 h-3 shrink-0" />
                                <span className="truncate">{item.note}</span>
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-accent-700 shrink-0">
                            {tr(lang, '수정', 'Edit', '修改')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {daySchedules.length > 0 && (
                <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
                  <div className="px-4 py-3 border-b border-divider flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-slate-600" />
                    <h2 className="text-[13px] font-bold text-ink">
                      {tr(lang, '이날의 일정', 'Schedules on this day', '当天日程')}
                    </h2>
                    <span className="text-xs text-slate-600 tabular-nums">· {daySchedules.length}</span>
                  </div>
                  <div className="divide-y divide-divider">
                    {daySchedules.map((sch) => (
                      <div key={sch.id} className="px-4 py-2.5 flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            sch.category === 'school'
                              ? 'bg-sage'
                              : sch.category === 'academy'
                              ? 'bg-accent'
                              : 'bg-slate-500'
                          }`}
                        />
                        <span className="w-12 shrink-0 text-xs font-mono text-slate-700 tabular-nums">
                          {sch.time || tr(lang, '종일', 'All day', '全天')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold text-ink truncate">{sch.title}</div>
                          {sch.memo && (
                            <div className="text-[11px] text-slate-600 truncate">{sch.memo}</div>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600 shrink-0">
                          {categoryLabel(sch.category, lang)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: WEEKLY OVERVIEW GRID */
        <div className="space-y-4">
          <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sage" />
                <h2 className="text-[13px] font-bold text-ink">
                  {tr(lang, '주간 학교 시간표 (월~금)', 'Weekly School Timetable (Mon–Fri)', '每周学校课表 (周一至周五)')}
                </h2>
              </div>
              <span className="text-[11px] text-slate-600">
                {tr(lang, '칸을 눌러 수정', 'Tap a cell to edit', '点击单元格修改')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-divider">
                    <th className="py-2 px-1.5 text-[10px] font-semibold text-slate-600 border-r border-divider w-12">
                      {tr(lang, '교시', 'Per', '课时')}
                    </th>
                    {weeklyData.slice(0, 5).map((wd) => (
                      <th
                        key={wd.dateStr}
                        onClick={() => {
                          setSelectedDate(wd.dateObj);
                          setViewMode('daily');
                        }}
                        className={`py-2 px-1 text-xs font-bold cursor-pointer transition-colors ${
                          wd.isToday
                            ? 'bg-accent-100 text-accent-800'
                            : 'text-ink hover:bg-slate-200'
                        }`}
                      >
                        <div>{translateDay(wd.dayLabel, lang)}</div>
                        <div className="text-[10px] font-mono font-normal text-slate-600 tabular-nums">
                          {wd.dayNumber}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider text-xs">
                  {[1, 2, 3, 4, 5, 6, 7].map((periodNum) => (
                    <tr key={periodNum}>
                      <td className="py-2.5 px-1 font-mono text-[11px] text-slate-600 border-r border-divider tabular-nums">
                        {tr(lang, `${periodNum}교시`, `P${periodNum}`, `第${periodNum}节`)}
                      </td>
                      {weeklyData.slice(0, 5).map((wd) => {
                        const cell = wd.resolved.school.find((s) => s.period === periodNum);
                        if (!cell) {
                          return (
                            <td key={wd.dateStr} className="py-2.5 px-1 text-slate-400">
                              -
                            </td>
                          );
                        }
                        return (
                          <td
                            key={wd.dateStr}
                            onClick={() => openItemOnDate({ kind: 'school', item: cell }, wd.dateObj)}
                            className={`py-2.5 px-1 cursor-pointer transition-colors ${
                              cell.isCancelled
                                ? 'text-slate-500 line-through bg-paper'
                                : cell.status === 'absent'
                                ? 'bg-accent-100 text-accent-900 font-semibold'
                                : cell.status === 'selfStudy'
                                ? 'bg-slate-200 text-ink'
                                : cell.isModified
                                ? 'bg-amber-50/80 text-amber-900 font-bold'
                                : wd.isToday
                                ? 'bg-sage-100 font-semibold text-sage-900'
                                : 'bg-sage-100/50 text-sage-900 hover:bg-sage-100'
                            }`}
                          >
                            <div className="truncate max-w-[54px] mx-auto">
                              {cell.status === 'selfStudy'
                                ? tr(lang, '자습', 'Self-Study', '自习')
                                : translateSubject(cell.subject, lang)}
                            </div>
                            {(cell.status === 'absent' || cell.note) && (
                              <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                {cell.status === 'absent' && (
                                  <span className="px-1 rounded-full bg-accent-800 text-paper text-[9px] font-bold no-underline">
                                    {statusLabel('absent', lang)}
                                  </span>
                                )}
                                {cell.note && <StickyNote className="w-2.5 h-2.5 text-slate-600" />}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent" />
                <h2 className="text-[13px] font-bold text-ink">
                  {tr(lang, '주간 학원 시간표 (월~일)', 'Weekly Academies (Mon–Sun)', '每周补习班课表 (周一至周日)')}
                </h2>
              </div>
            </div>
            <div className="divide-y divide-divider">
              {weeklyData.map((wd) => (
                <div
                  key={wd.dateStr}
                  onClick={() => {
                    setSelectedDate(wd.dateObj);
                    setViewMode('daily');
                  }}
                  className={`px-4 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-slate-200 transition-colors ${
                    wd.isToday ? 'bg-accent-100/60' : ''
                  }`}
                >
                  <div className="w-14 shrink-0 pt-0.5">
                    <span className="text-[13px] font-mono text-ink">
                      {translateDay(wd.dayLabel, lang)}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-600 tabular-nums">
                      {wd.dayNumber}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {wd.resolved.academy.length === 0 ? (
                      <span className="text-[11px] text-slate-500 py-0.5">
                        {tr(lang, '등록된 학원 없음', 'None', '无补习班')}
                      </span>
                    ) : (
                      wd.resolved.academy.map((ac) => (
                        <button
                          key={ac.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openItemOnDate({ kind: 'academy', item: ac }, wd.dateObj);
                          }}
                          className={`px-2.5 py-1 rounded-full text-[11px] border inline-flex items-center gap-1 hover:brightness-95 active:scale-95 transition-transform ${
                            ac.isCancelled
                              ? 'bg-paper border-dashed border-slate-400 text-slate-500 line-through'
                              : ac.status === 'selfStudy'
                              ? 'bg-slate-200 border-transparent text-ink'
                              : ac.isOverlapping
                              ? 'bg-orange-50 border-orange-300 text-orange-900'
                              : 'bg-accent-100 border-transparent text-accent-800'
                          }`}
                        >
                          {ac.isOverlapping && (
                            <AlertTriangle className="w-3 h-3 text-orange-600 shrink-0" />
                          )}
                          <span className="font-mono text-[11px] font-semibold tabular-nums">
                            {ac.startTime}~{ac.endTime}
                          </span>
                          <span className="font-bold">{slotTitle(ac.subject, ac.status, lang)}</span>
                          <StatusTag status={ac.status} lang={lang} />
                          {ac.note && <StickyNote className="w-3 h-3 shrink-0 opacity-70" />}
                          {ac.isOverlapping && (
                            <span className="text-[10px] font-bold text-orange-700">
                              {overlapBadgeLabel}
                            </span>
                          )}
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

      {/* MODAL 1: SCHOOL PERIOD EDIT BOTTOM SHEET */}
      {editingSchoolPeriod && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => {
            handleSaveSchoolNote();
            closeEditSheet();
          }}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs text-sage-700 font-mono tabular-nums">
                  {formatDateLabel(editDateStr, lang)} ·{' '}
                  {tr(
                    lang,
                    `${editingSchoolPeriod.period}교시`,
                    `P${editingSchoolPeriod.period}`,
                    `第${editingSchoolPeriod.period}节`
                  )}{' '}
                  ({editingSchoolPeriod.startTime} ~ {editingSchoolPeriod.endTime})
                </span>
                <h3 className="text-[15px] font-bold text-ink mt-0.5">
                  {tr(lang, '이 날 수업 변경', 'Edit this class for the day', '修改当天课程')}
                </h3>
                <p className="text-xs text-slate-700 mt-0.5">
                  {tr(
                    lang,
                    '여기서 바꾼 내용은 이 날짜에만 적용됩니다.',
                    'Changes here apply to this date only.',
                    '此处的修改仅适用于当天。'
                  )}
                </p>
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

            {renderStatusAndNote(
              editingSchoolPeriod.status,
              handleToggleSchoolStatus,
              handleSaveSchoolNote,
              editingSchoolPeriod.note ?? ''
            )}

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600">
                {tr(lang, '과목 바꾸기 (터치 시 즉시 적용)', 'Change subject (applies instantly)', '更换科目（点击立即生效）')}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {subjectPool.school.map((subj) => {
                  const isCurrent =
                    !editingSchoolPeriod.isCancelled && editingSchoolPeriod.subject === subj;
                  const isOriginal = editingSchoolPeriod.originalSubject === subj;

                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => handleSelectSchoolSubject(subj)}
                      className={`min-h-[44px] px-3 py-2 rounded-full text-xs font-semibold border transition-all flex flex-col items-center justify-center ${
                        isCurrent
                          ? 'bg-sage text-paper border-transparent'
                          : 'bg-surface text-ink border-divider hover:bg-sage-100 active:scale-95'
                      }`}
                    >
                      <span>{translateSubject(subj, lang)}</span>
                      {isOriginal && (
                        <span
                          className={`text-[10px] font-medium ${
                            isCurrent ? 'text-paper/70' : 'text-slate-600'
                          }`}
                        >
                          {tr(lang, '기본 과목', 'Default', '默认科目')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-divider">
              <button
                type="button"
                onClick={handleRestoreSchoolPeriod}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-full bg-transparent text-ink border border-divider text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-200 active:scale-98 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-slate-600" />
                {tr(lang, '기본 시간표로 원상복구', 'Restore Default', '恢复默认课表')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACADEMY EDIT BOTTOM SHEET */}
      {editingAcademyItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => {
            handleSaveAcademyNote();
            closeEditSheet();
          }}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs text-accent-700 font-mono tabular-nums">
                  {formatDateLabel(editDateStr, lang)} · {editingAcademyItem.startTime} ~{' '}
                  {editingAcademyItem.endTime}
                </span>
                <h3 className="text-[15px] font-bold text-ink mt-0.5">
                  {translateSubject(editingAcademyItem.subject, lang)}
                  {editingAcademyItem.isAdded && (
                    <span className="ml-1.5 align-middle px-1.5 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-800 rounded-full">
                      {tr(lang, '당일 보강', 'Makeup', '临时补课')}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-700 mt-0.5">
                  {tr(
                    lang,
                    '여기서 바꾼 내용은 이 날짜에만 적용됩니다.',
                    'Changes here apply to this date only.',
                    '此处的修改仅适用于当天。'
                  )}
                </p>
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

            {renderStatusAndNote(
              editingAcademyItem.status,
              handleToggleAcademyStatus,
              handleSaveAcademyNote,
              editingAcademyItem.note ?? ''
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-600">
                {tr(lang, '수업 시간 설정', 'Class Time Range', '设置上课时间')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value)}
                  className="flex-1 min-w-0 h-10 px-3 rounded-full border border-divider bg-surface text-[13px] font-mono text-ink outline-none focus:border-accent"
                />
                <span className="text-sm font-bold text-slate-400">~</span>
                <input
                  type="time"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value)}
                  className="flex-1 min-w-0 h-10 px-3 rounded-full border border-divider bg-surface text-[13px] font-mono text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleSaveAcademyTimeOnly}
                  className="h-10 px-3 rounded-full bg-ink text-paper text-xs font-bold whitespace-nowrap hover:bg-slate-800"
                >
                  {tr(lang, '시간만 저장', 'Save Time', '仅保存时间')}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600">
                {tr(lang, '학원 바꾸기 (터치 시 즉시 적용)', 'Change academy (applies instantly)', '更换补习班（点击立即生效）')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {subjectPool.academy.map((acName) => {
                  const isCurrent =
                    !editingAcademyItem.isCancelled && editingAcademyItem.subject === acName;
                  return (
                    <button
                      key={acName}
                      type="button"
                      onClick={() => handleSelectAcademySubject(acName)}
                      className={`min-h-[40px] px-3 py-2 rounded-full text-xs font-semibold border transition-all flex items-center justify-center ${
                        isCurrent
                          ? 'bg-accent text-paper border-transparent'
                          : 'bg-transparent text-ink border-divider hover:bg-accent-100 active:scale-95'
                      }`}
                    >
                      {translateSubject(acName, lang)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-divider">
              <button
                type="button"
                onClick={handleRestoreOrDeleteAcademyItem}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-full bg-transparent text-ink border border-divider text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-200 active:scale-98 transition-all"
              >
                {editingAcademyItem.isAdded ? (
                  <>
                    <Trash2 className="w-4 h-4 text-accent-800" />
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
        </div>
      )}

      {/* MODAL 3: ADD SHEET (academy makeup/special class OR schedule item) */}
      {isAddingAcademy && addTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end justify-center"
          onClick={closeAddSheet}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs text-accent-700 font-mono tabular-nums">
                  {formatDateLabel(addTarget.date, lang)}
                </span>
                <h3 className="text-[15px] font-bold text-ink mt-0.5">
                  {tr(lang, '이 시간에 추가하기', 'Add at this time', '在此时间添加')}
                </h3>
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

            {onUpdateSchedules && (
              <div className="grid grid-cols-2 rounded-full border border-divider overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAddKind('academy')}
                  className={`h-9 text-xs font-semibold transition-colors ${
                    addKind === 'academy' ? 'bg-accent text-paper' : 'text-ink hover:bg-slate-200'
                  }`}
                >
                  {tr(lang, '학원 보강/특강', 'Academy makeup / special', '补习班补课/特讲')}
                </button>
                <button
                  type="button"
                  onClick={() => setAddKind('schedule')}
                  className={`h-9 text-xs font-semibold transition-colors ${
                    addKind === 'schedule' ? 'bg-accent text-paper' : 'text-ink hover:bg-slate-200'
                  }`}
                >
                  {tr(lang, '일정', 'Schedule', '日程')}
                </button>
              </div>
            )}

            {addKind === 'academy' || !onUpdateSchedules ? (
              <>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '수업 시간 설정', 'Class Time Range', '设置上课时间')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={tempStartTime}
                      onChange={(e) => setTempStartTime(e.target.value)}
                      className="flex-1 min-w-0 h-10 px-3 rounded-full border border-divider bg-surface text-[13px] font-mono text-ink outline-none focus:border-accent"
                    />
                    <span className="text-sm font-bold text-slate-400">~</span>
                    <input
                      type="time"
                      value={tempEndTime}
                      onChange={(e) => setTempEndTime(e.target.value)}
                      className="flex-1 min-w-0 h-10 px-3 rounded-full border border-divider bg-surface text-[13px] font-mono text-ink outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">
                    {tr(lang, '학원 선택 (터치 시 바로 추가)', 'Pick an academy (adds instantly)', '选择补习班（点击立即添加）')}
                  </span>
                  {subjectPool.academy.length === 0 ? (
                    <p className="text-xs text-slate-600">
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
                          className="min-h-[40px] px-3 py-2 rounded-full text-xs font-semibold border transition-all flex items-center justify-center bg-transparent text-ink border-divider hover:bg-accent-100 active:scale-95"
                        >
                          {translateSubject(acName, lang)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '시작 시간', 'Start time', '开始时间')}
                  </label>
                  <input
                    type="time"
                    value={tempStartTime}
                    onChange={(e) => setTempStartTime(e.target.value)}
                    className="w-full h-10 px-3 rounded-full border border-divider bg-surface text-[13px] font-mono text-ink outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '제목', 'Title', '标题')}
                  </label>
                  <input
                    type="text"
                    value={newScheduleTitle}
                    onChange={(e) => setNewScheduleTitle(e.target.value)}
                    placeholder={tr(lang, '예: 수행평가 준비', 'e.g. Prepare for quiz', '例如：准备测验')}
                    className="w-full h-10 px-4 rounded-full border border-divider bg-surface text-[13px] text-ink outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '분류', 'Category', '分类')}
                  </span>
                  <div className="flex gap-1.5">
                    {(['school', 'academy', 'other'] as ScheduleCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewScheduleCategory(cat)}
                        className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
                          newScheduleCategory === cat
                            ? cat === 'school'
                              ? 'bg-sage text-paper border-transparent'
                              : cat === 'academy'
                              ? 'bg-accent text-paper border-transparent'
                              : 'bg-ink text-paper border-transparent'
                            : 'border-divider text-ink hover:bg-slate-200'
                        }`}
                      >
                        {categoryLabel(cat, lang)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '메모', 'Memo', '备注')}
                  </label>
                  <textarea
                    value={newScheduleMemo}
                    onChange={(e) => setNewScheduleMemo(e.target.value)}
                    rows={2}
                    placeholder={tr(lang, '선택 사항', 'Optional', '可选')}
                    className="w-full px-4 py-2.5 rounded-2xl border border-divider bg-surface text-[13px] text-ink outline-none focus:border-accent resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddScheduleItem}
                  disabled={!newScheduleTitle.trim()}
                  className="w-full min-h-[44px] rounded-full bg-accent text-paper text-[13px] font-bold hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {tr(lang, '일정 추가', 'Add schedule', '添加日程')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
