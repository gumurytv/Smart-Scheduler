import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Calendar as CalendarIcon,
  X,
  Trash2,
  Edit3,
  ListChecks,
} from 'lucide-react';
import {
  ScheduleItem,
  ScheduleCategory,
  DAYS_OF_WEEK,
  AppLanguage,
  MasterTimetable,
  DailyOverrides,
} from '../types';
import {
  formatDateKey,
  addDays,
  getMondayOfCurrentWeek,
  getDayOfWeekKor,
} from '../data/initialData';
import { tr, translateDay, translateSampleText } from '../i18n/translations';

interface ScheduleTabProps {
  language?: AppLanguage;
  schedules: ScheduleItem[];
  onUpdateSchedules: (updater: (prev: ScheduleItem[]) => ScheduleItem[]) => void;
  masterTimetable?: MasterTimetable;
  dailyOverrides?: DailyOverrides;
}

const CATEGORY_META: Record<
  ScheduleCategory,
  {
    ko: string;
    en: string;
    zh: string;
    shortKo: string;
    shortEn: string;
    shortZh: string;
    badgeBg: string;
    badgeText: string;
    barBg: string;
    dotBg: string;
    exampleKo: string;
    exampleEn: string;
    exampleZh: string;
  }
> = {
  school: {
    ko: '학교 일정',
    en: 'School',
    zh: '学校日程',
    shortKo: '학교',
    shortEn: 'School',
    shortZh: '学校',
    badgeBg: 'bg-sage-100',
    badgeText: 'text-sage-800',
    barBg: 'bg-sage',
    dotBg: 'bg-sage',
    exampleKo: '중간고사, 수행평가, 방학식',
    exampleEn: 'Midterm exams, school assessment, ceremony',
    exampleZh: '期中考试、随堂测评、放假仪式',
  },
  academy: {
    ko: '학원 일정',
    en: 'Academy',
    zh: '补习班日程',
    shortKo: '학원',
    shortEn: 'Academy',
    shortZh: '补习班',
    badgeBg: 'bg-accent-100',
    badgeText: 'text-accent-800',
    barBg: 'bg-accent',
    dotBg: 'bg-accent',
    exampleKo: '학원 레벨테스트, 보강 수업, 단어 시험',
    exampleEn: 'Academy level test, makeup class, vocab quiz',
    exampleZh: '补习班水平测试、补课、单词测验',
  },
  other: {
    ko: '기타 일정',
    en: 'Other',
    zh: '其他日程',
    shortKo: '기타',
    shortEn: 'Other',
    shortZh: '其他',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    barBg: 'bg-slate-500',
    dotBg: 'bg-slate-500',
    exampleKo: '병원 진료, 가족 행사, 동아리 모임',
    exampleEn: 'Clinic visit, family event, club gathering',
    exampleZh: '医院就诊、家庭聚会、社团活动',
  },
};

const CATEGORIES: ScheduleCategory[] = ['school', 'academy', 'other'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole-day difference target - today (positive = future). */
function diffDaysFrom(targetDateStr: string, todayStr: string): number {
  return Math.round(
    (parseDateKey(targetDateStr).getTime() - parseDateKey(todayStr).getTime()) / 86400000
  );
}

function calculateDDayLabel(targetDateStr: string, todayStr: string): string | null {
  const diff = diffDaysFrom(targetDateStr, todayStr);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return null;
}

/** D-label that also covers past dates (D+n). */
function dateBadgeLabel(dateStr: string, todayStr: string): string {
  const diff = diffDaysFrom(dateStr, todayStr);
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

function isDateWithinSchedule(dateStr: string, item: ScheduleItem): boolean {
  if (!item.endDate || item.endDate <= item.date) {
    return item.date === dateStr;
  }
  return dateStr >= item.date && dateStr <= item.endDate;
}

function isMultiDay(item: ScheduleItem): boolean {
  return !!item.endDate && item.endDate > item.date;
}

function sortByTime(a: ScheduleItem, b: ScheduleItem): number {
  return (a.time || '99:99').localeCompare(b.time || '99:99');
}

/** ko `10월 15일 (목)`, en `Oct 15 (Thu)`, zh `10月15日 (周四)` */
function formatDateLabel(dateStr: string, lang: AppLanguage, withWeekday = true): string {
  const d = parseDateKey(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = withWeekday ? ` (${translateDay(getDayOfWeekKor(d), lang)})` : '';
  return tr(lang, `${m}월 ${day}일${wd}`, `${EN_MONTHS[m - 1]} ${day}${wd}`, `${m}月${day}日${wd}`);
}

function formatShortDate(dateStr: string, lang: AppLanguage): string {
  const d = parseDateKey(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return tr(lang, `${m}/${day}`, `${m}/${day}`, `${m}/${day}`);
}

export const ScheduleTab: React.FC<ScheduleTabProps> = ({
  language = 'ko',
  schedules,
  onUpdateSchedules,
}) => {
  const lang = language;
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ScheduleCategory>('all');
  const [cursorDate, setCursorDate] = useState<Date>(today);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Date popup (bottom sheet) state: the date it shows + shared add/edit form
  const [sheetDateStr, setSheetDateStr] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<ScheduleCategory>('school');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formMemo, setFormMemo] = useState<string>('');

  const isSheetOpen = sheetDateStr !== null;

  useEffect(() => {
    if (!isSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetDateStr(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSheetOpen]);

  const filteredSchedules = useMemo(() => {
    if (categoryFilter === 'all') return schedules;
    return schedules.filter((s) => s.category === categoryFilter);
  }, [schedules, categoryFilter]);

  const eventsOn = (dateStr: string, list: ScheduleItem[] = filteredSchedules) =>
    list.filter((ev) => isDateWithinSchedule(dateStr, ev)).sort(sortByTime);

  const monthCalendarCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      events: ScheduleItem[];
    }> = [];

    const pushCell = (d: Date, isCurrentMonth: boolean) => {
      const dateStr = formatDateKey(d);
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        events: filteredSchedules.filter((ev) => isDateWithinSchedule(dateStr, ev)).sort(sortByTime),
      });
    };

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      pushCell(new Date(year, month - 1, prevMonthLastDay - i), false);
    }
    for (let day = 1; day <= totalDays; day++) {
      pushCell(new Date(year, month, day), true);
    }
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      pushCell(new Date(year, month + 1, i), false);
    }
    return cells;
  }, [cursorDate, filteredSchedules, todayStr, selectedDateStr]);

  const weekDaysList = useMemo(() => {
    const monday = getMondayOfCurrentWeek(cursorDate);
    return DAYS_OF_WEEK.map((dayLabel, idx) => {
      const d = addDays(monday, idx);
      const dateStr = formatDateKey(d);
      return {
        dayLabel,
        dateObj: d,
        dateStr,
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        events: filteredSchedules
          .filter((ev) => isDateWithinSchedule(dateStr, ev))
          .sort(sortByTime),
      };
    });
  }, [cursorDate, filteredSchedules, todayStr, selectedDateStr]);

  // Period covered by the current view (inclusive date keys)
  const periodDates = useMemo(() => {
    if (viewMode === 'day') return [selectedDateStr];
    if (viewMode === 'week') return weekDaysList.map((w) => w.dateStr);
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const total = new Date(year, month + 1, 0).getDate();
    const out: string[] = [];
    for (let day = 1; day <= total; day++) out.push(formatDateKey(new Date(year, month, day)));
    return out;
  }, [viewMode, selectedDateStr, weekDaysList, cursorDate]);

  // Chronological groups: one per date that has events (multi-day events appear on every date they cover)
  const periodGroups = useMemo(() => {
    return periodDates
      .map((dateStr) => ({
        dateStr,
        events: filteredSchedules.filter((ev) => isDateWithinSchedule(dateStr, ev)).sort(sortByTime),
      }))
      .filter((g) => g.events.length > 0);
  }, [periodDates, filteredSchedules]);

  const firstUpcomingIdx = periodGroups.findIndex((g) => g.dateStr >= todayStr);
  const upcomingCountInPeriod = periodGroups
    .filter((g) => g.dateStr >= todayStr)
    .reduce((n, g) => n + g.events.length, 0);
  const totalCountInPeriod = periodGroups.reduce((n, g) => n + g.events.length, 0);

  const upcomingEvents = useMemo(() => {
    return filteredSchedules
      .filter((ev) => ev.date >= todayStr || (ev.endDate && ev.endDate >= todayStr))
      .sort((a, b) => {
        const ta = isDateWithinSchedule(todayStr, a) ? 0 : 1;
        const tb = isDateWithinSchedule(todayStr, b) ? 0 : 1;
        return ta - tb || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
      })
      .slice(0, 6);
  }, [filteredSchedules, todayStr]);

  const sheetEvents = useMemo(
    () => (sheetDateStr ? schedules.filter((ev) => isDateWithinSchedule(sheetDateStr, ev)).sort(sortByTime) : []),
    [schedules, sheetDateStr]
  );

  const handleNavigate = (dir: -1 | 1) => {
    let next: Date;
    if (viewMode === 'month') {
      next = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + dir, 1);
    } else if (viewMode === 'week') {
      next = addDays(cursorDate, dir * 7);
    } else {
      next = addDays(cursorDate, dir);
    }
    setCursorDate(next);
    setSelectedDateStr(formatDateKey(next));
  };

  const handleGoToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDateStr(formatDateKey(now));
  };

  const resetFormForDate = (dateStr: string) => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory(categoryFilter === 'all' ? 'school' : categoryFilter);
    setFormDate(dateStr);
    setFormEndDate('');
    setFormTime('');
    setFormMemo('');
  };

  const fillFormFromItem = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormDate(item.date);
    setFormEndDate(item.endDate || '');
    setFormTime(item.time || '');
    setFormMemo(item.memo || '');
  };

  /** One tap on a date: select it and open its popup with a blank add form. */
  const openDateSheet = (dateStr: string, moveCursor = false) => {
    setSelectedDateStr(dateStr);
    if (moveCursor) setCursorDate(parseDateKey(dateStr));
    resetFormForDate(dateStr);
    setSheetDateStr(dateStr);
  };

  /** Open the popup for a date with the form prefilled for editing. */
  const openEditSheet = (item: ScheduleItem, onDateStr?: string) => {
    const dateStr = onDateStr && isDateWithinSchedule(onDateStr, item) ? onDateStr : item.date;
    setSelectedDateStr(dateStr);
    fillFormFromItem(item);
    setSheetDateStr(dateStr);
  };

  const closeSheet = () => setSheetDateStr(null);

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;

    const cleanItem: ScheduleItem = {
      id: editingItem ? editingItem.id : `sch-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      date: formDate,
      endDate: formEndDate && formEndDate > formDate ? formEndDate : undefined,
      time: formTime || undefined,
      memo: formMemo.trim(),
    };

    onUpdateSchedules((prev) => {
      if (editingItem) {
        return prev.map((it) => (it.id === editingItem.id ? cleanItem : it));
      }
      return [...prev, cleanItem];
    });

    // Keep the popup open on the date the event now covers, ready for another entry
    const nextSheetDate =
      sheetDateStr && isDateWithinSchedule(sheetDateStr, cleanItem) ? sheetDateStr : formDate;
    setSelectedDateStr(nextSheetDate);
    setSheetDateStr(nextSheetDate);
    resetFormForDate(nextSheetDate);
  };

  const handleDeleteSchedule = (item: ScheduleItem) => {
    const ok = window.confirm(
      tr(
        lang,
        `'${translateSampleText(item.title, lang)}' 일정을 삭제할까요?`,
        `Delete "${translateSampleText(item.title, lang)}"?`,
        `要删除「${translateSampleText(item.title, lang)}」吗？`
      )
    );
    if (!ok) return;
    onUpdateSchedules((prev) => prev.filter((it) => it.id !== item.id));
    if (editingItem?.id === item.id && sheetDateStr) resetFormForDate(sheetDateStr);
  };

  const calendarWeekHeader = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    translateDay(['일', '월', '화', '수', '목', '금', '토'][i], lang).replace('周', '')
  );

  const navLabel = (() => {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth() + 1;
    if (viewMode === 'month') {
      return tr(lang, `${y}년 ${m}월`, `${EN_MONTHS[m - 1]} ${y}`, `${y}年${m}月`);
    }
    if (viewMode === 'week') {
      return `${formatShortDate(weekDaysList[0].dateStr, lang)} – ${formatShortDate(
        weekDaysList[6].dateStr,
        lang
      )}`;
    }
    return formatDateLabel(selectedDateStr, lang);
  })();

  const periodTitle =
    viewMode === 'month'
      ? tr(lang, '이번 달 전체 일정', 'All events this month', '本月全部日程')
      : viewMode === 'week'
      ? tr(lang, '이번 주 전체 일정', 'All events this week', '本周全部日程')
      : tr(lang, '오늘의 일정 목록', 'Events of the day', '当日日程列表');

  const categoryLabel = (cat: ScheduleCategory) => {
    const meta = CATEGORY_META[cat];
    return tr(lang, meta.shortKo, meta.shortEn, meta.shortZh);
  };

  const rangeLabel = (ev: ScheduleItem) =>
    isMultiDay(ev) && ev.endDate
      ? `${formatShortDate(ev.date, lang)} ~ ${formatShortDate(ev.endDate, lang)}`
      : null;

  const dBadgeClass = (label: string, isPast: boolean) =>
    label === 'D-Day'
      ? 'bg-accent text-paper'
      : isPast
      ? 'bg-slate-200 text-slate-600'
      : 'bg-ink text-paper';

  const selectedDayEvents = eventsOn(selectedDateStr);

  return (
    <div className="space-y-4">
      {/* Top Control Card: Month/Week/Day Toggle + Category Filter */}
      {/* Upcoming D-Day Summary Strip */}
      {upcomingEvents.length > 0 && (
        <section className="bg-surface rounded-2xl shadow-xs px-3.5 py-3 space-y-2">
          <h3 className="text-[13px] font-bold text-ink">
            {tr(lang, '다가오는 주요 일정 (D-Day)', 'Upcoming Events (D-Day)', '即将到来的重要日程 (D-Day)')}
          </h3>
          <div className="space-y-2">
            {upcomingEvents.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              const dDay = calculateDDayLabel(ev.date, todayStr) || tr(lang, '진행중', 'Ongoing', '进行中');
              const isTodayEvent = isDateWithinSchedule(todayStr, ev);
              return (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEditSheet(ev)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openEditSheet(ev);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-xl cursor-pointer transition-colors ${
                    isTodayEvent
                      ? 'p-3 bg-accent text-paper shadow-md ring-2 ring-accent-300'
                      : `p-2.5 ${meta.badgeBg} ${meta.badgeText} hover:opacity-90`
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isTodayEvent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-paper text-accent-800">
                        {tr(lang, '오늘', 'Today', '今天')}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        isTodayEvent ? 'bg-accent-800 text-paper' : `text-paper ${meta.barBg}`
                      }`}
                    >
                      {categoryLabel(ev.category)}
                    </span>
                    <span className={`font-bold truncate ${isTodayEvent ? 'text-[14px]' : 'text-xs'}`}>
                      {translateSampleText(ev.title, lang)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono opacity-70 tabular-nums">
                      {ev.time && isTodayEvent ? ev.time : formatShortDate(ev.date, lang)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[13px] font-mono tabular-nums ${
                        isTodayEvent ? 'bg-paper text-accent-800' : 'bg-ink text-paper'
                      }`}
                    >
                      {dDay}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="bg-surface rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-full border border-divider overflow-hidden">
            {(
              [
                { id: 'month', label: tr(lang, '월', 'Month', '月') },
                { id: 'week', label: tr(lang, '주', 'Week', '周') },
                { id: 'day', label: tr(lang, '일', 'Day', '日') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setViewMode(tab.id);
                  setCursorDate(parseDateKey(selectedDateStr));
                }}
                className={`h-[30px] px-3 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === tab.id
                    ? 'bg-accent text-paper'
                    : 'bg-transparent text-ink hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              className="w-8 h-8 shrink-0 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100"
              aria-label={tr(lang, '이전', 'Previous', '上一个')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              className="w-8 h-8 shrink-0 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100"
              aria-label={tr(lang, '다음', 'Next', '下一个')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="px-2.5 h-8 shrink-0 rounded-full bg-accent text-paper text-xs font-bold hover:bg-accent-600 whitespace-nowrap"
            >
              {tr(lang, '오늘', 'Today', '今天')}
            </button>
          </div>
        </div>

        <div className="text-base text-ink font-mono tabular-nums px-1 truncate" aria-live="polite">
          {navLabel}
        </div>

        {/* Category Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`h-[30px] px-3 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-ink text-paper border-transparent'
                : 'bg-transparent text-ink border-divider hover:bg-slate-100'
            }`}
          >
            {tr(lang, '전체', 'All', '全部')}
          </button>
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? `${meta.barBg} text-paper border-transparent`
                    : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-paper' : meta.dotBg}`} />
                {tr(lang, meta.ko, meta.en, meta.zh)}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-surface rounded-2xl shadow-xs overflow-hidden p-3">
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {calendarWeekHeader.map((d, idx) => (
              <div
                key={idx}
                className={`py-1 text-[10px] font-semibold ${
                  idx === 0 ? 'text-accent-700' : idx === 6 ? 'text-sage-700' : 'text-slate-600'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {monthCalendarCells.map((cell) => (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => openDateSheet(cell.dateStr, true)}
                aria-label={formatDateLabel(cell.dateStr, lang)}
                className={`min-h-[72px] p-1 rounded flex flex-col items-start justify-start text-left transition-colors ${
                  cell.isSelected
                    ? 'bg-accent text-paper'
                    : cell.isToday
                    ? 'bg-accent-100 text-ink'
                    : cell.isCurrentMonth
                    ? 'bg-transparent text-ink hover:bg-slate-100'
                    : 'bg-transparent text-slate-400'
                }`}
              >
                <div className="w-full flex items-center justify-between px-0.5">
                  <span
                    className={`text-xs font-mono tabular-nums px-1 py-0.5 ${
                      cell.isSelected
                        ? 'text-paper'
                        : !cell.isCurrentMonth
                        ? 'text-slate-400'
                        : cell.isToday
                        ? 'text-accent-800'
                        : 'text-ink'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {cell.events.length > 0 && (
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        cell.isSelected ? 'text-paper/80' : 'text-slate-500'
                      }`}
                    >
                      {cell.events.length}
                    </span>
                  )}
                </div>

                <div className="w-full mt-1 space-y-0.5 overflow-hidden">
                  {cell.events.slice(0, 2).map((ev) => {
                    const meta = CATEGORY_META[ev.category];
                    return (
                      <div
                        key={ev.id}
                        className={`w-full px-1 py-0.5 rounded text-[10px] font-semibold truncate ${meta.badgeBg} ${meta.badgeText}`}
                      >
                        {translateSampleText(ev.title, lang)}
                      </div>
                    );
                  })}
                  {cell.events.length > 2 && (
                    <div
                      className={`text-[9px] font-semibold pl-1 ${
                        cell.isSelected ? 'text-paper/80' : 'text-slate-500'
                      }`}
                    >
                      +{cell.events.length - 2}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-surface rounded-2xl shadow-xs divide-y divide-divider overflow-hidden">
          {weekDaysList.map((wd) => (
            <div
              key={wd.dateStr}
              role="button"
              tabIndex={0}
              onClick={() => openDateSheet(wd.dateStr, true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDateSheet(wd.dateStr, true);
                }
              }}
              className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                wd.isSelected ? 'bg-accent-100' : 'hover:bg-slate-100'
              }`}
            >
              <div className="w-16 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-ink">{translateDay(wd.dayLabel, lang)}</span>
                  {wd.isToday && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-accent text-paper rounded-full">
                      {tr(lang, '오늘', 'TODAY', '今天')}
                    </span>
                  )}
                </div>
                <span className="text-base font-mono text-ink tabular-nums">
                  {wd.dateObj.getMonth() + 1}/{wd.dayNum}
                </span>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                {wd.events.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-1">
                    {tr(lang, '등록된 일정 없음 · 탭하여 추가', 'No events · tap to add', '无日程 · 点击添加')}
                  </p>
                ) : (
                  wd.events.map((ev) => {
                    const meta = CATEGORY_META[ev.category];
                    const dDay = calculateDDayLabel(ev.date, todayStr);
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSheet(ev, wd.dateStr);
                        }}
                        className="p-2.5 rounded-xl bg-paper flex items-center justify-between gap-2 hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                            >
                              {categoryLabel(ev.category)}
                            </span>
                            {ev.time && (
                              <span className="text-[11px] font-mono text-slate-600 tabular-nums">{ev.time}</span>
                            )}
                            {dDay && (
                              <span className="px-1.5 py-0.5 rounded-full bg-ink text-paper text-[10px] font-mono tabular-nums">
                                {dDay}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-ink mt-1 truncate">
                            {translateSampleText(ev.title, lang)}
                          </p>
                        </div>
                        <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: DAY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-surface rounded-2xl shadow-xs p-3 space-y-3">
          {/* Week strip for quick date picking */}
          <div className="grid grid-cols-7 gap-1">
            {weekDaysList.map((wd) => (
              <button
                key={wd.dateStr}
                type="button"
                onClick={() => {
                  setSelectedDateStr(wd.dateStr);
                  setCursorDate(wd.dateObj);
                }}
                className={`py-1.5 rounded-xl flex flex-col items-center gap-0.5 transition-colors ${
                  wd.isSelected
                    ? 'bg-accent text-paper'
                    : wd.isToday
                    ? 'bg-accent-100 text-accent-800'
                    : 'text-ink hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] font-semibold">
                  {translateDay(wd.dayLabel, lang).replace('周', '')}
                </span>
                <span className="text-sm font-mono tabular-nums">{wd.dayNum}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wd.events.length > 0 ? (wd.isSelected ? 'bg-paper' : 'bg-accent') : 'bg-transparent'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Big date card: tap opens the date popup */}
          <button
            type="button"
            onClick={() => openDateSheet(selectedDateStr)}
            className={`w-full rounded-2xl p-4 text-left flex items-center justify-between gap-3 transition-colors ${
              selectedDateStr === todayStr ? 'bg-accent-100 hover:bg-accent-200' : 'bg-paper hover:bg-slate-100'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono text-ink tabular-nums">
                  {formatDateLabel(selectedDateStr, lang)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums ${dBadgeClass(
                    dateBadgeLabel(selectedDateStr, todayStr),
                    selectedDateStr < todayStr
                  )}`}
                >
                  {dateBadgeLabel(selectedDateStr, todayStr)}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                {selectedDayEvents.length > 0
                  ? tr(
                      lang,
                      `일정 ${selectedDayEvents.length}개 · 탭하여 입력/수정`,
                      `${selectedDayEvents.length} event(s) · tap to add or edit`,
                      `${selectedDayEvents.length} 个日程 · 点击添加/修改`
                    )
                  : tr(lang, '일정 없음 · 탭하여 추가', 'No events · tap to add', '无日程 · 点击添加')}
              </p>
            </div>
            <span className="w-9 h-9 shrink-0 rounded-full bg-accent text-paper flex items-center justify-center">
              <Plus className="w-4 h-4" strokeWidth={3} />
            </span>
          </button>
        </div>
      )}

      {/* PERIOD EVENT LIST (follows month / week / day view) */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-3.5 py-3 border-b border-divider flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="w-4 h-4 text-accent-700 shrink-0" strokeWidth={2.75} />
            <h2 className="text-[13px] font-bold text-ink truncate">{periodTitle}</h2>
            <span className="text-[11px] text-slate-600 font-mono tabular-nums shrink-0">
              {totalCountInPeriod}
            </span>
          </div>
          <button
            type="button"
            onClick={() => openDateSheet(selectedDateStr)}
            className="inline-flex items-center gap-1 h-[30px] px-3 rounded-full bg-accent text-paper text-[11px] font-bold hover:bg-accent-600 active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3 h-3" strokeWidth={3} />
            {tr(lang, '일정 추가', 'Add Event', '添加日程')}
          </button>
        </div>

        {viewMode !== 'day' && totalCountInPeriod > 0 && (
          <div className="px-3.5 pt-2.5 text-[11px] text-slate-600">
            {upcomingCountInPeriod > 0
              ? tr(
                  lang,
                  `이 기간 다가오는 일정 ${upcomingCountInPeriod}개`,
                  `${upcomingCountInPeriod} upcoming in this period`,
                  `本期间即将到来的日程 ${upcomingCountInPeriod} 个`
                )
              : tr(lang, '이 기간의 일정은 모두 지났어요.', 'All events in this period are past.', '本期间的日程均已过去。')}
          </div>
        )}

        {periodGroups.length === 0 ? (
          <div className="p-6 text-center">
            <CalendarIcon className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">
              {viewMode === 'month'
                ? tr(lang, '이번 달에 등록된 일정이 없습니다.', 'No events this month.', '本月暂无日程。')
                : viewMode === 'week'
                ? tr(lang, '이번 주에 등록된 일정이 없습니다.', 'No events this week.', '本周暂无日程。')
                : tr(lang, '이 날짜에 등록된 일정이 없습니다.', 'No events on this date.', '该日期暂无日程。')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {tr(
                lang,
                '달력에서 날짜를 탭하면 바로 일정을 입력할 수 있어요.',
                'Tap a date on the calendar to add an event right away.',
                '点击日历中的日期即可直接添加日程。'
              )}
            </p>
          </div>
        ) : (
          <div className="p-2.5 space-y-2">
            {periodGroups.map((group, gIdx) => {
              const isPast = group.dateStr < todayStr;
              const isToday = group.dateStr === todayStr;
              const badge = dateBadgeLabel(group.dateStr, todayStr);
              const isFirstUpcoming = gIdx === firstUpcomingIdx;
              return (
                <React.Fragment key={group.dateStr}>
                  {isFirstUpcoming && gIdx > 0 && viewMode !== 'day' && (
                    <div className="flex items-center gap-2 px-1 pt-1">
                      <span className="h-px flex-1 bg-accent-300" />
                      <span className="text-[10px] font-bold text-accent-800 whitespace-nowrap">
                        {tr(lang, '다가오는 일정', 'Coming up', '即将到来')}
                      </span>
                      <span className="h-px flex-1 bg-accent-300" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl overflow-hidden ${
                      isToday ? 'bg-accent-100 ring-1 ring-accent-300' : 'bg-paper'
                    } ${isPast ? 'opacity-55' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => openDateSheet(group.dateStr)}
                      className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-ink tabular-nums">
                          {formatDateLabel(group.dateStr, lang)}
                        </span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-accent text-paper rounded-full">
                            {tr(lang, '오늘', 'TODAY', '今天')}
                          </span>
                        )}
                        {isFirstUpcoming && !isToday && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-accent-200 text-accent-900 rounded-full whitespace-nowrap">
                            {tr(lang, '다음 일정', 'Next up', '下一个')}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums shrink-0 ${dBadgeClass(
                          badge,
                          isPast
                        )}`}
                      >
                        {badge}
                      </span>
                    </button>
                    <div className="divide-y divide-divider border-t border-divider">
                      {group.events.map((ev) => {
                        const meta = CATEGORY_META[ev.category];
                        const range = rangeLabel(ev);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openEditSheet(ev, group.dateStr)}
                            className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-100/60 transition-colors"
                          >
                            <span className={`w-1 self-stretch rounded-full shrink-0 ${meta.barBg}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                                >
                                  {categoryLabel(ev.category)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 tabular-nums">
                                  <Clock className="w-3 h-3" />
                                  {ev.time || tr(lang, '종일', 'All day', '全天')}
                                </span>
                                {range && (
                                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                                    ({range})
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-ink mt-0.5 truncate">
                                {translateSampleText(ev.title, lang)}
                              </p>
                              {ev.memo && (
                                <p className="text-[11px] text-slate-600 truncate">
                                  {translateSampleText(ev.memo, lang)}
                                </p>
                              )}
                            </div>
                            <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* DATE POPUP: day's events (edit/delete) + shared add/edit form */}
      {isSheetOpen && sheetDateStr && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end justify-center"
          onClick={closeSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={formatDateLabel(sheetDateStr, lang)}
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-[15px] font-bold text-ink tabular-nums truncate">
                  {formatDateLabel(sheetDateStr, lang)}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums shrink-0 ${dBadgeClass(
                    dateBadgeLabel(sheetDateStr, todayStr),
                    sheetDateStr < todayStr
                  )}`}
                >
                  {dateBadgeLabel(sheetDateStr, todayStr)}
                </span>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label={tr(lang, '닫기', 'Close', '关闭')}
                className="w-9 h-9 shrink-0 rounded-full border border-divider bg-surface flex items-center justify-center text-ink hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Day's events */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">
                {tr(lang, '이 날의 일정', 'Events on this day', '当日日程')}{' '}
                <span className="font-mono tabular-nums">{sheetEvents.length}</span>
              </p>
              {sheetEvents.length === 0 ? (
                <p className="text-xs text-slate-500 bg-surface rounded-xl px-3 py-3 text-center">
                  {tr(
                    lang,
                    '아직 일정이 없어요. 아래에서 바로 추가하세요.',
                    'No events yet. Add one below.',
                    '暂无日程，请在下方直接添加。'
                  )}
                </p>
              ) : (
                <div className="bg-surface rounded-xl divide-y divide-divider overflow-hidden">
                  {sheetEvents.map((ev) => {
                    const meta = CATEGORY_META[ev.category];
                    const range = rangeLabel(ev);
                    const isEditing = editingItem?.id === ev.id;
                    return (
                      <div
                        key={ev.id}
                        className={`px-3 py-2.5 flex items-start gap-2.5 ${isEditing ? 'bg-accent-100' : ''}`}
                      >
                        <span className={`w-1 self-stretch rounded-full shrink-0 ${meta.barBg}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                            >
                              {categoryLabel(ev.category)}
                            </span>
                            <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                              {ev.time || tr(lang, '종일', 'All day', '全天')}
                            </span>
                            {range && (
                              <span className="text-[10px] font-mono text-slate-500 tabular-nums">({range})</span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-ink mt-0.5 break-words">
                            {translateSampleText(ev.title, lang)}
                          </p>
                          {ev.memo && (
                            <p className="text-[11px] text-slate-600 leading-relaxed break-words">
                              {translateSampleText(ev.memo, lang)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => fillFormFromItem(ev)}
                            aria-label={tr(lang, '수정', 'Edit', '修改')}
                            title={tr(lang, '수정', 'Edit', '修改')}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                              isEditing
                                ? 'bg-accent text-paper border-transparent'
                                : 'border-divider text-ink hover:bg-slate-100'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(ev)}
                            aria-label={tr(lang, '삭제', 'Delete', '删除')}
                            title={tr(lang, '삭제', 'Delete', '删除')}
                            className="w-8 h-8 rounded-full border border-accent-300 bg-accent-100 text-accent-900 flex items-center justify-center hover:bg-accent-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shared add / edit form */}
            <form onSubmit={handleSaveSchedule} className="space-y-3 border-t border-divider pt-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[13px] font-bold text-ink">
                  {editingItem
                    ? tr(lang, '일정 수정', 'Edit Event', '修改日程')
                    : tr(lang, '새 일정 추가', 'Add New Event', '添加新日程')}
                </h4>
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => resetFormForDate(sheetDateStr)}
                    className="h-7 px-2.5 rounded-full border border-divider text-[11px] font-medium text-ink hover:bg-slate-100"
                  >
                    {tr(lang, '수정 취소', 'Cancel edit', '取消修改')}
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-600">
                  {tr(lang, '일정 구분 (필수)', 'Category (Required)', '日程分类（必选）')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const selected = formCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormCategory(cat)}
                        className={`h-[34px] px-3 rounded-full border text-xs font-semibold flex items-center justify-center transition-all ${
                          selected
                            ? `${meta.barBg} text-paper border-transparent`
                            : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${selected ? 'bg-paper' : meta.dotBg}`} />
                          {categoryLabel(cat)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  {tr(
                    lang,
                    `예시: ${CATEGORY_META[formCategory].exampleKo}`,
                    `Examples: ${CATEGORY_META[formCategory].exampleEn}`,
                    `示例：${CATEGORY_META[formCategory].exampleZh}`
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  {tr(lang, '일정 제목', 'Event Title', '日程标题')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={tr(
                    lang,
                    '예: 중간고사, 학원 레벨테스트, 치과 진료',
                    'e.g. Midterm Exam, Level Test, Dentist',
                    '如：期中考试、水平测试、牙科就诊'
                  )}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full h-[42px] px-3.5 rounded-full border border-divider bg-surface text-sm font-medium text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1 min-w-0">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '시작 날짜', 'Start Date', '开始日期')}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-[42px] px-3 rounded-full border border-divider bg-surface text-xs font-mono text-ink min-w-0 focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    {tr(lang, '종료 날짜 (선택)', 'End Date (Optional)', '结束日期（可选）')}
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    min={formDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full h-[42px] px-3 rounded-full border border-divider bg-surface text-xs font-mono text-ink min-w-0 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  {tr(lang, '시간 (선택)', 'Time (Optional)', '时间（可选）')}
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full h-[42px] px-3 rounded-full border border-divider bg-surface text-[13px] font-mono text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  {tr(lang, '메모 (선택)', 'Memo (Optional)', '备注（可选）')}
                </label>
                <textarea
                  rows={3}
                  placeholder={tr(
                    lang,
                    '준비물, 시험 범위, 장소 등을 적어두세요.',
                    'Write exam scope, items to bring, or location.',
                    '记录考试范围、携带物品或地点等。'
                  )}
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-divider bg-surface text-[13px] leading-relaxed text-ink resize-none focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSchedule(editingItem)}
                    className="h-[46px] px-[18px] rounded-full bg-accent-100 text-accent-900 border border-accent-300 text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-accent-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    {tr(lang, '삭제', 'Delete', '删除')}
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 h-[46px] rounded-full bg-accent text-paper text-sm font-bold hover:bg-accent-600 active:scale-98 transition-all"
                >
                  {editingItem
                    ? tr(lang, '변경사항 저장', 'Save Changes', '保存修改')
                    : tr(lang, '일정 추가하기', 'Add Event', '添加日程')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
