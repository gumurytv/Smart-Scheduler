import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  Clock,
  X,
  Check,
  CalendarDays,
  PencilLine,
} from 'lucide-react';
import { MemoMap, AppLanguage } from '../types';
import { formatDateKey, addDays } from '../data/initialData';
import {
  tr,
  translateDay,
  translateSampleText,
  formatDateLabel,
  formatFullDateLabel,
  formatYearMonthLabel,
  formatTimestampLabel,
} from '../i18n/translations';

interface MemoTabProps {
  language?: AppLanguage;
  memos: MemoMap;
  onUpdateMemos: (updater: (prev: MemoMap) => MemoMap) => void;
}

const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
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

/** Notebook ruling: one faint line every LINE_PX, aligned to the textarea line-height. */
const LINE_PX = 28;
const SHEET_PAD_TOP = 6;
const MIN_SHEET_PX = 280;

function parseKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortWeekday(d: Date, lang: AppLanguage): string {
  return translateDay(KO_WEEKDAYS[d.getDay()], lang);
}

function monthLabel(d: Date, lang: AppLanguage): string {
  const mo = d.getMonth() + 1;
  return tr(lang, `${mo}월`, EN_MONTHS_FULL[d.getMonth()], `${mo}月`);
}

function shortMonthLabel(d: Date, lang: AppLanguage): string {
  const mo = d.getMonth() + 1;
  return tr(lang, `${mo}월`, EN_MONTHS_FULL[d.getMonth()].slice(0, 3), `${mo}月`);
}

function renderHighlightedText(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text;
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  const kw = keyword.trim().toLowerCase();

  return parts.map((part, idx) =>
    part.toLowerCase() === kw ? (
      <mark key={idx} className="bg-accent-200 text-accent-900 font-semibold px-0.5 rounded-xs">
        {part}
      </mark>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
}

function getNowTimestampStr(): string {
  const now = new Date();
  const datePart = formatDateKey(now);
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${datePart} ${h}:${m}`;
}

export const MemoTab: React.FC<MemoTabProps> = ({ language = 'ko', memos, onUpdateMemos }) => {
  const lang = language;
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedDateObj = useMemo(() => parseKey(selectedDateStr), [selectedDateStr]);
  const isSelectedToday = selectedDateStr === todayStr;

  const rawCurrentMemo = memos[selectedDateStr]?.content || '';
  const displayedCurrentMemo = translateSampleText(rawCurrentMemo, lang);
  const currentUpdatedAt = memos[selectedDateStr]?.updatedAt || null;

  // Reset the in-page clear confirmation whenever the date changes.
  useEffect(() => {
    setConfirmClear(false);
  }, [selectedDateStr]);

  // Auto-grow the notebook sheet to fit its content.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const needed = Math.ceil((el.scrollHeight - SHEET_PAD_TOP) / LINE_PX) * LINE_PX + SHEET_PAD_TOP + 8;
    el.style.height = `${Math.max(MIN_SHEET_PX, needed)}px`;
  }, [displayedCurrentMemo, selectedDateStr]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const handleStepDate = (deltaDays: number) => {
    setSelectedDateStr(formatDateKey(addDays(selectedDateObj, deltaDays)));
  };

  const handleMemoChange = (newText: string) => {
    const ts = getNowTimestampStr();
    onUpdateMemos((prev) => {
      const next = { ...prev };
      if (!newText.trim()) {
        delete next[selectedDateStr];
      } else {
        next[selectedDateStr] = { content: newText, updatedAt: ts };
      }
      return next;
    });
  };

  const handleClearCurrentMemo = () => {
    onUpdateMemos((prev) => {
      const next = { ...prev };
      delete next[selectedDateStr];
      return next;
    });
    setConfirmClear(false);
  };

  const handleQuickInsert = (prefix: string) => {
    const el = textareaRef.current;
    const text = displayedCurrentMemo;
    const pos = el && document.activeElement === el ? el.selectionStart : text.length;
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const insert = `${lead}${prefix}`;
    handleMemoChange(before + insert + after);
    const caret = pos + insert.length;
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(caret, caret);
    });
  };

  const closeSearch = () => {
    setSearchKeyword('');
    setSearchOpen(false);
  };

  const weekDays = useMemo(() => {
    const offset = (selectedDateObj.getDay() + 6) % 7; // Monday-start
    const monday = addDays(selectedDateObj, -offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      const key = formatDateKey(d);
      return {
        key,
        date: d,
        hasMemo: !!memos[key]?.content?.trim(),
        isToday: key === todayStr,
        isSelected: key === selectedDateStr,
      };
    });
  }, [selectedDateObj, selectedDateStr, memos, todayStr]);

  const memoTimeline = useMemo(() => {
    return Object.entries(memos)
      .filter(([, val]) => val && val.content.trim().length > 0)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateStr, val]) => {
        const dObj = parseKey(dateStr);
        return {
          dateStr,
          dateObj: dObj,
          monthKey: dateStr.slice(0, 7),
          dateLabel: formatFullDateLabel(dObj, lang),
          content: translateSampleText(val.content, lang),
          updatedAt: val.updatedAt,
          isToday: dateStr === todayStr,
        };
      });
  }, [memos, todayStr, lang]);

  const timelineGroups = useMemo(() => {
    const groups: { monthKey: string; label: string; items: typeof memoTimeline }[] = [];
    memoTimeline.forEach((item) => {
      const last = groups[groups.length - 1];
      if (last && last.monthKey === item.monthKey) last.items.push(item);
      else groups.push({ monthKey: item.monthKey, label: formatYearMonthLabel(item.dateObj, lang), items: [item] });
    });
    return groups;
  }, [memoTimeline, lang]);

  const searchResults = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return [];
    return memoTimeline.filter(
      (item) =>
        item.content.toLowerCase().includes(kw) ||
        item.dateStr.includes(kw) ||
        item.dateLabel.toLowerCase().includes(kw)
    );
  }, [memoTimeline, searchKeyword]);

  const isSearching = searchKeyword.trim().length > 0;

  const quickInserts = [
    { label: tr(lang, '☐ 할 일', '☐ To-do', '☐ 待办'), prefix: '☐ ' },
    { label: tr(lang, '숙제', 'Homework', '作业'), prefix: tr(lang, '숙제: ', 'Homework: ', '作业：') },
    { label: tr(lang, '준비물', 'Supplies', '准备物品'), prefix: tr(lang, '준비물: ', 'Supplies: ', '准备物品：') },
    { label: tr(lang, '시험', 'Exam', '考试'), prefix: tr(lang, '시험: ', 'Exam: ', '考试：') },
  ];

  const savedTime = currentUpdatedAt ? currentUpdatedAt.split(' ')[1] || '' : '';
  const savedIsToday = !!currentUpdatedAt && currentUpdatedAt.startsWith(todayStr);
  const savedLabel = savedIsToday ? savedTime : formatTimestampLabel(currentUpdatedAt, lang);

  const navBtn =
    'w-[34px] h-[34px] rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 active:scale-95 transition-transform shrink-0';

  return (
    <div className="space-y-4">
      {/* 1. DATE HERO + WEEK STRIP + SEARCH */}
      <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3.5">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <StickyNote strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
            <h2 className="text-[13px] font-bold text-ink truncate">
              {tr(lang, '메모장', 'Notes', '备忘录')}
            </h2>
            <span className="px-2 py-px rounded-full bg-paper text-[11px] font-semibold text-slate-700 tabular-nums">
              {tr(lang, `${memoTimeline.length}개`, `${memoTimeline.length}`, `${memoTimeline.length}条`)}
            </span>
          </div>
          {!searchOpen && !isSearching && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="h-[32px] pl-3 pr-3.5 rounded-full border border-divider bg-paper inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100"
              aria-label={tr(lang, '메모 검색', 'Search memos', '搜索备忘')}
            >
              <Search strokeWidth={2.75} className="w-3.5 h-3.5" />
              {tr(lang, '검색', 'Search', '搜索')}
            </button>
          )}
        </div>

        {(searchOpen || isSearching) && (
          <div className="relative flex items-center">
            <Search strokeWidth={2.75} className="w-4 h-4 text-slate-600 absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              placeholder={tr(
                lang,
                '모든 메모에서 검색 (예: 수행평가, 숙제)',
                'Search all memos (e.g. homework, quiz)',
                '搜索所有备忘（如：作业、测评）'
              )}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch();
              }}
              className="w-full h-[40px] pl-10 pr-11 rounded-full bg-paper border border-divider text-[13px] text-ink placeholder:text-slate-500 focus:outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={closeSearch}
              className="w-[28px] h-[28px] rounded-full bg-slate-200 text-ink flex items-center justify-center absolute right-1.5 hover:bg-slate-300"
              aria-label={tr(lang, '검색 닫기', 'Close search', '关闭搜索')}
            >
              <X strokeWidth={3} className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Date hero */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[48px] leading-none tabular-nums text-ink">
              {selectedDateObj.getDate()}
            </span>
            <label
              className="relative min-w-0 cursor-pointer rounded-lg"
              title={tr(lang, '날짜 선택', 'Pick a date', '选择日期')}
            >
              <input
                type="date"
                value={selectedDateStr}
                lang={tr(lang, 'ko-KR', 'en-US', 'zh-CN')}
                aria-label={tr(lang, '날짜 선택', 'Pick a date', '选择日期')}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateStr(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex items-center gap-1.5 pointer-events-none">
                <span className="text-[15px] font-bold text-ink truncate">{monthLabel(selectedDateObj, lang)}</span>
                <CalendarDays strokeWidth={2.5} className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                {isSelectedToday && (
                  <span className="px-2 py-px rounded-full text-[11px] font-bold bg-accent-700 text-paper">
                    {tr(lang, '오늘', 'TODAY', '今天')}
                  </span>
                )}
              </div>
              <div className="text-[12px] font-semibold text-slate-600 truncate pointer-events-none">
                {(() => {
                  const w = FULL_WEEKDAYS[selectedDateObj.getDay()];
                  return `${tr(lang, w.ko, w.en, w.zh)} · ${selectedDateObj.getFullYear()}`;
                })()}
              </div>
            </label>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleStepDate(-1)}
              className={navBtn}
              aria-label={tr(lang, '이전 날짜', 'Previous day', '前一天')}
            >
              <ChevronLeft strokeWidth={2.75} className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateStr(todayStr)}
              disabled={isSelectedToday}
              className={`px-3 h-[34px] rounded-full text-[12px] font-bold whitespace-nowrap transition-colors ${
                isSelectedToday
                  ? 'bg-paper/60 text-slate-500 cursor-default'
                  : 'bg-accent-700 text-paper hover:bg-accent-800'
              }`}
            >
              {tr(lang, '오늘', 'Today', '今天')}
            </button>
            <button
              type="button"
              onClick={() => handleStepDate(1)}
              className={navBtn}
              aria-label={tr(lang, '다음 날짜', 'Next day', '后一天')}
            >
              <ChevronRight strokeWidth={2.75} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Week strip (Mon–Sun) */}
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={tr(lang, '이번 주', 'This week', '本周')}>
          {weekDays.map((day) => {
            const base = 'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors min-w-0';
            const tone = day.isSelected
              ? 'bg-accent-700 text-paper'
              : day.isToday
              ? 'bg-paper ring-[1.5px] ring-inset ring-accent text-accent-800'
              : 'bg-paper/70 text-ink hover:bg-paper';
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDateStr(day.key)}
                aria-pressed={day.isSelected}
                aria-label={`${formatDateLabel(day.date, lang)}${
                  day.hasMemo ? tr(lang, ' · 메모 있음', ' · has memo', ' · 有备忘') : ''
                }`}
                className={`${base} ${tone}`}
              >
                <span
                  className={`text-[11px] font-semibold leading-tight ${
                    day.isSelected ? 'text-paper/90' : day.isToday ? 'text-accent-800' : 'text-slate-600'
                  }`}
                >
                  {shortWeekday(day.date, lang)}
                </span>
                <span className="font-mono text-[16px] leading-none tabular-nums">{day.date.getDate()}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    day.hasMemo ? (day.isSelected ? 'bg-paper' : 'bg-accent') : 'bg-transparent'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. SEARCH RESULTS */}
      {isSearching && (
        <section className="bg-surface rounded-2xl shadow-xs p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Search strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
              <span className="text-[13px] font-bold text-ink truncate">
                &lsquo;{searchKeyword.trim()}&rsquo;
              </span>
              <span className="px-2 py-px rounded-full bg-accent-200 text-accent-900 text-[11px] font-bold tabular-nums shrink-0">
                {tr(lang, `${searchResults.length}건`, `${searchResults.length} found`, `${searchResults.length}条`)}
              </span>
            </div>
            <button
              type="button"
              onClick={closeSearch}
              className="h-[28px] px-3 rounded-full border border-divider text-[12px] font-semibold text-slate-700 hover:bg-paper shrink-0"
            >
              {tr(lang, '닫기', 'Close', '关闭')}
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-5 bg-paper rounded-xl text-center text-[12px] text-slate-600">
              {tr(
                lang,
                '이 단어가 들어간 메모가 없어요.',
                'No memos contain this keyword.',
                '没有包含该关键词的备忘。'
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((item) => (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDateStr(item.dateStr);
                    closeSearch();
                  }}
                  className="w-full p-3 rounded-xl bg-paper text-left hover:ring-1 hover:ring-accent-300 transition-shadow space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-mono tabular-nums truncate">
                      {renderHighlightedText(item.dateLabel, searchKeyword)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 tabular-nums shrink-0">
                      {formatTimestampLabel(item.updatedAt, lang)}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink whitespace-pre-wrap leading-normal line-clamp-3 break-words">
                    {renderHighlightedText(item.content, searchKeyword)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. NOTEBOOK PAGE EDITOR */}
      <section className="bg-surface rounded-2xl shadow-xs p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <PencilLine strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
            <span className="text-[13px] font-bold text-ink truncate">
              {tr(lang, '일일 메모', 'Daily memo', '每日备忘')}
            </span>
          </div>
          {currentUpdatedAt ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sage-200 text-sage-800 text-[11px] font-semibold shrink-0">
              <Check strokeWidth={3} className="w-3 h-3" />
              <span className="font-mono tabular-nums">{savedLabel}</span>
              {tr(lang, '저장됨', 'saved', '已保存')}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-paper/70 text-slate-600 text-[11px] font-semibold shrink-0">
              {tr(lang, '입력하면 자동 저장', 'Auto-saves as you type', '输入即自动保存')}
            </span>
          )}
        </div>

        {/* Quick-insert chips */}
        <div className="flex flex-wrap gap-1.5 px-1">
          {quickInserts.map((q) => (
            <button
              key={q.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleQuickInsert(q.prefix)}
              className="h-[28px] px-3 rounded-full border border-divider bg-paper/60 text-[12px] font-semibold text-slate-700 hover:bg-paper hover:text-ink"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Ruled sheet */}
        <div className="relative bg-paper rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-baseline justify-between gap-2 pl-[52px] pr-4 pt-3 pb-1">
            <span className="font-mono text-[15px] text-accent-700 tabular-nums truncate">
              {formatDateLabel(selectedDateObj, lang)}
            </span>
          </div>
          <div aria-hidden="true" className="absolute top-0 bottom-0 left-[40px] w-px bg-accent-300" />
          <textarea
            ref={textareaRef}
            value={displayedCurrentMemo}
            onChange={(e) => handleMemoChange(e.target.value)}
            aria-label={tr(lang, '일일 메모', 'Daily memo', '每日备忘')}
            placeholder={tr(
              lang,
              '알림장, 숙제, 준비물, 수업 핵심 내용을 적어보세요.',
              'Jot down homework, supplies, reminders or class notes.',
              '记下作业、准备物品、提醒或课堂重点。'
            )}
            style={{
              lineHeight: `${LINE_PX}px`,
              paddingTop: SHEET_PAD_TOP,
              minHeight: MIN_SHEET_PX,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${
                LINE_PX - 1
              }px, var(--color-divider) ${LINE_PX - 1}px, var(--color-divider) ${LINE_PX}px)`,
              backgroundPosition: `0 ${SHEET_PAD_TOP - 4}px`, // rule sits just under the text baseline
              backgroundAttachment: 'local',
            }}
            className="block w-full bg-transparent pl-[52px] pr-4 pb-2 text-[15px] text-ink placeholder:text-slate-500 focus:outline-none resize-none overflow-hidden break-words"
          />
        </div>

        {/* Footer: char count + clear */}
        <div className="flex items-center justify-between gap-2 px-1 min-h-[30px]">
          <span className="text-[11px] text-slate-600">
            <span className="font-mono tabular-nums text-[13px] text-ink">{displayedCurrentMemo.length}</span>{' '}
            {tr(lang, '자', 'chars', '字')}
          </span>
          {displayedCurrentMemo.trim().length > 0 &&
            (confirmClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-accent-800">
                  {tr(lang, '이 날짜 메모를 비울까요?', 'Clear this memo?', '清空该日备忘？')}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="h-[28px] px-3 rounded-full border border-divider text-[12px] font-semibold text-slate-700 hover:bg-paper"
                >
                  {tr(lang, '취소', 'Cancel', '取消')}
                </button>
                <button
                  type="button"
                  onClick={handleClearCurrentMemo}
                  className="h-[28px] px-3 rounded-full bg-accent-800 text-paper text-[12px] font-bold hover:bg-accent-900"
                >
                  {tr(lang, '비우기', 'Clear', '清空')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-[12px] font-semibold text-slate-600 hover:text-accent-800 px-1"
              >
                {tr(lang, '비우기', 'Clear', '清空')}
              </button>
            ))}
        </div>
      </section>

      {/* 4. RECENT MEMOS TIMELINE */}
      <section className="bg-surface rounded-2xl shadow-xs p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock strokeWidth={2.75} className="w-4 h-4 text-accent-700" />
            <h3 className="text-[13px] font-bold text-ink">{tr(lang, '최근 메모', 'Recent memos', '最近备忘')}</h3>
            <span className="px-2 py-px rounded-full bg-paper text-[11px] font-semibold text-slate-700 tabular-nums">
              {memoTimeline.length}
            </span>
          </div>
          {memoTimeline.length > 0 && (
            <span className="text-[11px] text-slate-600">
              {tr(lang, '눌러서 열기', 'Tap to open', '点击打开')}
            </span>
          )}
        </div>

        {memoTimeline.length === 0 ? (
          <div className="py-7 px-4 rounded-xl bg-paper text-center space-y-1.5">
            <PencilLine strokeWidth={2.25} className="w-6 h-6 text-accent-600 mx-auto" />
            <p className="text-[13px] font-bold text-ink">
              {tr(lang, '아직 적은 메모가 없어요', 'No memos yet', '还没有备忘')}
            </p>
            <p className="text-[12px] text-slate-600">
              {tr(
                lang,
                '위 노트에 오늘의 할 일을 한 줄 적어보세요.',
                'Write a line about today in the notebook above.',
                '在上方笔记里写下今天的一件事吧。'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {timelineGroups.map((group) => (
              <div key={group.monthKey} className="space-y-2">
                {timelineGroups.length > 1 && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-[12px] font-bold text-slate-700">{group.label}</span>
                    <span className="flex-1 h-px bg-divider" aria-hidden="true" />
                  </div>
                )}
                {group.items.map((item) => {
                  const isSelected = item.dateStr === selectedDateStr;
                  const blockTone = item.isToday
                    ? 'bg-accent-700 text-paper'
                    : isSelected
                    ? 'bg-sage-200 text-sage-900'
                    : 'bg-surface text-ink';
                  const subTone = item.isToday ? 'text-paper/85' : isSelected ? 'text-sage-800' : 'text-slate-600';
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDateStr(item.dateStr)}
                      aria-current={isSelected ? 'date' : undefined}
                      className={`w-full flex items-stretch gap-3 p-2.5 rounded-xl bg-paper text-left transition-shadow ${
                        isSelected ? 'ring-2 ring-sage-400' : 'hover:ring-1 hover:ring-divider'
                      }`}
                    >
                      <div
                        className={`w-[54px] shrink-0 rounded-lg flex flex-col items-center justify-center py-1.5 ${blockTone}`}
                      >
                        <span className="font-mono text-[24px] leading-none tabular-nums">
                          {item.dateObj.getDate()}
                        </span>
                        <span className={`mt-1 text-[11px] font-semibold leading-none ${subTone}`}>
                          {tr(
                            lang,
                            `${shortWeekday(item.dateObj, lang)}요일`,
                            shortWeekday(item.dateObj, lang),
                            shortWeekday(item.dateObj, lang)
                          )}
                        </span>
                        <span className={`mt-0.5 text-[11px] leading-tight ${subTone}`}>
                          {shortMonthLabel(item.dateObj, lang)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 py-0.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            {item.isToday && (
                              <span className="px-1.5 py-px rounded-full text-[11px] font-bold bg-accent-200 text-accent-900">
                                {tr(lang, '오늘', 'TODAY', '今天')}
                              </span>
                            )}
                            {isSelected && (
                              <span className="px-1.5 py-px rounded-full text-[11px] font-semibold bg-sage-200 text-sage-900">
                                {tr(lang, '열람 중', 'Viewing', '查看中')}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-600 tabular-nums shrink-0">
                            {formatTimestampLabel(item.updatedAt, lang)}
                          </span>
                        </div>
                        <p className="text-[13px] text-slate-800 line-clamp-3 whitespace-pre-wrap leading-snug break-words">
                          {item.content}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
