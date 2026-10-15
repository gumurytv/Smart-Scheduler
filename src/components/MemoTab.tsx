import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  Clock,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { MemoMap, AppLanguage } from '../types';
import { formatDateKey, addDays, getDayOfWeekKor } from '../data/initialData';
import { tr, translateDay, translateSampleText } from '../i18n/translations';

interface MemoTabProps {
  language?: AppLanguage;
  memos: MemoMap;
  onUpdateMemos: (updater: (prev: MemoMap) => MemoMap) => void;
}

function renderHighlightedText(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, idx) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark
        key={idx}
        className="bg-yellow-200 text-slate-950 font-semibold px-0.5 rounded-xs"
      >
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

export const MemoTab: React.FC<MemoTabProps> = ({
  language = 'ko',
  memos,
  onUpdateMemos,
}) => {
  const lang = language;
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);

  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDateStr]);

  const rawCurrentMemo = memos[selectedDateStr]?.content || '';
  const displayedCurrentMemo = translateSampleText(rawCurrentMemo, lang);
  const currentUpdatedAt = memos[selectedDateStr]?.updatedAt || null;

  const handleStepDate = (deltaDays: number) => {
    const nextDate = addDays(selectedDateObj, deltaDays);
    setSelectedDateStr(formatDateKey(nextDate));
  };

  const handleGoToday = () => {
    setSelectedDateStr(todayStr);
  };

  const handleMemoChange = (newText: string) => {
    const ts = getNowTimestampStr();
    onUpdateMemos((prev) => {
      const next = { ...prev };
      if (!newText.trim()) {
        delete next[selectedDateStr];
      } else {
        next[selectedDateStr] = {
          content: newText,
          updatedAt: ts,
        };
      }
      return next;
    });
    setSaveFeedback(true);
  };

  const handleClearCurrentMemo = () => {
    onUpdateMemos((prev) => {
      const next = { ...prev };
      delete next[selectedDateStr];
      return next;
    });
  };

  const memoTimeline = useMemo(() => {
    return Object.entries(memos)
      .filter(([, val]) => val && val.content.trim().length > 0)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateStr, val]) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, d);
        const localizedContent = translateSampleText(val.content, lang);
        return {
          dateStr,
          dayLabel: getDayOfWeekKor(dObj),
          content: localizedContent,
          updatedAt: val.updatedAt,
          isToday: dateStr === todayStr,
        };
      });
  }, [memos, todayStr, lang]);

  const searchResults = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return [];
    return memoTimeline.filter(
      (item) =>
        item.content.toLowerCase().includes(kw) || item.dateStr.includes(kw)
    );
  }, [memoTimeline, searchKeyword]);

  return (
    <div className="space-y-4">
      {/* 1. TOP REAL-TIME KEYWORD SEARCH BAR */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder={tr(
              lang,
              '전체 과거 메모 키워드 검색 (예: 수행평가, 수학, 숙제)',
              'Search all memos by keyword (e.g. homework, math, quiz)',
              '搜索所有历史备忘关键词（如：作业、数学、测评）'
            )}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full h-11 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="w-7 h-7 rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center absolute right-2 hover:bg-slate-300"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* IF SEARCHING: SHOW FILTERED HIGHLIGHTED CARDS */}
      {searchKeyword.trim().length > 0 && (
        <section className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950">
              &lsquo;{searchKeyword}&rsquo;{' '}
              {tr(
                lang,
                `검색 결과 (${searchResults.length}건)`,
                `Results (${searchResults.length})`,
                `搜索结果 (${searchResults.length}条)`
              )}
            </span>
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="text-xs font-semibold text-amber-800 underline"
            >
              {tr(lang, '검색 닫기', 'Close', '关闭搜索')}
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-6 bg-white rounded-xl border border-amber-100 text-center text-xs text-slate-500">
              {tr(
                lang,
                '일치하는 키워드가 포함된 메모가 없습니다.',
                'No memos found matching your keyword.',
                '没有找到包含该关键词的备忘录。'
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {searchResults.map((item) => (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDateStr(item.dateStr);
                    setSearchKeyword('');
                  }}
                  className="w-full p-3.5 rounded-xl bg-white border border-amber-200/90 text-left hover:border-amber-400 transition-colors space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 font-mono tabular-nums">
                      {item.dateStr} ({translateDay(item.dayLabel, lang)})
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {item.updatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {renderHighlightedText(item.content, searchKeyword)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. DATE NAVIGATION + IMMEDIATE DAILY MEMO EDITOR */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStepDate(-1)}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-transform"
                aria-label="Prev Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateStr(e.target.value);
                }}
                className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 tabular-nums"
              />

              <button
                type="button"
                onClick={() => handleStepDate(1)}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-transform"
                aria-label="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToday}
              className={`px-3 h-9 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                selectedDateStr === todayStr
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              {tr(lang, '오늘로 이동', 'Go Today', '回到今天')}
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <StickyNote className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900 tabular-nums">
                {selectedDateStr} ({translateDay(getDayOfWeekKor(selectedDateObj), lang)}){' '}
                {tr(lang, '일일 메모', 'Daily Memo', '每日备忘')}
              </span>
              {selectedDateStr === todayStr && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded">
                  TODAY
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
              {currentUpdatedAt ? (
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-500">
                  <Check className="w-3 h-3 text-emerald-600" />
                  {saveFeedback
                    ? tr(lang, '자동 저장됨', 'Auto-saved', '已自动保存')
                    : `${currentUpdatedAt.slice(5)}`}
                </span>
              ) : (
                <span className="text-slate-400">
                  {tr(lang, '타이핑 즉시 자동 저장', 'Instant auto-save', '输入实时自动保存')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Immediate Textarea Editor */}
        <div className="p-4 space-y-3">
          <textarea
            rows={8}
            value={displayedCurrentMemo}
            onChange={(e) => handleMemoChange(e.target.value)}
            placeholder={tr(
              lang,
              `${selectedDateStr}의 알림장, 숙제, 준비물, 수업 핵심 내용을 바로 입력하세요. 입력 즉시 기기에 자동 저장됩니다.`,
              `Write homework, reminders, or class notes for ${selectedDateStr}. Saved automatically to your device.`,
              `在此输入 ${selectedDateStr} 的作业、待办事项或课堂重点，输入后立即自动保存至本地设备。`
            )}
            className="w-full p-3.5 rounded-2xl bg-amber-50/30 border border-slate-200 text-sm text-slate-900 leading-relaxed placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 resize-y"
          />

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono tabular-nums">
              {displayedCurrentMemo.length}{' '}
              {tr(lang, '자 작성됨', 'chars', '字')}
            </span>
            {displayedCurrentMemo.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClearCurrentMemo}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5" />{' '}
                {tr(lang, '이 날짜 메모 비우기', 'Clear Memo', '清空该日备忘')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. RECENT MEMO TIMELINE LIST */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {tr(
                lang,
                `최근 작성된 메모 타임라인 (${memoTimeline.length}건)`,
                `Recent Memo Timeline (${memoTimeline.length})`,
                `最近备忘时间轴 (${memoTimeline.length}条)`
              )}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {tr(lang, '터치 시 해당 날짜로 이동', 'Tap to open date', '点击跳转至该日期')}
          </span>
        </div>

        {memoTimeline.length === 0 ? (
          <div className="p-7 text-center text-xs text-slate-400">
            {tr(
              lang,
              '작성된 메모가 없습니다. 위 메모장에 오늘의 할 일을 적어보세요.',
              'No memos yet. Write your first note above!',
              '暂无备忘录，请在上方输入今日待办事项。'
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {memoTimeline.map((item) => {
              const isSelected = item.dateStr === selectedDateStr;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(item.dateStr)}
                  className={`w-full p-4 text-left transition-colors space-y-1.5 ${
                    isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                        {item.dateStr} ({translateDay(item.dayLabel, lang)})
                      </span>
                      {item.isToday && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-600 text-white">
                          {tr(lang, '오늘', 'TODAY', '今天')}
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                          {tr(lang, '열람 중', 'Viewing', '当前查看')}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {item.updatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap leading-relaxed">
                    {renderHighlightedText(item.content, searchKeyword)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
