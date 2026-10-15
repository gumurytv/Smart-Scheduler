import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Calendar as CalendarIcon,
  X,
  Trash2,
  Edit3,
} from 'lucide-react';
import {
  ScheduleItem,
  ScheduleCategory,
  DAYS_OF_WEEK,
  AppLanguage,
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
}

const CATEGORY_META: Record<
  ScheduleCategory,
  {
    ko: string;
    en: string;
    zh: string;
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
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    barBg: 'bg-blue-500',
    dotBg: 'bg-blue-600',
    exampleKo: '중간고사, 수행평가, 방학식',
    exampleEn: 'Midterm exams, school assessment, ceremony',
    exampleZh: '期中考试、随堂测评、放假仪式',
  },
  academy: {
    ko: '학원 일정',
    en: 'Academy',
    zh: '补习班日程',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-800',
    barBg: 'bg-violet-500',
    dotBg: 'bg-violet-600',
    exampleKo: '학원 레벨테스트, 보강 수업, 단어 시험',
    exampleEn: 'Academy level test, makeup class, vocab quiz',
    exampleZh: '补习班水平测试、补课、单词测验',
  },
  other: {
    ko: '기타 일정',
    en: 'Other',
    zh: '其他日程',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
    barBg: 'bg-orange-500',
    dotBg: 'bg-orange-500',
    exampleKo: '병원 진료, 가족 행사, 동아리 모임',
    exampleEn: 'Clinic visit, family event, club gathering',
    exampleZh: '医院就诊、家庭聚会、社团活动',
  },
};

function calculateDDayLabel(targetDateStr: string, todayStr: string): string | null {
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const [cy, cm, cd] = todayStr.split('-').map(Number);
  const target = new Date(ty, tm - 1, td);
  const current = new Date(cy, cm - 1, cd);
  const diffDays = Math.round((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'D-Day';
  if (diffDays > 0) return `D-${diffDays}`;
  return null;
}

function isDateWithinSchedule(dateStr: string, item: ScheduleItem): boolean {
  if (!item.endDate || item.endDate <= item.date) {
    return item.date === dateStr;
  }
  return dateStr >= item.date && dateStr <= item.endDate;
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

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formCategory, setFormCategory] = useState<ScheduleCategory>('school');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formMemo, setFormMemo] = useState<string>('');

  const filteredSchedules = useMemo(() => {
    if (categoryFilter === 'all') return schedules;
    return schedules.filter((s) => s.category === categoryFilter);
  }, [schedules, categoryFilter]);

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

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = formatDateKey(d);
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        events: filteredSchedules.filter((ev) => isDateWithinSchedule(dateStr, ev)),
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dateStr = formatDateKey(d);
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        events: filteredSchedules.filter((ev) => isDateWithinSchedule(dateStr, ev)),
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = formatDateKey(d);
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        events: filteredSchedules.filter((ev) => isDateWithinSchedule(dateStr, ev)),
      });
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
          .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')),
      };
    });
  }, [cursorDate, filteredSchedules, todayStr, selectedDateStr]);

  const selectedDateEvents = useMemo(() => {
    return filteredSchedules
      .filter((ev) => isDateWithinSchedule(selectedDateStr, ev))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }, [filteredSchedules, selectedDateStr]);

  const upcomingEvents = useMemo(() => {
    return filteredSchedules
      .filter((ev) => ev.date >= todayStr || (ev.endDate && ev.endDate >= todayStr))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [filteredSchedules, todayStr]);

  const handleNavigate = (dir: -1 | 1) => {
    if (viewMode === 'month') {
      const next = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + dir, 1);
      setCursorDate(next);
      setSelectedDateStr(formatDateKey(next));
    } else if (viewMode === 'week') {
      const next = addDays(cursorDate, dir * 7);
      setCursorDate(next);
      setSelectedDateStr(formatDateKey(next));
    } else {
      const next = addDays(cursorDate, dir);
      setCursorDate(next);
      setSelectedDateStr(formatDateKey(next));
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setCursorDate(now);
    setSelectedDateStr(formatDateKey(now));
  };

  const openAddModal = (defaultDateStr?: string) => {
    const targetDate = defaultDateStr || selectedDateStr;
    setEditingItem(null);
    setFormTitle('');
    setFormCategory(categoryFilter === 'all' ? 'school' : categoryFilter);
    setFormDate(targetDate);
    setFormEndDate('');
    setFormTime('09:00');
    setFormMemo('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormDate(item.date);
    setFormEndDate(item.endDate || '');
    setFormTime(item.time || '');
    setFormMemo(item.memo || '');
    setIsModalOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const cleanItem: ScheduleItem = {
      id: editingItem ? editingItem.id : `sch-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      date: formDate,
      endDate: formEndDate && formEndDate >= formDate ? formEndDate : undefined,
      time: formTime || undefined,
      memo: formMemo.trim(),
    };

    onUpdateSchedules((prev) => {
      if (editingItem) {
        return prev.map((it) => (it.id === editingItem.id ? cleanItem : it));
      }
      return [...prev, cleanItem];
    });

    setSelectedDateStr(formDate);
    setIsModalOpen(false);
  };

  const handleDeleteSchedule = () => {
    if (!editingItem) return;
    onUpdateSchedules((prev) => prev.filter((it) => it.id !== editingItem.id));
    setIsModalOpen(false);
  };

  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDateStr]);

  const calendarWeekHeader =
    lang === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : lang === 'zh'
      ? ['日', '一', '二', '三', '四', '五', '六']
      : ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-4">
      {/* Top Control Card: Month/Week/Day Toggle + Category Filter */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'month', label: tr(lang, '월간', 'Month', '月历') },
                { id: 'week', label: tr(lang, '주간', 'Week', '周历') },
                { id: 'day', label: tr(lang, '일간', 'Day', '日历') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                  viewMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
              aria-label="Prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-900 font-mono tabular-nums px-1 whitespace-nowrap">
              {cursorDate.getFullYear()}.{String(cursorDate.getMonth() + 1).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="px-2.5 h-8 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 whitespace-nowrap"
            >
              {tr(lang, '오늘', 'Today', '今天')}
            </button>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tr(lang, '전체', 'All', '全部')}
          </button>
          {(['school', 'academy', 'other'] as ScheduleCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : `${meta.badgeBg} ${meta.badgeText} hover:opacity-90`
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${meta.dotBg}`} />
                {tr(lang, meta.ko, meta.en, meta.zh)}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70 text-center">
            {calendarWeekHeader.map((d, idx) => (
              <div
                key={d}
                className={`py-2 text-[11px] font-bold ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-600' : 'text-slate-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {monthCalendarCells.map((cell) => {
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDateStr(cell.dateStr);
                    const [y, m, d] = cell.dateStr.split('-').map(Number);
                    setCursorDate(new Date(y, m - 1, d));
                  }}
                  className={`min-h-[72px] p-1 flex flex-col items-start justify-start text-left transition-colors ${
                    cell.isSelected
                      ? 'bg-indigo-50/70 ring-2 ring-inset ring-indigo-600'
                      : cell.isCurrentMonth
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-slate-50/50 text-slate-300'
                  }`}
                >
                  <div className="w-full flex items-center justify-between px-0.5">
                    <span
                      className={`text-xs font-mono tabular-nums font-bold px-1.5 py-0.5 rounded-full ${
                        cell.isToday
                          ? 'bg-indigo-600 text-white'
                          : !cell.isCurrentMonth
                          ? 'text-slate-300'
                          : 'text-slate-700'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {cell.events.length > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums">
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
                      <div className="text-[9px] font-semibold text-slate-400 pl-1">
                        +{cell.events.length - 2}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {weekDaysList.map((wd) => (
            <div
              key={wd.dateStr}
              onClick={() => setSelectedDateStr(wd.dateStr)}
              className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                wd.isSelected
                  ? 'bg-indigo-50/60'
                  : wd.isToday
                  ? 'bg-amber-50/30'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-16 shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-900">
                    {translateDay(wd.dayLabel, lang)}
                  </span>
                  {wd.isToday && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-600 text-white rounded">
                      {tr(lang, '오늘', 'TODAY', '今天')}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {wd.dateObj.getMonth() + 1}/{wd.dayNum}
                </span>
              </div>

              <div className="flex-1 space-y-1.5">
                {wd.events.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">
                    {tr(lang, '등록된 일정 없음', 'No events', '无日程')}
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
                          openEditModal(ev);
                        }}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 hover:border-slate-300"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                            >
                              {tr(lang, meta.ko, meta.en, meta.zh)}
                            </span>
                            {ev.time && (
                              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                                {ev.time}
                              </span>
                            )}
                            {dDay && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono font-bold tabular-nums">
                                {dDay}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-900 mt-1 truncate">
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

      {/* SELECTED DATE DETAIL LIST */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 tabular-nums">
              {lang === 'en'
                ? `${selectedDateObj.getMonth() + 1}/${selectedDateObj.getDate()} (${translateDay(
                    getDayOfWeekKor(selectedDateObj),
                    lang
                  )}) Events`
                : lang === 'zh'
                ? `${selectedDateObj.getMonth() + 1}月${selectedDateObj.getDate()}日 (${translateDay(
                    getDayOfWeekKor(selectedDateObj),
                    lang
                  )}) 详细日程`
                : `${selectedDateObj.getMonth() + 1}월 ${selectedDateObj.getDate()}일 (${getDayOfWeekKor(
                    selectedDateObj
                  )}) 상세 일정`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openAddModal(selectedDateStr)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-95 transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {tr(lang, '일정 추가', 'Add Event', '添加日程')}
          </button>
        </div>

        {selectedDateEvents.length === 0 ? (
          <div className="p-7 text-center">
            <p className="text-sm font-medium text-slate-600">
              {tr(
                lang,
                '선택한 날짜에 등록된 일정이 없습니다.',
                'No events scheduled for this date.',
                '所选日期暂无登记日程。'
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {tr(
                lang,
                '우측 상단 [+ 일정 추가] 버튼을 눌러 학교·학원·기타 일정을 등록하세요.',
                'Tap [+ Add Event] above to register school, academy, or personal events.',
                '点击右上角【+ 添加日程】按钮添加学校、补习班或其他日程。'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {selectedDateEvents.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              const dDay = calculateDDayLabel(ev.date, todayStr);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => openEditModal(ev)}
                  className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${meta.badgeBg} ${meta.badgeText}`}
                      >
                        {tr(lang, meta.ko, meta.en, meta.zh)}
                      </span>
                      {ev.time && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-600 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {ev.time}
                        </span>
                      )}
                      {ev.endDate && ev.endDate > ev.date && (
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          ({ev.date} ~ {ev.endDate})
                        </span>
                      )}
                      {dDay && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tabular-nums ${
                            dDay === 'D-Day'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {dDay}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {translateSampleText(ev.title, lang)}
                    </h3>
                    {ev.memo && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {translateSampleText(ev.memo, lang)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-400 shrink-0 pt-1">
                    {tr(lang, '수정', 'Edit', '修改')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming D-Day Summary Strip */}
      {upcomingEvents.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-500">
            {tr(lang, '다가오는 주요 일정 (D-Day)', 'Upcoming Events (D-Day)', '即将到来的重要日程 (D-Day)')}
          </h3>
          <div className="space-y-2">
            {upcomingEvents.map((ev) => {
              const meta = CATEGORY_META[ev.category];
              const dDay =
                calculateDDayLabel(ev.date, todayStr) || tr(lang, '진행중', 'Ongoing', '进行中');
              return (
                <div
                  key={ev.id}
                  onClick={() => openEditModal(ev)}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${meta.badgeBg} ${meta.badgeText}`}
                    >
                      {tr(lang, meta.ko, meta.en, meta.zh)}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {translateSampleText(ev.title, lang)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {ev.date.slice(5)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold tabular-nums ${
                        dDay === 'D-Day'
                          ? 'bg-rose-600 text-white'
                          : 'bg-indigo-600 text-white'
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

      {/* ADD / EDIT SCHEDULE MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setIsModalOpen(false)}
        >
          <form
            onSubmit={handleSaveSchedule}
            className="w-full max-w-md bg-white rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem
                  ? tr(lang, '일정 수정 및 삭제', 'Edit or Delete Event', '修改或删除日程')
                  : tr(lang, '새 일정 등록', 'Add New Event', '添加新日程')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {tr(
                  lang,
                  '일정 구분 라벨 선택 (필수)',
                  'Select Category Label (Required)',
                  '选择日程分类标签（必选）'
                )}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['school', 'academy', 'other'] as ScheduleCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const selected = formCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`min-h-[52px] p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                        selected
                          ? `${meta.badgeBg} ${meta.badgeText} border-current ring-2 ring-offset-1`
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${meta.dotBg}`} />
                        {tr(lang, meta.ko, meta.en, meta.zh)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">
                {tr(
                  lang,
                  `예시: ${CATEGORY_META[formCategory].exampleKo}`,
                  `Examples: ${CATEGORY_META[formCategory].exampleEn}`,
                  `示例：${CATEGORY_META[formCategory].exampleZh}`
                )}
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
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
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {tr(lang, '시작 날짜', 'Start Date', '开始日期')}
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {tr(lang, '종료 날짜 (선택)', 'End Date (Optional)', '结束日期（可选）')}
                </label>
                <input
                  type="date"
                  value={formEndDate}
                  min={formDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-xs font-mono font-semibold text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                {tr(
                  lang,
                  '시간 (선택 · 동일 시간대 중복 허용)',
                  'Time (Optional)',
                  '时间（可选）'
                )}
              </label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono font-semibold text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                {tr(lang, '상세 메모', 'Details & Memo', '详细备注')}
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
                className="w-full p-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              {editingItem && (
                <button
                  type="button"
                  onClick={handleDeleteSchedule}
                  className="h-12 px-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-rose-100"
                >
                  <Trash2 className="w-4 h-4" />
                  {tr(lang, '삭제', 'Delete', '删除')}
                </button>
              )}
              <button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 active:scale-98 transition-all"
              >
                {editingItem
                  ? tr(lang, '변경사항 저장', 'Save Changes', '保存修改')
                  : tr(lang, '일정 추가하기', 'Add Event', '添加日程')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
