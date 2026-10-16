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
  CalendarClock,
  ChevronDown,
  Check,
  GraduationCap,
  Building2,
  Sparkles,
  type LucideIcon,
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
    /** Category icon — redundant encoding so categories never rely on colour alone. */
    Icon: LucideIcon;
    /** Tinted tag: light ramp fill + dark ramp text (AA ≥ 9:1). */
    badgeBg: string;
    badgeText: string;
    /** Solid fill for text-bearing chips / selected pills (paper text ≥ 5:1). */
    solidBg: string;
    /** Left colour bars, dots & swatches (no text on top). */
    barBg: string;
    dotBg: string;
    /** Ring used on solid chips when they sit on a coloured (selected) cell. */
    ring: string;
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
    Icon: GraduationCap,
    badgeBg: 'bg-sage-100',
    badgeText: 'text-sage-800',
    solidBg: 'bg-sage-700',
    barBg: 'bg-sage',
    dotBg: 'bg-sage',
    ring: 'ring-sage-200',
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
    Icon: Building2,
    badgeBg: 'bg-accent-100',
    badgeText: 'text-accent-800',
    solidBg: 'bg-accent-700',
    barBg: 'bg-accent',
    dotBg: 'bg-accent',
    ring: 'ring-accent-200',
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
    Icon: Sparkles,
    badgeBg: 'bg-other-100',
    badgeText: 'text-other-800',
    solidBg: 'bg-other-600',
    barBg: 'bg-other',
    dotBg: 'bg-other',
    ring: 'ring-other-200',
    exampleKo: '병원 진료, 가족 행사, 동아리 모임',
    exampleEn: 'Clinic visit, family event, club gathering',
    exampleZh: '医院就诊、家庭聚会、社团活动',
  },
};

const CATEGORIES: ScheduleCategory[] = ['school', 'academy', 'other'];

/** Tinted category tag: icon + short label (colour + icon + text = triple encoding). */
const CategoryTag: React.FC<{ cat: ScheduleCategory; label: string; solid?: boolean }> = ({
  cat,
  label,
  solid = false,
}) => {
  const meta = CATEGORY_META[cat];
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
        solid ? `${meta.solidBg} text-paper` : `${meta.badgeBg} ${meta.badgeText}`
      }`}
    >
      <Icon className="w-3 h-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
};
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

  const [showPast, setShowPast] = useState<boolean>(false);

  const calendarWeekHeader = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    translateDay(['일', '월', '화', '수', '목', '금', '토'][i], lang).replace('周', '')
  );

  /** Sun = terracotta, Sat = dusty blue (Korean calendar convention). */
  const weekdayTint = (dow: number) =>
    dow === 0 ? 'text-accent-700' : dow === 6 ? 'text-other-700' : '';

  const shortWeekday = (dateStr: string) =>
    translateDay(getDayOfWeekKor(parseDateKey(dateStr)), lang).replace('周', '');

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

  /** D-chip colours (all AA on paper text). */
  const dBadgeClass = (label: string, isPast: boolean) =>
    label === 'D-Day'
      ? 'bg-accent-700 text-paper'
      : isPast
      ? 'bg-slate-200 text-slate-700'
      : 'bg-ink text-paper';

  const todayLabel = tr(lang, '오늘', 'Today', '今天');
  const allDayLabel = tr(lang, '종일', 'All day', '全天');

  const selectedDayEvents = eventsOn(selectedDateStr);

  // Per-category counts in the current period (unfiltered) — shown on the filter pills / legend
  const periodCategoryCounts = useMemo(() => {
    const counts: Record<ScheduleCategory, number> = { school: 0, academy: 0, other: 0 };
    schedules.forEach((ev) => {
      if (periodDates.some((d) => isDateWithinSchedule(d, ev))) counts[ev.category] += 1;
    });
    return counts;
  }, [schedules, periodDates]);
  const periodAllCount = periodCategoryCounts.school + periodCategoryCounts.academy + periodCategoryCounts.other;

  const pastGroups = periodGroups.filter((g) => g.dateStr < todayStr);
  const futureGroups = periodGroups.filter((g) => g.dateStr >= todayStr);
  const pastEventCount = pastGroups.reduce((n, g) => n + g.events.length, 0);

  const monthWeeks = useMemo(() => {
    const rows: (typeof monthCalendarCells)[] = [];
    for (let i = 0; i < monthCalendarCells.length; i += 7) rows.push(monthCalendarCells.slice(i, i + 7));
    return rows;
  }, [monthCalendarCells]);

  const featured = upcomingEvents[0];
  const restUpcoming = upcomingEvents.slice(1);
  const todayUpcomingCount = upcomingEvents.filter((ev) => isDateWithinSchedule(todayStr, ev)).length;

  /** Short D-label for an upcoming event: today → '오늘', ongoing → '진행중', else D-n. */
  const upcomingChip = (ev: ScheduleItem) => {
    if (isDateWithinSchedule(todayStr, ev)) {
      return ev.date === todayStr ? todayLabel : tr(lang, '진행중', 'Ongoing', '进行中');
    }
    return calculateDDayLabel(ev.date, todayStr) || '';
  };

  const onKeyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const navBtn =
    'w-9 h-9 shrink-0 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 active:scale-95 transition-transform';

  // ─── Small render helpers ──────────────────────────────────────────────

  /** Date block: weekday + big Caprasimo day number. */
  const renderDateBlock = (dateStr: string, size: 'sm' | 'md' = 'sm', strong = false) => {
    const d = parseDateKey(dateStr);
    const tint = strong ? '' : weekdayTint(d.getDay());
    return (
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 ${
          size === 'md' ? 'w-[52px] py-2' : 'w-10 h-10'
        } ${strong ? 'bg-accent-700 text-paper' : 'bg-surface text-ink'}`}
      >
        <span
          className={`text-[11px] font-bold leading-none ${strong ? 'text-paper/90' : tint || 'text-slate-600'}`}
        >
          {shortWeekday(dateStr)}
        </span>
        <span className={`font-mono leading-none tabular-nums ${size === 'md' ? 'text-[22px]' : 'text-[17px]'}`}>
          {d.getDate()}
        </span>
      </span>
    );
  };

  /** One event row used by the period list. */
  const renderEventRow = (ev: ScheduleItem, onDateStr: string, onTinted: boolean) => {
    const meta = CATEGORY_META[ev.category];
    const range = rangeLabel(ev);
    return (
      <button
        key={ev.id}
        type="button"
        onClick={() => openEditSheet(ev, onDateStr)}
        className={`w-full p-2 pr-2.5 rounded-xl text-left flex items-stretch gap-2.5 transition-colors ${
          onTinted ? 'bg-paper hover:bg-paper/70' : 'bg-surface/60 hover:bg-surface'
        }`}
      >
        <span aria-hidden="true" className={`w-1 rounded-full shrink-0 ${meta.barBg}`} />
        <span className="w-[46px] shrink-0 flex flex-col items-center justify-center text-center">
          {ev.time ? (
            <span className="font-mono text-[14px] leading-none text-ink tabular-nums">{ev.time}</span>
          ) : (
            <span className="text-[11px] font-bold text-slate-600 leading-tight">{allDayLabel}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 flex-wrap">
            <CategoryTag cat={ev.category} label={categoryLabel(ev.category)} />
            {range && <span className="text-[11px] font-mono text-slate-600 tabular-nums">{range}</span>}
          </span>
          <span className="block text-[14px] font-bold text-ink mt-1 truncate">
            {translateSampleText(ev.title, lang)}
          </span>
          {ev.memo && (
            <span className="block text-[12px] text-slate-600 truncate">{translateSampleText(ev.memo, lang)}</span>
          )}
        </span>
        <Edit3 className="w-3.5 h-3.5 text-slate-500 shrink-0 self-center" aria-hidden="true" />
      </button>
    );
  };

  const renderGroup = (group: { dateStr: string; events: ScheduleItem[] }) => {
    const isPast = group.dateStr < todayStr;
    const isToday = group.dateStr === todayStr;
    const badge = dateBadgeLabel(group.dateStr, todayStr);
    const isNext = futureGroups[0]?.dateStr === group.dateStr && !isToday;
    return (
      <div
        key={group.dateStr}
        className={`rounded-2xl ${
          isToday ? 'bg-accent-100 ring-[1.5px] ring-accent' : 'bg-paper'
        } ${isPast ? 'opacity-60' : ''}`}
      >
        <button
          type="button"
          onClick={() => openDateSheet(group.dateStr)}
          className="w-full flex items-center gap-2.5 px-2.5 pt-2.5 pb-2 text-left"
          aria-label={`${formatDateLabel(group.dateStr, lang)} · ${badge}`}
        >
          {renderDateBlock(group.dateStr, 'sm', isToday)}
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-ink truncate">
              {formatDateLabel(group.dateStr, lang)}
            </span>
            <span className="flex items-center gap-1 mt-0.5">
              {isToday && (
                <span className="px-2 py-px text-[11px] font-bold bg-accent-700 text-paper rounded-full">
                  {todayLabel}
                </span>
              )}
              {isNext && (
                <span className="px-2 py-px text-[11px] font-bold bg-accent-200 text-accent-900 rounded-full whitespace-nowrap">
                  {tr(lang, '다음 일정', 'Next up', '下一个')}
                </span>
              )}
              <span className="text-[11px] text-slate-600">
                {tr(lang, `${group.events.length}개`, `${group.events.length} event(s)`, `${group.events.length}个`)}
              </span>
            </span>
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[12px] font-mono leading-none tabular-nums shrink-0 ${dBadgeClass(
              badge,
              isPast
            )}`}
          >
            {badge}
          </span>
        </button>
        <div className="px-2 pb-2 space-y-1.5">
          {group.events.map((ev) => renderEventRow(ev, group.dateStr, isToday))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. UPCOMING / D-DAY HERO */}
      <section className="bg-surface rounded-2xl shadow-xs p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarClock strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
            <h3 className="text-[13px] font-bold text-ink truncate">
              {tr(lang, '다가오는 주요 일정 (D-Day)', 'Upcoming Events (D-Day)', '即将到来的重要日程 (D-Day)')}
            </h3>
          </div>
          {todayUpcomingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-accent-700 text-paper text-[11px] font-bold shrink-0 whitespace-nowrap">
              {tr(
                lang,
                `오늘 ${todayUpcomingCount}개`,
                `${todayUpcomingCount} today`,
                `今天 ${todayUpcomingCount} 个`
              )}
            </span>
          )}
        </div>

        {!featured ? (
          <button
            type="button"
            onClick={() => openDateSheet(todayStr, true)}
            className="w-full rounded-2xl bg-paper p-4 flex items-center gap-3 text-left hover:bg-paper/70"
          >
            <span className="w-11 h-11 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-ink">
                {tr(lang, '다가오는 일정이 없어요', 'No upcoming events', '暂无即将到来的日程')}
              </span>
              <span className="block text-[12px] text-slate-600">
                {tr(lang, '탭하여 오늘 일정을 추가해 보세요.', 'Tap to add one for today.', '点击为今天添加日程。')}
              </span>
            </span>
          </button>
        ) : (
          (() => {
            const ev = featured;
            const meta = CATEGORY_META[ev.category];
            const isTodayEvent = isDateWithinSchedule(todayStr, ev);
            const isOngoing = isTodayEvent && ev.date !== todayStr;
            const dLabel = calculateDDayLabel(ev.date, todayStr) || '';
            const range = rangeLabel(ev);
            const bigSize = dLabel.length <= 3 ? 'text-[30px]' : dLabel.length <= 4 ? 'text-[25px]' : 'text-[21px]';
            return (
              <button
                type="button"
                onClick={() => openEditSheet(ev, isTodayEvent ? todayStr : undefined)}
                className={`w-full rounded-2xl overflow-hidden flex items-stretch text-left transition-shadow ${
                  isTodayEvent ? 'bg-accent-100 ring-2 ring-accent shadow-sm' : 'bg-paper hover:shadow-sm'
                }`}
              >
                <span
                  className={`w-[88px] shrink-0 ${meta.solidBg} text-paper flex flex-col items-center justify-center gap-1.5 py-3 px-1`}
                >
                  <meta.Icon className="w-4 h-4 opacity-90" strokeWidth={2.5} aria-hidden="true" />
                  {isTodayEvent ? (
                    <>
                      <span className="text-[20px] font-extrabold leading-none text-center">
                        {isOngoing ? tr(lang, '진행중', 'Ongoing', '进行中') : todayLabel}
                      </span>
                      {!isOngoing && <span className="font-mono text-[12px] leading-none opacity-90">D-Day</span>}
                    </>
                  ) : (
                    <span className={`font-mono leading-none tabular-nums ${bigSize}`}>{dLabel}</span>
                  )}
                </span>
                <span className="flex-1 min-w-0 p-3 space-y-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {isTodayEvent && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-accent-700 text-paper">
                        {tr(lang, '오늘의 일정', "Today's event", '今日日程')}
                      </span>
                    )}
                    <CategoryTag cat={ev.category} label={categoryLabel(ev.category)} />
                  </span>
                  <span className="block text-[18px] font-bold text-ink leading-snug line-clamp-2 break-words">
                    {translateSampleText(ev.title, lang)}
                  </span>
                  <span className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[12px] text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {range ? (
                        <span className="font-mono tabular-nums">{range}</span>
                      ) : (
                        formatDateLabel(ev.date, lang)
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {ev.time ? <span className="font-mono tabular-nums">{ev.time}</span> : allDayLabel}
                    </span>
                  </span>
                  {ev.memo && (
                    <span className="block text-[12px] text-slate-600 truncate">
                      {translateSampleText(ev.memo, lang)}
                    </span>
                  )}
                </span>
              </button>
            );
          })()
        )}

        {restUpcoming.length > 0 && (
          <div
            className="-mx-3.5 px-3.5 flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-3.5 pb-0.5"
            aria-label={tr(lang, '이어지는 일정', 'More upcoming', '更多日程')}
          >
            {restUpcoming.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              const isTodayEvent = isDateWithinSchedule(todayStr, ev);
              const chip = upcomingChip(ev);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => openEditSheet(ev, isTodayEvent ? todayStr : undefined)}
                  className={`snap-start shrink-0 w-[148px] rounded-xl p-2.5 text-left flex flex-col gap-1.5 transition-colors ${
                    isTodayEvent ? 'bg-accent-100 ring-2 ring-accent' : 'bg-paper hover:bg-paper/70'
                  }`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span
                      aria-hidden="true"
                      className={`w-6 h-6 rounded-full ${meta.solidBg} text-paper flex items-center justify-center`}
                    >
                      <meta.Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[12px] leading-none tabular-nums ${
                        isTodayEvent ? 'bg-accent-700 text-paper font-bold' : 'bg-ink text-paper font-mono'
                      }`}
                    >
                      {chip}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold text-ink leading-snug line-clamp-2 break-words min-h-[34px]">
                    {translateSampleText(ev.title, lang)}
                  </span>
                  <span className="flex items-center justify-between gap-1 text-[11px] text-slate-700">
                    <span className={`font-semibold ${meta.badgeText}`}>{categoryLabel(ev.category)}</span>
                    <span className="font-mono tabular-nums">
                      {isTodayEvent && ev.time ? ev.time : formatShortDate(ev.date, lang)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. CONTROLS: view switch, navigation, period title, category filter (= legend) */}
      <section className="bg-surface rounded-2xl shadow-xs p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label={tr(lang, '보기 방식', 'View', '视图')}
            className="inline-flex p-1 gap-0.5 rounded-full bg-paper"
          >
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
                role="tab"
                aria-selected={viewMode === tab.id}
                onClick={() => {
                  setViewMode(tab.id);
                  setCursorDate(parseDateKey(selectedDateStr));
                }}
                className={`h-[30px] min-w-[44px] px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap ${
                  viewMode === tab.id ? 'bg-ink text-paper shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGoToday}
            className="h-[34px] px-3.5 shrink-0 rounded-full bg-accent-700 text-paper text-[12px] font-bold hover:bg-accent-800 active:scale-95 transition-all whitespace-nowrap"
          >
            {todayLabel}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleNavigate(-1)}
            className={navBtn}
            aria-label={tr(lang, '이전', 'Previous', '上一个')}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2.75} />
          </button>
          <div className="flex-1 min-w-0 text-center" aria-live="polite">
            <div className="font-mono text-[22px] leading-tight text-ink tabular-nums truncate">{navLabel}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
              {tr(
                lang,
                `일정 ${totalCountInPeriod}개 · 다가오는 ${upcomingCountInPeriod}개`,
                `${totalCountInPeriod} events · ${upcomingCountInPeriod} upcoming`,
                `日程 ${totalCountInPeriod} 个 · 即将 ${upcomingCountInPeriod} 个`
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate(1)}
            className={navBtn}
            aria-label={tr(lang, '다음', 'Next', '下一个')}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2.75} />
          </button>
        </div>

        {/* Category filter pills — also serve as the colour/icon legend */}
        <div
          className="flex items-center gap-1.5 flex-wrap"
          role="group"
          aria-label={tr(lang, '일정 구분 필터 및 범례', 'Category filter & legend', '日程分类筛选与图例')}
        >
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            aria-pressed={categoryFilter === 'all'}
            className={`inline-flex items-center gap-1.5 h-[32px] pl-3 pr-2 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap ${
              categoryFilter === 'all' ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-slate-100'
            }`}
          >
            {tr(lang, '전체', 'All', '全部')}
            <span
              className={`min-w-[20px] px-1 h-[20px] rounded-full text-[11px] font-mono leading-[20px] text-center tabular-nums ${
                categoryFilter === 'all' ? 'bg-paper/20' : 'bg-surface'
              }`}
            >
              {periodAllCount}
            </span>
          </button>
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(isActive ? 'all' : cat)}
                aria-pressed={isActive}
                title={tr(lang, meta.ko, meta.en, meta.zh)}
                className={`inline-flex items-center gap-1.5 h-[32px] pl-1 pr-2 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap ${
                  isActive ? `${meta.solidBg} text-paper` : `${meta.badgeBg} ${meta.badgeText} hover:opacity-85`
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-paper/20' : `${meta.solidBg} text-paper`
                  }`}
                >
                  <meta.Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                </span>
                {categoryLabel(cat)}
                <span className="text-[11px] font-mono tabular-nums opacity-90">{periodCategoryCounts[cat]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3a. MONTH VIEW */}
      {viewMode === 'month' && (
        <section className="bg-surface rounded-2xl shadow-xs p-2">
          <div className="grid grid-cols-7 gap-0.5 text-center pb-1">
            {calendarWeekHeader.map((d, idx) => (
              <div key={idx} className={`py-1 text-[11px] font-bold ${weekdayTint(idx) || 'text-slate-600'}`}>
                {d}
              </div>
            ))}
          </div>

          <div className="space-y-0">
            {monthWeeks.map((week, wIdx) => (
              <div
                key={wIdx}
                className={`grid grid-cols-7 gap-0.5 py-0.5 ${wIdx > 0 ? 'border-t border-divider' : ''}`}
              >
                {week.map((cell, dow) => {
                  const tint = weekdayTint(dow);
                  const extra = cell.events.length - 2;
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => openDateSheet(cell.dateStr, true)}
                      aria-pressed={cell.isSelected}
                      aria-label={`${formatDateLabel(cell.dateStr, lang)}${
                        cell.isToday ? ` · ${todayLabel}` : ''
                      }${
                        cell.events.length
                          ? tr(
                              lang,
                              ` · 일정 ${cell.events.length}개`,
                              ` · ${cell.events.length} event(s)`,
                              ` · ${cell.events.length} 个日程`
                            )
                          : ''
                      }`}
                      className={`min-w-0 min-h-[68px] p-[3px] rounded-xl flex flex-col items-stretch text-left transition-colors ${
                        cell.isSelected
                          ? 'bg-accent-700 shadow-xs'
                          : cell.isToday
                          ? 'bg-accent-100 ring-[1.5px] ring-inset ring-accent'
                          : 'hover:bg-paper/70'
                      } ${!cell.isCurrentMonth && !cell.isSelected ? 'opacity-45' : ''}`}
                    >
                      <span className="flex items-center justify-between px-0.5">
                        <span
                          className={`font-mono text-[13px] leading-[20px] tabular-nums ${
                            cell.isSelected
                              ? 'text-paper'
                              : cell.isToday
                              ? 'text-accent-800'
                              : tint || 'text-ink'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-col gap-[2px] min-w-0">
                        {cell.events.slice(0, 2).map((ev) => {
                          const meta = CATEGORY_META[ev.category];
                          return (
                            <span
                              key={ev.id}
                              title={`${categoryLabel(ev.category)} · ${translateSampleText(ev.title, lang)}`}
                              className={`min-w-0 flex items-center gap-[2px] px-[3px] h-[16px] rounded-md text-[11px] leading-none font-bold text-paper ${
                                meta.solidBg
                              } ${cell.isSelected ? `ring-1 ${meta.ring}` : ''}`}
                            >
                              <meta.Icon className="w-2.5 h-2.5 shrink-0" strokeWidth={2.75} aria-hidden="true" />
                              <span className="truncate min-w-0">{translateSampleText(ev.title, lang)}</span>
                            </span>
                          );
                        })}
                        {extra > 0 && (
                          <span
                            className={`self-start px-1.5 h-[16px] rounded-full text-[11px] leading-[16px] font-mono tabular-nums ${
                              cell.isSelected ? 'bg-paper text-accent-800' : 'bg-paper text-slate-700'
                            }`}
                          >
                            +{extra}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3b. WEEK VIEW */}
      {viewMode === 'week' && (
        <section className="bg-surface rounded-2xl shadow-xs p-2 space-y-1">
          {weekDaysList.map((wd) => (
            <div
              key={wd.dateStr}
              role="button"
              tabIndex={0}
              aria-label={`${formatDateLabel(wd.dateStr, lang)}${wd.isToday ? ` · ${todayLabel}` : ''}`}
              onClick={() => openDateSheet(wd.dateStr, true)}
              onKeyDown={onKeyActivate(() => openDateSheet(wd.dateStr, true))}
              className={`p-1.5 rounded-xl flex items-start gap-2.5 cursor-pointer transition-colors ${
                wd.isSelected ? 'bg-accent-100 ring-1 ring-accent-300' : 'hover:bg-paper/60'
              }`}
            >
              {renderDateBlock(wd.dateStr, 'md', wd.isToday)}
              <div className="flex-1 min-w-0 space-y-1 py-0.5">
                {wd.events.length === 0 ? (
                  <span className="h-[34px] px-3 rounded-full border border-dashed border-divider text-[12px] text-slate-600 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.75} aria-hidden="true" />
                    {tr(lang, '일정 없음 · 탭하여 추가', 'No events · tap to add', '无日程 · 点击添加')}
                  </span>
                ) : (
                  wd.events.map((ev) => {
                    const meta = CATEGORY_META[ev.category];
                    const dDay = calculateDDayLabel(ev.date, todayStr);
                    return (
                      <div
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSheet(ev, wd.dateStr);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          onKeyActivate(() => openEditSheet(ev, wd.dateStr))(e);
                        }}
                        title={`${categoryLabel(ev.category)} · ${translateSampleText(ev.title, lang)}`}
                        className="h-[34px] pl-1 pr-2 rounded-full bg-paper flex items-center gap-1.5 hover:ring-1 hover:ring-divider"
                      >
                        <span
                          aria-hidden="true"
                          className={`w-[26px] h-[26px] rounded-full ${meta.solidBg} text-paper flex items-center justify-center shrink-0`}
                        >
                          <meta.Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="sr-only">{categoryLabel(ev.category)}</span>
                        {ev.time && (
                          <span className="font-mono text-[12px] text-slate-700 tabular-nums shrink-0">{ev.time}</span>
                        )}
                        <span className="text-[13px] font-bold text-ink truncate min-w-0 flex-1">
                          {translateSampleText(ev.title, lang)}
                        </span>
                        {dDay && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono leading-none tabular-nums shrink-0 ${dBadgeClass(
                              dDay,
                              false
                            )}`}
                          >
                            {dDay}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 3c. DAY VIEW: big date hero + week strip */}
      {viewMode === 'day' && (
        <section className="bg-surface rounded-2xl shadow-xs p-3.5 space-y-3">
          {(() => {
            const d = parseDateKey(selectedDateStr);
            const badge = dateBadgeLabel(selectedDateStr, todayStr);
            const isSelToday = selectedDateStr === todayStr;
            return (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`font-mono text-[48px] leading-none tabular-nums ${isSelToday ? 'text-accent-700' : 'text-ink'}`}>
                    {d.getDate()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold text-ink truncate">
                        {tr(
                          lang,
                          `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
                          `${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
                          `${d.getFullYear()}年${d.getMonth() + 1}月`
                        )}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono leading-none tabular-nums shrink-0 ${dBadgeClass(
                          badge,
                          selectedDateStr < todayStr
                        )}`}
                      >
                        {badge}
                      </span>
                    </div>
                    <div className={`text-[12px] font-semibold ${weekdayTint(d.getDay()) || 'text-slate-600'}`}>
                      {translateDay(getDayOfWeekKor(d), lang)}
                      <span className="text-slate-600">
                        {' · '}
                        {selectedDayEvents.length > 0
                          ? tr(
                              lang,
                              `일정 ${selectedDayEvents.length}개`,
                              `${selectedDayEvents.length} event(s)`,
                              `${selectedDayEvents.length} 个日程`
                            )
                          : tr(lang, '일정 없음', 'No events', '无日程')}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openDateSheet(selectedDateStr)}
                  aria-label={tr(lang, '이 날짜에 일정 추가', 'Add event on this date', '为该日期添加日程')}
                  className="w-11 h-11 shrink-0 rounded-full bg-accent-700 text-paper flex items-center justify-center hover:bg-accent-800 active:scale-95 transition-all shadow-xs"
                >
                  <Plus className="w-5 h-5" strokeWidth={3} />
                </button>
              </div>
            );
          })()}

          <div className="grid grid-cols-7 gap-1" role="group" aria-label={tr(lang, '이번 주', 'This week', '本周')}>
            {weekDaysList.map((wd) => {
              const tone = wd.isSelected
                ? 'bg-accent-700 text-paper'
                : wd.isToday
                ? 'bg-paper ring-[1.5px] ring-inset ring-accent text-accent-800'
                : 'bg-paper/70 text-ink hover:bg-paper';
              return (
                <button
                  key={wd.dateStr}
                  type="button"
                  aria-pressed={wd.isSelected}
                  aria-label={formatDateLabel(wd.dateStr, lang)}
                  onClick={() => {
                    setSelectedDateStr(wd.dateStr);
                    setCursorDate(wd.dateObj);
                  }}
                  className={`min-w-0 py-1.5 rounded-2xl flex flex-col items-center gap-0.5 transition-colors ${tone}`}
                >
                  <span
                    className={`text-[11px] font-semibold leading-tight ${
                      wd.isSelected
                        ? 'text-paper/90'
                        : wd.isToday
                        ? 'text-accent-800'
                        : weekdayTint(wd.dateObj.getDay()) || 'text-slate-600'
                    }`}
                  >
                    {translateDay(wd.dayLabel, lang).replace('周', '')}
                  </span>
                  <span className="font-mono text-[16px] leading-none tabular-nums">{wd.dayNum}</span>
                  <span className="h-2 flex items-center gap-[3px]" aria-hidden="true">
                    {CATEGORIES.filter((cat) => wd.events.some((ev) => ev.category === cat)).map((cat) => (
                      <span
                        key={cat}
                        className={`w-1.5 h-1.5 rounded-full ${CATEGORY_META[cat].dotBg} ${
                          wd.isSelected ? 'ring-1 ring-paper' : ''
                        }`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. PERIOD EVENT LIST (follows month / week / day view) */}
      <section className="bg-surface rounded-2xl shadow-xs p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <ListChecks className="w-4 h-4 text-accent-700 shrink-0" strokeWidth={2.75} />
            <h2 className="text-[13px] font-bold text-ink truncate">{periodTitle}</h2>
            <span className="px-2 py-px rounded-full bg-paper text-[11px] font-mono text-slate-700 tabular-nums shrink-0">
              {totalCountInPeriod}
            </span>
          </div>
          <button
            type="button"
            onClick={() => openDateSheet(selectedDateStr)}
            className="inline-flex items-center gap-1 h-[32px] px-3 rounded-full bg-accent-700 text-paper text-[12px] font-bold hover:bg-accent-800 active:scale-95 transition-all whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
            {tr(lang, '일정 추가', 'Add Event', '添加日程')}
          </button>
        </div>

        {viewMode !== 'day' && totalCountInPeriod > 0 && (
          <p className="px-0.5 text-[12px] text-slate-600">
            {upcomingCountInPeriod > 0
              ? tr(
                  lang,
                  `이 기간 다가오는 일정 ${upcomingCountInPeriod}개`,
                  `${upcomingCountInPeriod} upcoming in this period`,
                  `本期间即将到来的日程 ${upcomingCountInPeriod} 个`
                )
              : tr(lang, '이 기간의 일정은 모두 지났어요.', 'All events in this period are past.', '本期间的日程均已过去。')}
          </p>
        )}

        {periodGroups.length === 0 ? (
          <div className="py-7 px-4 text-center bg-paper rounded-2xl">
            <span className="w-11 h-11 rounded-full bg-surface text-slate-600 flex items-center justify-center mx-auto mb-2">
              <CalendarIcon className="w-5 h-5" strokeWidth={2.25} />
            </span>
            <p className="text-[13px] font-bold text-ink">
              {viewMode === 'month'
                ? tr(lang, '이번 달에 등록된 일정이 없습니다.', 'No events this month.', '本月暂无日程。')
                : viewMode === 'week'
                ? tr(lang, '이번 주에 등록된 일정이 없습니다.', 'No events this week.', '本周暂无日程。')
                : tr(lang, '이 날짜에 등록된 일정이 없습니다.', 'No events on this date.', '该日期暂无日程。')}
            </p>
            <p className="text-[12px] text-slate-600 mt-1">
              {tr(
                lang,
                '달력에서 날짜를 탭하면 바로 일정을 입력할 수 있어요.',
                'Tap a date on the calendar to add an event right away.',
                '点击日历中的日期即可直接添加日程。'
              )}
            </p>
          </div>
        ) : viewMode === 'day' ? (
          /* Day: timeline with a time column */
          <ol className="bg-paper rounded-2xl p-3 pl-2">
            {selectedDayEvents.map((ev, idx) => {
              const meta = CATEGORY_META[ev.category];
              const range = rangeLabel(ev);
              const isLast = idx === selectedDayEvents.length - 1;
              return (
                <li key={ev.id} className="flex items-stretch gap-2">
                  <span className="w-[48px] shrink-0 text-right pt-2.5">
                    {ev.time ? (
                      <span className="font-mono text-[15px] leading-none text-ink tabular-nums">{ev.time}</span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-600">{allDayLabel}</span>
                    )}
                  </span>
                  <span className="relative w-3 shrink-0 flex justify-center" aria-hidden="true">
                    {!isLast && <span className="absolute top-4 bottom-0 w-px bg-divider" />}
                    <span className={`relative mt-2.5 w-3 h-3 rounded-full ${meta.dotBg} ring-[3px] ring-paper`} />
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditSheet(ev, selectedDateStr)}
                    className={`flex-1 min-w-0 text-left rounded-xl bg-surface/70 hover:bg-surface p-2.5 ${
                      isLast ? '' : 'mb-2'
                    } flex items-start gap-2`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <CategoryTag cat={ev.category} label={categoryLabel(ev.category)} />
                        {range && <span className="text-[11px] font-mono text-slate-600 tabular-nums">{range}</span>}
                      </span>
                      <span className="block text-[15px] font-bold text-ink mt-1 break-words">
                        {translateSampleText(ev.title, lang)}
                      </span>
                      {ev.memo && (
                        <span className="block text-[12px] text-slate-600 leading-relaxed line-clamp-2 break-words">
                          {translateSampleText(ev.memo, lang)}
                        </span>
                      )}
                    </span>
                    <Edit3 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="space-y-2">
            {pastGroups.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPast((v) => !v)}
                  aria-expanded={showPast}
                  className="w-full h-[36px] px-3 rounded-full bg-paper/60 hover:bg-paper flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700"
                >
                  <span>
                    {tr(
                      lang,
                      `지난 일정 ${pastEventCount}개`,
                      `${pastEventCount} past event(s)`,
                      `已过去的日程 ${pastEventCount} 个`
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {showPast ? tr(lang, '접기', 'Hide', '收起') : tr(lang, '펼치기', 'Show', '展开')}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${showPast ? 'rotate-180' : ''}`}
                      strokeWidth={2.75}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {showPast && pastGroups.map(renderGroup)}
              </>
            )}

            {futureGroups.length > 0 && pastGroups.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-1">
                <span className="h-px flex-1 bg-accent-300" />
                <span className="text-[11px] font-bold text-accent-800 whitespace-nowrap">
                  {tr(lang, '다가오는 일정', 'Coming up', '即将到来')}
                </span>
                <span className="h-px flex-1 bg-accent-300" />
              </div>
            )}
            {futureGroups.map(renderGroup)}
          </div>
        )}

        <button
          type="button"
          onClick={() => openDateSheet(selectedDateStr)}
          className="w-full h-[44px] rounded-full border-[1.5px] border-dashed border-accent-400 text-accent-800 text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-accent-100 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={3} />
          {tr(
            lang,
            `${formatDateLabel(selectedDateStr, lang)}에 일정 추가`,
            `Add event on ${formatDateLabel(selectedDateStr, lang)}`,
            `在 ${formatDateLabel(selectedDateStr, lang)} 添加日程`
          )}
        </button>
      </section>

      {/* DATE POPUP: day's events (edit/delete) + shared add/edit form */}
      {isSheetOpen && sheetDateStr && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
          onClick={closeSheet}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={formatDateLabel(sheetDateStr, lang)}
            className="w-full max-w-md bg-paper rounded-t-[28px] p-5 pb-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {renderDateBlock(sheetDateStr, 'md', sheetDateStr === todayStr)}
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold text-ink truncate">{formatDateLabel(sheetDateStr, lang)}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono leading-none tabular-nums ${dBadgeClass(
                        dateBadgeLabel(sheetDateStr, todayStr),
                        sheetDateStr < todayStr
                      )}`}
                    >
                      {dateBadgeLabel(sheetDateStr, todayStr)}
                    </span>
                    <span className="text-[12px] text-slate-600">
                      {tr(
                        lang,
                        `일정 ${sheetEvents.length}개`,
                        `${sheetEvents.length} event(s)`,
                        `${sheetEvents.length} 个日程`
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                aria-label={tr(lang, '닫기', 'Close', '关闭')}
                className="w-9 h-9 shrink-0 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200"
              >
                <X className="w-4 h-4" strokeWidth={2.75} />
              </button>
            </div>

            {/* Day's events */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-accent-700" strokeWidth={2.75} />
                <h4 className="text-[13px] font-bold text-ink">
                  {tr(lang, '이 날의 일정', 'Events on this day', '当日日程')}
                </h4>
              </div>
              {sheetEvents.length === 0 ? (
                <p className="text-[12px] text-slate-600 bg-surface rounded-xl px-3 py-3.5 text-center">
                  {tr(
                    lang,
                    '아직 일정이 없어요. 아래에서 바로 추가하세요.',
                    'No events yet. Add one below.',
                    '暂无日程，请在下方直接添加。'
                  )}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sheetEvents.map((ev) => {
                    const meta = CATEGORY_META[ev.category];
                    const range = rangeLabel(ev);
                    const isEditing = editingItem?.id === ev.id;
                    return (
                      <div
                        key={ev.id}
                        className={`p-2.5 rounded-xl flex items-stretch gap-2.5 ${
                          isEditing ? 'bg-accent-100 ring-[1.5px] ring-accent' : 'bg-surface'
                        }`}
                      >
                        <span aria-hidden="true" className={`w-1 rounded-full shrink-0 ${meta.barBg}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <CategoryTag cat={ev.category} label={categoryLabel(ev.category)} />
                            <span className="text-[12px] font-mono text-slate-700 tabular-nums">
                              {ev.time || allDayLabel}
                            </span>
                            {range && (
                              <span className="text-[11px] font-mono text-slate-600 tabular-nums">{range}</span>
                            )}
                          </div>
                          <p className="text-[14px] font-bold text-ink mt-1 break-words">
                            {translateSampleText(ev.title, lang)}
                          </p>
                          {ev.memo && (
                            <p className="text-[12px] text-slate-600 leading-relaxed break-words">
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
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isEditing ? 'bg-accent-700 text-paper' : 'bg-paper text-ink hover:bg-slate-100'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(ev)}
                            aria-label={tr(lang, '삭제', 'Delete', '删除')}
                            title={tr(lang, '삭제', 'Delete', '删除')}
                            className="w-8 h-8 rounded-full bg-accent-100 text-accent-900 flex items-center justify-center hover:bg-accent-200"
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
            <form onSubmit={handleSaveSchedule} className="bg-surface rounded-2xl p-3.5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {editingItem ? (
                    <Edit3 className="w-4 h-4 text-accent-700" strokeWidth={2.75} />
                  ) : (
                    <Plus className="w-4 h-4 text-accent-700" strokeWidth={3} />
                  )}
                  <h4 className="text-[13px] font-bold text-ink">
                    {editingItem
                      ? tr(lang, '일정 수정', 'Edit Event', '修改日程')
                      : tr(lang, '새 일정 추가', 'Add New Event', '添加新日程')}
                  </h4>
                </div>
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => resetFormForDate(sheetDateStr)}
                    className="h-[28px] px-3 rounded-full border border-divider bg-paper text-[12px] font-semibold text-ink hover:bg-slate-100"
                  >
                    {tr(lang, '수정 취소', 'Cancel edit', '取消修改')}
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold text-slate-700 px-1">
                  {tr(lang, '일정 구분 (필수)', 'Category (Required)', '日程分类（必选）')}
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-full bg-paper" role="radiogroup">
                  {CATEGORIES.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const selected = formCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setFormCategory(cat)}
                        className={`h-[34px] px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center gap-1 min-w-0 transition-all ${
                          selected ? `${meta.solidBg} text-paper shadow-xs` : `${meta.badgeText} hover:bg-surface`
                        }`}
                      >
                        <meta.Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                        <span className="truncate">{categoryLabel(cat)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-600 px-1">
                  {tr(
                    lang,
                    `예시: ${CATEGORY_META[formCategory].exampleKo}`,
                    `Examples: ${CATEGORY_META[formCategory].exampleEn}`,
                    `示例：${CATEGORY_META[formCategory].exampleZh}`
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="sch-title" className="block text-[12px] font-semibold text-slate-700 px-1">
                  {tr(lang, '일정 제목', 'Event Title', '日程标题')}
                </label>
                <input
                  id="sch-title"
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
                  className="w-full h-[44px] px-4 rounded-full border border-divider bg-paper text-[14px] font-semibold text-ink placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 min-w-0">
                  <label htmlFor="sch-start" className="block text-[12px] font-semibold text-slate-700 px-1">
                    {tr(lang, '시작 날짜', 'Start Date', '开始日期')}
                  </label>
                  <input
                    id="sch-start"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full h-[44px] px-3 rounded-full border border-divider bg-paper text-[12px] font-mono text-ink min-w-0 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-200"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label htmlFor="sch-end" className="block text-[12px] font-semibold text-slate-700 px-1 truncate">
                    {tr(lang, '종료 날짜 (선택)', 'End Date (Optional)', '结束日期（可选）')}
                  </label>
                  <input
                    id="sch-end"
                    type="date"
                    value={formEndDate}
                    min={formDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full h-[44px] px-3 rounded-full border border-divider bg-paper text-[12px] font-mono text-ink min-w-0 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="sch-time" className="block text-[12px] font-semibold text-slate-700 px-1">
                  {tr(lang, '시간 (선택)', 'Time (Optional)', '时间（可选）')}
                </label>
                <input
                  id="sch-time"
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full h-[44px] px-4 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-200"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="sch-memo" className="block text-[12px] font-semibold text-slate-700 px-1">
                  {tr(lang, '메모 (선택)', 'Memo (Optional)', '备注（可选）')}
                </label>
                <textarea
                  id="sch-memo"
                  rows={3}
                  placeholder={tr(
                    lang,
                    '준비물, 시험 범위, 장소 등을 적어두세요.',
                    'Write exam scope, items to bring, or location.',
                    '记录考试范围、携带物品或地点等。'
                  )}
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-divider bg-paper text-[13px] leading-relaxed text-ink placeholder:text-slate-500 resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {editingItem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSchedule(editingItem)}
                    className="h-[48px] px-[18px] rounded-full bg-accent-100 text-accent-900 border border-accent-300 text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-accent-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    {tr(lang, '삭제', 'Delete', '删除')}
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 h-[48px] rounded-full bg-accent-700 text-paper text-[15px] font-bold hover:bg-accent-800 active:scale-98 transition-all shadow-xs inline-flex items-center justify-center gap-1.5"
                >
                  {editingItem ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <Plus className="w-4 h-4" strokeWidth={3} />
                  )}
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
