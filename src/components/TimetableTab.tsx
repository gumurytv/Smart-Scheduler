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
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  MasterTimetable,
  DailyOverrides,
  SubjectPool,
  AcademyOverrideItem,
  TimelineConfig,
  AppLanguage,
} from '../types';
import {
  formatDateKey,
  addDays,
  getMondayOfCurrentWeek,
} from '../data/initialData';
import {
  resolveDailyTimetable,
  isTimeInRange,
  timeToMinutes,
  ResolvedSchoolPeriod,
  ResolvedAcademyItem,
} from '../utils/timetableHelpers';
import { tr, translateDay, translateSubject } from '../i18n/translations';

interface TimetableTabProps {
  language?: AppLanguage;
  subjectPool: SubjectPool;
  masterTimetable: MasterTimetable;
  dailyOverrides: DailyOverrides;
  timelineConfig?: TimelineConfig;
  onUpdateDailyOverrides: (updater: (prev: DailyOverrides) => DailyOverrides) => void;
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

export const TimetableTab: React.FC<TimetableTabProps> = ({
  language = 'ko',
  subjectPool,
  masterTimetable,
  dailyOverrides,
  timelineConfig,
  onUpdateDailyOverrides,
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

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [dailySubMode, setDailySubMode] = useState<'timeline' | 'list'>('timeline');
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const [editingSchoolPeriod, setEditingSchoolPeriod] = useState<ResolvedSchoolPeriod | null>(null);
  const [editingAcademyItem, setEditingAcademyItem] = useState<ResolvedAcademyItem | null>(null);
  const [isAddingAcademy, setIsAddingAcademy] = useState<boolean>(false);
  const [tempStartTime, setTempStartTime] = useState<string>('17:00');
  const [tempEndTime, setTempEndTime] = useState<string>('19:00');
  const [tempAcademySubject, setTempAcademySubject] = useState<string>('');

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

  const handleSelectSchoolSubject = (newSubject: string) => {
    if (!editingSchoolPeriod) return;
    const periodNum = editingSchoolPeriod.period;
    const originalSubj = editingSchoolPeriod.originalSubject;

    onUpdateDailyOverrides((prev) => {
      const next = { ...prev };
      const currentDayOv = { ...(next[selectedDateStr] || {}) };
      const currentSchoolOv = { ...(currentDayOv.school || {}) };

      if (newSubject === originalSubj) {
        delete currentSchoolOv[periodNum];
      } else {
        currentSchoolOv[periodNum] = {
          subject: newSubject,
          isCancelled: false,
        };
      }

      currentDayOv.school = currentSchoolOv;
      next[selectedDateStr] = currentDayOv;
      return next;
    });

    setEditingSchoolPeriod(null);
  };

  const handleRestoreSchoolPeriod = () => {
    if (!editingSchoolPeriod) return;
    const periodNum = editingSchoolPeriod.period;

    onUpdateDailyOverrides((prev) => {
      const next = { ...prev };
      const currentDayOv = { ...(next[selectedDateStr] || {}) };
      const currentSchoolOv = { ...(currentDayOv.school || {}) };
      delete currentSchoolOv[periodNum];
      currentDayOv.school = currentSchoolOv;
      next[selectedDateStr] = currentDayOv;
      return next;
    });

    setEditingSchoolPeriod(null);
  };

  const handleCancelOrSelfStudySchoolPeriod = () => {
    if (!editingSchoolPeriod) return;
    const periodNum = editingSchoolPeriod.period;

    onUpdateDailyOverrides((prev) => {
      const next = { ...prev };
      const currentDayOv = { ...(next[selectedDateStr] || {}) };
      const currentSchoolOv = { ...(currentDayOv.school || {}) };
      currentSchoolOv[periodNum] = {
        subject: '자습',
        isCancelled: true,
      };
      currentDayOv.school = currentSchoolOv;
      next[selectedDateStr] = currentDayOv;
      return next;
    });

    setEditingSchoolPeriod(null);
  };

  const getUpdatedAcademyOverrides = (
    prev: DailyOverrides,
    modifier: (currentList: AcademyOverrideItem[]) => AcademyOverrideItem[]
  ): DailyOverrides => {
    const next = { ...prev };
    const currentDayOv = { ...(next[selectedDateStr] || {}) };
    const existingList: AcademyOverrideItem[] = currentDayOv.academy
      ? [...currentDayOv.academy]
      : dailyData.academy.map((item) => ({
          id: item.id,
          masterId: item.masterId,
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject,
          isCancelled: item.isCancelled,
          isAdded: item.isAdded,
          originalSubject: item.originalSubject,
          originalStartTime: item.originalStartTime,
          originalEndTime: item.originalEndTime,
        }));

    currentDayOv.academy = modifier(existingList);
    next[selectedDateStr] = currentDayOv;
    return next;
  };

  const openEditAcademyModal = (item: ResolvedAcademyItem) => {
    setEditingAcademyItem(item);
    setIsAddingAcademy(false);
    setTempStartTime(item.startTime);
    setTempEndTime(item.endTime);
    setTempAcademySubject(item.subject);
  };

  const openAddAcademyModal = (defaultStart = '18:00', defaultEnd = '20:00') => {
    const startMin = timeToMinutes(defaultStart);
    const rawEndMin = timeToMinutes(defaultEnd);
    const reasonableEndMin =
      rawEndMin - startMin > 120 ? Math.min(1440, startMin + 120) : rawEndMin;

    setEditingAcademyItem(null);
    setIsAddingAcademy(true);
    setTempStartTime(defaultStart);
    setTempEndTime(minutesToTimeStr(reasonableEndMin));
    setTempAcademySubject(subjectPool.academy[0] || '수학학원');
  };

  const handleSelectAcademySubject = (chosenSubject: string) => {
    if (isAddingAcademy) {
      const newItem: AcademyOverrideItem = {
        id: `added-${Date.now()}`,
        startTime: tempStartTime,
        endTime: tempEndTime,
        subject: chosenSubject,
        isCancelled: false,
        isAdded: true,
      };
      onUpdateDailyOverrides((prev) =>
        getUpdatedAcademyOverrides(prev, (list) => [...list, newItem])
      );
      setIsAddingAcademy(false);
      return;
    }

    if (!editingAcademyItem) return;

    onUpdateDailyOverrides((prev) =>
      getUpdatedAcademyOverrides(prev, (list) => {
        const foundIdx = list.findIndex(
          (x) =>
            (editingAcademyItem.masterId && x.masterId === editingAcademyItem.masterId) ||
            x.id === editingAcademyItem.id
        );
        const updatedEntry: AcademyOverrideItem = {
          id: editingAcademyItem.id,
          masterId: editingAcademyItem.masterId,
          startTime: tempStartTime,
          endTime: tempEndTime,
          subject: chosenSubject,
          isCancelled: false,
          isAdded: editingAcademyItem.isAdded,
          originalSubject: editingAcademyItem.originalSubject,
          originalStartTime: editingAcademyItem.originalStartTime,
          originalEndTime: editingAcademyItem.originalEndTime,
        };
        if (foundIdx >= 0) {
          const copy = [...list];
          copy[foundIdx] = updatedEntry;
          return copy;
        }
        return [...list, updatedEntry];
      })
    );
    setEditingAcademyItem(null);
  };

  const handleSaveAcademyTimeOnly = () => {
    if (!editingAcademyItem) return;
    handleSelectAcademySubject(tempAcademySubject || editingAcademyItem.subject);
  };

  const handleCancelAcademyToday = () => {
    if (!editingAcademyItem) return;
    onUpdateDailyOverrides((prev) =>
      getUpdatedAcademyOverrides(prev, (list) => {
        const foundIdx = list.findIndex(
          (x) =>
            (editingAcademyItem.masterId && x.masterId === editingAcademyItem.masterId) ||
            x.id === editingAcademyItem.id
        );
        const updatedEntry: AcademyOverrideItem = {
          id: editingAcademyItem.id,
          masterId: editingAcademyItem.masterId,
          startTime: tempStartTime,
          endTime: tempEndTime,
          subject: editingAcademyItem.subject,
          isCancelled: true,
          isAdded: editingAcademyItem.isAdded,
          originalSubject: editingAcademyItem.originalSubject,
          originalStartTime: editingAcademyItem.originalStartTime,
          originalEndTime: editingAcademyItem.originalEndTime,
        };
        if (foundIdx >= 0) {
          const copy = [...list];
          copy[foundIdx] = updatedEntry;
          return copy;
        }
        return [...list, updatedEntry];
      })
    );
    setEditingAcademyItem(null);
  };

  const handleRestoreOrDeleteAcademyItem = () => {
    if (!editingAcademyItem) return;

    if (editingAcademyItem.isAdded) {
      onUpdateDailyOverrides((prev) =>
        getUpdatedAcademyOverrides(prev, (list) =>
          list.filter((x) => x.id !== editingAcademyItem.id)
        )
      );
    } else if (editingAcademyItem.masterId) {
      onUpdateDailyOverrides((prev) =>
        getUpdatedAcademyOverrides(prev, (list) =>
          list.filter((x) => x.masterId !== editingAcademyItem.masterId)
        )
      );
    }
    setEditingAcademyItem(null);
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
      {/* Top Controls Card: View Switch + Week Navigation + 7 Day Tabs */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                viewMode === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tr(lang, '일별 상세 보기', 'Daily Detail', '每日详情')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                viewMode === 'weekly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tr(lang, '주간 한눈에 보기', 'Weekly Grid', '每周总览')}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleShiftWeek(-1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform"
              aria-label="Prev Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {!isSelectedToday && (
              <button
                type="button"
                onClick={handleGoToday}
                className="px-2.5 h-8 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
              >
                {tr(lang, '오늘', 'Today', '今天')}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleShiftWeek(1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform"
              aria-label="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Date Caption */}
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-medium text-slate-500 tabular-nums">
            {selectedDateStr} ({translateDay(dailyData.dayOfWeek, lang)})
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {startHourFormatted}~{endHourFormatted} ·{' '}
            {tr(lang, '터치 시 수정', 'Tap to edit', '点击修改')}
          </div>
        </div>

        {/* Mon ~ Sun 7 Day Tabs */}
        <div className="grid grid-cols-7 gap-1.5">
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
                className={`relative flex flex-col items-center justify-center py-2 rounded-xl transition-all min-h-[58px] ${
                  wd.isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : wd.isToday
                    ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-300'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {wd.isToday && (
                  <span
                    className={`text-[9px] font-bold tracking-tight px-1.5 py-0.2 rounded-full mb-0.5 whitespace-nowrap ${
                      wd.isSelected
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    TODAY
                  </span>
                )}
                <span
                  className={`text-xs font-semibold ${
                    wd.isSelected
                      ? 'text-white'
                      : wd.dayLabel === '일'
                      ? 'text-rose-500'
                      : wd.dayLabel === '토'
                      ? 'text-blue-600'
                      : 'text-slate-700'
                  }`}
                >
                  {translateDay(wd.dayLabel, lang)}
                </span>
                <span
                  className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                    wd.isSelected ? 'text-indigo-100' : 'text-slate-500'
                  }`}
                >
                  {wd.dayNumber}
                </span>
                {hasOverride && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      wd.isSelected ? 'bg-amber-300' : 'bg-amber-500'
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
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900 tabular-nums">
                  {startHourFormatted} ~ {endHourFormatted}{' '}
                  {tr(lang, '시간 밀도 및 공강 현황', 'Time Density & Free Slots', '时间分布与空档概况')}
                </span>
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDailySubMode('timeline')}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    dailySubMode === 'timeline'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
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
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    dailySubMode === 'list'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <AlignJustify className="w-3 h-3" />
                  {tr(lang, '목록형', 'List', '列表')}
                </button>
              </div>
            </div>

            {/* Horizontal Visual Spectrum Bar */}
            <div className="space-y-1">
              <div className="relative h-4 w-full rounded-lg bg-emerald-50 border border-emerald-200/80 overflow-hidden">
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
                        ? 'bg-orange-500 z-10'
                        : seg.type === 'school'
                        ? 'bg-indigo-500'
                        : seg.type === 'academy'
                        ? 'bg-violet-500'
                        : 'bg-emerald-200/50'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums px-0.5">
                {spectrumTickHours.map((h) => (
                  <span key={h}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>
            </div>

            {/* 3 Summary Metric Boxes */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-100">
                <div className="text-[11px] font-semibold text-indigo-700 flex items-center justify-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />{' '}
                  {tr(lang, '학교 수업', 'School', '学校课程')}
                </div>
                <div className="text-xs font-bold text-indigo-950 font-mono tabular-nums mt-0.5">
                  {formatDurationLocalized(timelineLayout.schoolMinutesTotal, lang)}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-violet-50/80 border border-violet-100">
                <div className="text-[11px] font-semibold text-violet-700 flex items-center justify-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />{' '}
                  {tr(lang, '학원 수업', 'Academy', '补习班')}
                </div>
                <div className="text-xs font-bold text-violet-950 font-mono tabular-nums mt-0.5">
                  {formatDurationLocalized(timelineLayout.academyMinutesTotal, lang)}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
                <div className="text-[11px] font-semibold text-emerald-800 flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />{' '}
                  {tr(lang, '비어있는 시간', 'Free Time', '空闲时间')}
                </div>
                <div className="text-xs font-bold text-emerald-950 font-mono tabular-nums mt-0.5">
                  {formatDurationLocalized(timelineLayout.totalFreeMin, lang)}
                </div>
              </div>
            </div>

            {/* CONFLICT ALERT BANNER */}
            {timelineLayout.conflictZones.length > 0 && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-300 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-950">
                    <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-orange-300 text-[11px] text-orange-950 shadow-2xs"
                    >
                      <AlertTriangle className="w-3 h-3 text-orange-600 shrink-0" />
                      <span className="font-bold text-orange-800">{overlapBadgeLabel}</span>
                      <span className="font-mono font-bold tabular-nums">
                        {cz.startTime}~{cz.endTime}
                      </span>
                      <span className="text-slate-600 font-semibold">
                        ({cz.involvedSubjects.join(' · ')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Free Time Chips List */}
            {timelineLayout.freeSlots.length > 0 && (
              <div className="pt-1 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800">
                    {tr(
                      lang,
                      `오늘 비어있는 주요 여유 시간대 (${timelineLayout.freeSlots.length}구간)`,
                      `Available Free Time Slots (${timelineLayout.freeSlots.length})`,
                      `今日主要空闲时间段 (${timelineLayout.freeSlots.length}处)`
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAddAcademyModal('18:00', '20:00')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:underline"
                  >
                    <Plus className="w-3 h-3" />{' '}
                    {tr(lang, '당일 보강/특강 추가', 'Add Makeup Class', '添加当天补课/特讲')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {timelineLayout.freeSlots.map((slot) => (
                    <button
                      key={`chip-${slot.startTime}-${slot.endTime}`}
                      type="button"
                      onClick={() => openAddAcademyModal(slot.startTime, slot.endTime)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 hover:bg-emerald-100 transition-colors"
                    >
                      <span className="font-mono font-bold tabular-nums">
                        {slot.startTime}~{slot.endTime}
                      </span>
                      <span className="text-emerald-700 font-semibold">
                        ({formatDurationLocalized(slot.durationMin, lang)})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {dailySubMode === 'timeline' ? (
            /* VERTICAL TIMELINE VIEW */
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600" />
                    {tr(lang, '학교', 'School', '学校')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-violet-600" />
                    {tr(lang, '학원', 'Academy', '补习班')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-100 border border-emerald-500 border-dashed" />
                    {tr(lang, '빈 시간', 'Free', '空闲')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-orange-700">
                    <AlertTriangle className="w-3 h-3 text-orange-600" />
                    {overlapBadgeLabel}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {startHourFormatted} ~ {endHourFormatted}
                </span>
              </div>

              <div className="relative select-none px-2.5 py-4">
                <div
                  className="relative flex"
                  style={{ height: `${totalHours * HOUR_HEIGHT_PX}px` }}
                >
                  {/* Left Time Axis Column */}
                  <div className="w-14 shrink-0 relative border-r border-slate-200 pr-2">
                    {hoursArray.map((hour) => {
                      const topPx = (hour - startHour) * HOUR_HEIGHT_PX;
                      return (
                        <div
                          key={hour}
                          className="absolute right-2 -translate-y-1/2 flex items-center gap-1"
                          style={{ top: `${topPx}px` }}
                        >
                          <span className="text-[11px] font-mono font-bold text-slate-600 tabular-nums">
                            {String(hour).padStart(2, '0')}:00
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Schedule Canvas Column */}
                  <div className="flex-1 relative ml-1.5">
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
                            className="absolute left-0 right-0 border-t border-slate-200/90 pointer-events-none"
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
                        className="absolute -left-1.5 right-0 z-20 pointer-events-none border-y-2 border-orange-500 bg-orange-500/10 flex items-start justify-center"
                      >
                        <div className="-mt-2.5 px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold shadow-sm inline-flex items-center gap-1 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0" />
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
                          className="group absolute left-0.5 right-0.5 rounded-xl border border-dashed border-emerald-400/80 bg-emerald-50/35 hover:bg-emerald-50/80 hover:border-emerald-500 transition-colors px-3 py-1.5 flex items-center justify-between text-left overflow-hidden"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="text-[11px] font-mono font-bold text-emerald-900 tabular-nums whitespace-nowrap">
                                {slot.startTime} ~ {slot.endTime}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100/90 text-[10px] font-bold text-emerald-800 whitespace-nowrap">
                                {tr(lang, '빈 시간', 'Free', '空闲')} ·{' '}
                                {formatDurationLocalized(slot.durationMin, lang)}
                              </span>
                            </div>
                            {slot.durationMin >= 45 && (
                              <p className="text-[11px] font-medium text-emerald-700/90 mt-0.5 truncate">
                                {slot.contextLabel}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 group-hover:text-emerald-950 shrink-0 ml-2 px-2 py-1 rounded-lg bg-white/80 border border-emerald-200/80">
                            {tr(lang, '+ 보강 추가', '+ Add', '+ 补课')}
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
                            onClick={() => setEditingSchoolPeriod(item)}
                            style={{
                              top: `${topPx + 1}px`,
                              height: `${Math.max(36, heightPx - 2)}px`,
                              left: `calc(${leftPercent}% + 2px)`,
                              width: `calc(${widthPercent}% - 4px)`,
                            }}
                            className={`absolute z-10 rounded-xl px-3 py-1.5 text-left transition-all flex items-center justify-between gap-2 overflow-hidden border shadow-2xs ${
                              isCurrentClass
                                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400'
                                : item.isCancelled
                                ? 'bg-slate-100/95 text-slate-400 border-slate-300 line-through'
                                : item.isOverlapping
                                ? 'bg-orange-50/95 text-slate-900 border-orange-500 ring-1 ring-orange-400 hover:bg-orange-100/80'
                                : item.isModified
                                ? 'bg-amber-50 text-slate-900 border-amber-400 hover:bg-amber-100/80'
                                : 'bg-indigo-50/95 text-slate-900 border-indigo-300/90 hover:bg-indigo-100/80'
                            }`}
                          >
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[11px] font-mono font-bold tabular-nums whitespace-nowrap ${
                                    isCurrentClass
                                      ? 'text-indigo-100'
                                      : item.isCancelled
                                      ? 'text-slate-400'
                                      : item.isOverlapping
                                      ? 'text-orange-900'
                                      : 'text-indigo-700'
                                  }`}
                                >
                                  {tr(lang, `${item.period}교시`, `P${item.period}`, `第${item.period}节`)} ·{' '}
                                  {item.startTime} ~ {item.endTime}
                                </span>

                                {item.isOverlapping && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-md whitespace-nowrap shadow-2xs">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {overlapBadgeLabel}
                                  </span>
                                )}

                                {isCurrentClass && (
                                  <span className="px-1.5 py-0.2 text-[10px] font-bold bg-white text-indigo-700 rounded whitespace-nowrap">
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
                                      ? 'text-white'
                                      : item.isCancelled
                                      ? 'text-slate-400 line-through'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {item.isCancelled
                                    ? `${tr(lang, '휴강/자습', 'Self-Study', '停课/自习')} (${translateSubject(
                                        item.subject,
                                        lang
                                      )})`
                                    : translateSubject(item.subject, lang)}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-[11px] font-semibold shrink-0 ${
                                isCurrentClass ? 'text-indigo-100' : 'text-indigo-600/80'
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
                            className={`absolute z-10 rounded-xl px-2.5 py-2 text-left transition-all flex flex-col justify-between overflow-hidden border shadow-2xs ${
                              isCurrentAcademy
                                ? 'bg-violet-600 text-white border-violet-700 ring-2 ring-violet-400'
                                : item.isCancelled
                                ? 'bg-slate-100/95 text-slate-400 border-slate-300 line-through'
                                : item.isOverlapping
                                ? 'bg-orange-50/95 text-slate-900 border-orange-500 ring-1 ring-orange-400 hover:bg-orange-100/85'
                                : 'bg-violet-50/95 text-slate-900 border-violet-300 hover:bg-violet-100/80'
                            }`}
                          >
                            <div className="min-w-0 w-full">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold tabular-nums whitespace-nowrap ${
                                    isCurrentAcademy
                                      ? 'text-violet-100'
                                      : item.isCancelled
                                      ? 'text-slate-400'
                                      : item.isOverlapping
                                      ? 'text-orange-900'
                                      : 'text-violet-700'
                                  }`}
                                >
                                  <Clock className="w-3 h-3 shrink-0" />
                                  {item.startTime} ~ {item.endTime}
                                </span>

                                <div className="flex items-center gap-1 flex-wrap">
                                  {item.isOverlapping && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-md whitespace-nowrap shadow-2xs">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      {overlapBadgeLabel}
                                    </span>
                                  )}
                                  {isCurrentAcademy && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-white text-violet-700 rounded whitespace-nowrap">
                                      {tr(lang, '수업 중', 'LIVE', '上课中')}
                                    </span>
                                  )}
                                  {item.isAdded && (
                                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-200 text-emerald-950 rounded whitespace-nowrap">
                                      {tr(lang, '당일 보강', 'Makeup', '临时补课')}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-sm font-bold truncate ${
                                    isCurrentAcademy
                                      ? 'text-white'
                                      : item.isCancelled
                                      ? 'text-slate-400 line-through'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {item.isCancelled
                                    ? `${translateSubject(item.subject, lang)} (${tr(
                                        lang,
                                        '당일 휴강',
                                        'Cancelled',
                                        '停课'
                                      )})`
                                    : translateSubject(item.subject, lang)}
                                </span>

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
                            </div>

                            <div
                              className={`text-[10px] font-semibold self-end ${
                                isCurrentAcademy
                                  ? 'text-violet-100'
                                  : item.isOverlapping
                                  ? 'text-orange-800'
                                  : 'text-violet-600/80'
                              }`}
                            >
                              {tr(lang, '터치하여 수정', 'Tap to edit', '点击修改')}
                            </div>
                          </button>
                        );
                      }
                    )}

                    {/* CURRENT TIME LIVE INDICATOR LINE */}
                    {showLiveNowLine && (
                      <div
                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                        style={{ top: `${liveNowTopPx}px` }}
                      >
                        <span className="-ml-1.5 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-mono font-bold tabular-nums shadow-xs">
                          NOW {minutesToTimeStr(nowMinutes)}
                        </span>
                        <div className="flex-1 border-t-2 border-rose-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            /* SUB-MODE: SECTION LIST VIEW */
            <div className="space-y-4">
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-900">
                      {tr(lang, '학교 시간표', 'School Schedule', '学校课表')}
                    </h2>
                    <span className="text-xs text-slate-500 tabular-nums">
                      · {translateDay(dailyData.dayOfWeek, lang)} ({dailyData.school.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {tr(lang, '터치하여 당일 변경', 'Tap to edit', '点击修改当天')}
                  </span>
                </div>

                {dailyData.school.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-600">
                      {tr(
                        lang,
                        '등록된 정규 학교 수업이 없습니다.',
                        'No regular school classes scheduled.',
                        '当天没有登记常规学校课程。'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {dailyData.school.map((item) => {
                      const isCurrentClass =
                        isSelectedToday &&
                        !item.isCancelled &&
                        isTimeInRange(nowMinutes, item.startTime, item.endTime);

                      return (
                        <button
                          key={item.period}
                          type="button"
                          onClick={() => setEditingSchoolPeriod(item)}
                          className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors min-h-[60px] ${
                            isCurrentClass
                              ? 'bg-indigo-50/80 ring-2 ring-inset ring-indigo-500'
                              : item.isCancelled
                              ? 'bg-slate-50/70 opacity-75'
                              : item.isOverlapping
                              ? 'bg-orange-50/60 hover:bg-orange-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-indigo-700 font-mono tabular-nums whitespace-nowrap">
                                {tr(lang, `${item.period}교시`, `P${item.period}`, `第${item.period}节`)} ·{' '}
                                {item.startTime} ~ {item.endTime}
                              </span>
                              {item.isOverlapping && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 rounded-md whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  {overlapBadgeLabel}
                                </span>
                              )}
                              {isCurrentClass && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-md whitespace-nowrap">
                                  {tr(lang, '수업 중', 'LIVE', '上课中')}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-base font-bold ${
                                  item.isCancelled
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-900'
                                }`}
                              >
                                {item.isCancelled
                                  ? `${tr(lang, '휴강/자습', 'Self-Study', '停课/自习')} (${translateSubject(
                                      item.subject,
                                      lang
                                    )})`
                                  : translateSubject(item.subject, lang)}
                              </span>
                              {item.isModified && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 rounded-md whitespace-nowrap">
                                  {tr(
                                    lang,
                                    `변경됨 (기존: ${translateSubject(item.originalSubject, lang)})`,
                                    `Modified (${translateSubject(item.originalSubject, lang)})`,
                                    `已调课 (原: ${translateSubject(item.originalSubject, lang)})`
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-medium text-slate-400 shrink-0">
                            {tr(lang, '변경', 'Edit', '修改')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-violet-600" />
                    <h2 className="text-sm font-bold text-slate-900">
                      {tr(lang, '학원 시간표', 'Academy Schedule', '补习班课表')}
                    </h2>
                    <span className="text-xs text-slate-500 tabular-nums">
                      · {dailyData.academy.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddAcademyModal('18:00', '20:00')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tr(lang, '당일 보강/특강 추가', 'Add Makeup', '添加补课/特讲')}
                  </button>
                </div>

                {dailyData.academy.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-slate-600">
                      {tr(
                        lang,
                        '오늘 예정된 학원 수업이 없습니다.',
                        'No academy classes scheduled for today.',
                        '今天没有安排补习班课程。'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
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
                              ? 'bg-violet-50/80 ring-2 ring-inset ring-violet-500'
                              : item.isCancelled
                              ? 'bg-slate-50/70 opacity-75'
                              : item.isOverlapping
                              ? 'bg-orange-50/60 hover:bg-orange-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 font-mono tabular-nums whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5" />
                                {item.startTime} ~ {item.endTime}
                              </span>
                              {item.isOverlapping && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300 rounded-md whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                                  {overlapBadgeLabel}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-base font-bold ${
                                  item.isCancelled
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-900'
                                }`}
                              >
                                {item.isCancelled
                                  ? `${translateSubject(item.subject, lang)} (${tr(
                                      lang,
                                      '당일 휴강',
                                      'Cancelled',
                                      '停课'
                                    )})`
                                  : translateSubject(item.subject, lang)}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-slate-400 shrink-0">
                            {tr(lang, '수정', 'Edit', '修改')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: WEEKLY OVERVIEW GRID */
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {tr(lang, '주간 학교 시간표 (월~금)', 'Weekly School Timetable (Mon–Fri)', '每周学校课表 (周一至周五)')}
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {tr(lang, '요일 클릭 시 상세 이동', 'Tap day to open detail', '点击星期查看详情')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="py-2 px-1.5 text-[11px] font-semibold text-slate-500 border-r border-slate-100 w-12">
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
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>{translateDay(wd.dayLabel, lang)}</div>
                        <div className="text-[10px] font-mono font-normal text-slate-400 tabular-nums">
                          {wd.dayNumber}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {[1, 2, 3, 4, 5, 6, 7].map((periodNum) => (
                    <tr key={periodNum}>
                      <td className="py-2.5 px-1 font-mono font-semibold text-slate-500 bg-slate-50/40 border-r border-slate-100 tabular-nums">
                        {tr(lang, `${periodNum}교시`, `P${periodNum}`, `第${periodNum}节`)}
                      </td>
                      {weeklyData.slice(0, 5).map((wd) => {
                        const cell = wd.resolved.school.find((s) => s.period === periodNum);
                        if (!cell) {
                          return (
                            <td key={wd.dateStr} className="py-2.5 px-1 text-slate-300">
                              -
                            </td>
                          );
                        }
                        return (
                          <td
                            key={wd.dateStr}
                            onClick={() => {
                              setSelectedDate(wd.dateObj);
                              setViewMode('daily');
                            }}
                            className={`py-2.5 px-1 cursor-pointer transition-colors ${
                              cell.isCancelled
                                ? 'text-slate-400 line-through bg-slate-50'
                                : cell.isModified
                                ? 'bg-amber-50/80 text-amber-900 font-bold'
                                : wd.isToday
                                ? 'bg-indigo-50/30 font-semibold text-slate-800'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="truncate max-w-[54px] mx-auto">
                              {translateSubject(cell.subject, lang)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-violet-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {tr(lang, '주간 학원 시간표 (월~일)', 'Weekly Academies (Mon–Sun)', '每周补习班课表 (周一至周日)')}
                </h2>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {weeklyData.map((wd) => (
                <div
                  key={wd.dateStr}
                  onClick={() => {
                    setSelectedDate(wd.dateObj);
                    setViewMode('daily');
                  }}
                  className={`px-4 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                    wd.isToday ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <div className="w-14 shrink-0 pt-0.5">
                    <span className="text-xs font-bold text-slate-800">
                      {translateDay(wd.dayLabel, lang)}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400 tabular-nums">
                      {wd.dayNumber}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {wd.resolved.academy.length === 0 ? (
                      <span className="text-xs text-slate-400 py-0.5">
                        {tr(lang, '등록된 학원 없음', 'None', '无补习班')}
                      </span>
                    ) : (
                      wd.resolved.academy.map((ac) => (
                        <div
                          key={ac.id}
                          className={`px-2.5 py-1 rounded-lg text-xs border inline-flex items-center gap-1 ${
                            ac.isCancelled
                              ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                              : ac.isOverlapping
                              ? 'bg-orange-50 border-orange-300 text-orange-900'
                              : 'bg-violet-50/70 border-violet-200 text-violet-900'
                          }`}
                        >
                          {ac.isOverlapping && (
                            <AlertTriangle className="w-3 h-3 text-orange-600 shrink-0" />
                          )}
                          <span className="font-mono text-[11px] font-semibold tabular-nums">
                            {ac.startTime}~{ac.endTime}
                          </span>
                          <span className="font-bold">{translateSubject(ac.subject, lang)}</span>
                          {ac.isOverlapping && (
                            <span className="text-[10px] font-bold text-orange-700">
                              {overlapBadgeLabel}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* MODAL 1: 2-TAP SCHOOL PERIOD OVERRIDE BOTTOM SHEET */}
      {editingSchoolPeriod && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setEditingSchoolPeriod(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-indigo-600 font-mono tabular-nums">
                  {selectedDateStr} ({translateDay(dailyData.dayOfWeek, lang)}) ·{' '}
                  {tr(
                    lang,
                    `${editingSchoolPeriod.period}교시`,
                    `P${editingSchoolPeriod.period}`,
                    `第${editingSchoolPeriod.period}节`
                  )}{' '}
                  ({editingSchoolPeriod.startTime} ~ {editingSchoolPeriod.endTime})
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {tr(lang, '당일 학교 과목 2-Tap 변경', '2-Tap Daily Subject Override', '当天学校课程 2步修改')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr(
                    lang,
                    `과목 후보군을 터치하면 오늘(${selectedDateStr}) 시간표만 즉시 변경됩니다.`,
                    `Tap any subject below to override only ${selectedDateStr}.`,
                    `点击下方候选科目，仅立即修改当天（${selectedDateStr}）的课表。`
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchoolPeriod(null)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {subjectPool.school.map((subj) => {
                const isCurrent =
                  !editingSchoolPeriod.isCancelled && editingSchoolPeriod.subject === subj;
                const isOriginal = editingSchoolPeriod.originalSubject === subj;

                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => handleSelectSchoolSubject(subj)}
                    className={`min-h-[48px] px-3 py-2.5 rounded-xl text-sm font-bold border transition-all flex flex-col items-center justify-center ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 active:scale-95'
                    }`}
                  >
                    <span>{translateSubject(subj, lang)}</span>
                    {isOriginal && (
                      <span
                        className={`text-[10px] font-medium ${
                          isCurrent ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        {tr(lang, '기본 과목', 'Default', '默认科目')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelOrSelfStudySchoolPeriod}
                className="min-h-[46px] px-3 py-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100 active:scale-98 transition-all"
              >
                <Ban className="w-4 h-4 text-amber-700" />
                {tr(lang, '당일 휴강/자습 처리', 'Mark Self-Study / Off', '设为今日停课/自习')}
              </button>

              <button
                type="button"
                onClick={handleRestoreSchoolPeriod}
                className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 active:scale-98 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-slate-600" />
                {tr(lang, '기본 시간표로 원상복구', 'Restore Default', '恢复默认课表')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ACADEMY 2-TAP EDIT OR ADD MAKEUP CLASS BOTTOM SHEET */}
      {(editingAcademyItem || isAddingAcademy) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => {
            setEditingAcademyItem(null);
            setIsAddingAcademy(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-violet-600 font-mono tabular-nums">
                  {selectedDateStr} ({translateDay(dailyData.dayOfWeek, lang)})
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {isAddingAcademy
                    ? tr(lang, '당일 학원 보강/특강 추가', 'Add Makeup / Special Class', '添加当天补课/特讲')
                    : tr(lang, '당일 학원 시간표 변경', 'Edit Daily Academy Slot', '修改当天补习班时间')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tr(
                    lang,
                    '시간대를 조정하고 학원 후보군 버튼을 터치하면 즉시 반영됩니다.',
                    'Adjust the time and tap an academy button below to apply.',
                    '调整时间段后点击下方补习班按钮即可立即生效。'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAcademyItem(null);
                  setIsAddingAcademy(false);
                }}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                {tr(lang, '수업 시간 설정', 'Class Time Range', '设置上课时间')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value)}
                  className="flex-1 h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-mono font-semibold text-slate-900"
                />
                <span className="text-sm font-bold text-slate-400">~</span>
                <input
                  type="time"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value)}
                  className="flex-1 h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-mono font-semibold text-slate-900"
                />
                {!isAddingAcademy && (
                  <button
                    type="button"
                    onClick={handleSaveAcademyTimeOnly}
                    className="h-11 px-3.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap hover:bg-slate-800"
                  >
                    {tr(lang, '시간만 저장', 'Save Time', '仅保存时间')}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">
                {tr(lang, '학원 후보군 선택 (터치 시 즉시 적용)', 'Select Academy (Instant Apply)', '选择补习班（点击立即应用）')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {subjectPool.academy.map((acName) => {
                  const isCurrent =
                    !isAddingAcademy &&
                    editingAcademyItem &&
                    !editingAcademyItem.isCancelled &&
                    editingAcademyItem.subject === acName;

                  return (
                    <button
                      key={acName}
                      type="button"
                      onClick={() => handleSelectAcademySubject(acName)}
                      className={`min-h-[48px] px-3 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center justify-center ${
                        isCurrent
                          ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-violet-50 hover:border-violet-300 active:scale-95'
                      }`}
                    >
                      {translateSubject(acName, lang)}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isAddingAcademy && editingAcademyItem && (
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelAcademyToday}
                  className="min-h-[46px] px-3 py-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100 active:scale-98 transition-all"
                >
                  <Ban className="w-4 h-4 text-amber-700" />
                  {tr(lang, '당일 휴강 처리', 'Cancel Today', '今日停课')}
                </button>

                <button
                  type="button"
                  onClick={handleRestoreOrDeleteAcademyItem}
                  className="min-h-[46px] px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 active:scale-98 transition-all"
                >
                  {editingAcademyItem.isAdded ? (
                    <>
                      <Trash2 className="w-4 h-4 text-rose-600" />
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
            )}
          </div>
        </div>
      )}
    </div>
  );
};
