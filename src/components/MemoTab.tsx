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
        className="bg-accent-200 text-accent-900 font-semibold px-0.5 rounded-xs"
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
      <div className="bg-surface rounded-2xl p-2.5 shadow-xs">
        <div className="relative flex items-center">
          <Search strokeWidth={2.75} className="w-4 h-4 text-slate-600 absolute left-3.5 pointer-events-none" />
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
            className="w-full h-[42px] pl-10 pr-10 rounded-full bg-paper border border-divider text-[13px] text-ink placeholder:text-slate-500 focus:outline-none focus:border-accent"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => setSearchKeyword('')}
              className="w-[26px] h-[26px] rounded-full bg-slate-300 text-ink flex items-center justify-center absolute right-2 hover:bg-slate-400"
              aria-label="Clear search"
            >
              <X strokeWidth={3} className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* IF SEARCHING: SHOW FILTERED HIGHLIGHTED CARDS */}
      {searchKeyword.trim().length > 0 && (
        <section className="bg-accent-100 rounded-2xl p-3.5 border border-accent-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-accent-900">
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
              className="text-[11px] font-semibold text-accent-800 underline"
            >
              {tr(lang, '검색 닫기', 'Close', '关闭搜索')}
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-5 bg-paper rounded-xl text-center text-xs text-slate-600">
              {tr(
                lang,
                '일치하는 키워드가 포함된 메모가 없습니다.',
                'No memos found matching your keyword.',
                '没有找到包含该关键词的备忘录。'
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
                    setSearchKeyword('');
                  }}
                  className="w-full p-3 rounded-xl bg-paper border border-accent-200 text-left hover:border-accent-400 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-accent-700 font-mono tabular-nums">
                      {item.dateStr} ({translateDay(item.dayLabel, lang)})
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {item.updatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-ink whitespace-pre-wrap leading-normal">
                    {renderHighlightedText(item.content, searchKeyword)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. DATE NAVIGATION + IMMEDIATE DAILY MEMO EDITOR */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-3.5 py-3 border-b border-divider space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStepDate(-1)}
                className="w-[34px] h-[34px] rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 active:scale-95 transition-transform"
                aria-label="Prev Day"
              >
                <ChevronLeft strokeWidth={2.75} className="w-3.5 h-3.5" />
              </button>

              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => {
                  if (e.target.value) setSelectedDateStr(e.target.value);
                }}
                className="h-[34px] px-3 rounded-full border border-divider bg-paper text-xs font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
              />

              <button
                type="button"
                onClick={() => handleStepDate(1)}
                className="w-[34px] h-[34px] rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 active:scale-95 transition-transform"
                aria-label="Next Day"
              >
                <ChevronRight strokeWidth={2.75} className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoToday}
              className={`px-3 h-[34px] rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                selectedDateStr === todayStr
                  ? 'bg-accent text-paper'
                  : 'bg-accent-100 text-accent-800 hover:bg-accent-200'
              }`}
            >
              {tr(lang, '오늘로 이동', 'Go Today', '回到今天')}
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <StickyNote strokeWidth={2.75} className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-ink tabular-nums">
                {selectedDateStr} ({translateDay(getDayOfWeekKor(selectedDateObj), lang)}){' '}
                {tr(lang, '일일 메모', 'Daily Memo', '每日备忘')}
              </span>
              {selectedDateStr === todayStr && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-accent-200 text-accent-900 rounded-full">
                  TODAY
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-sage-700 font-medium">
              {currentUpdatedAt ? (
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-sage-700">
                  <Check strokeWidth={2.75} className="w-3 h-3 text-sage" />
                  {saveFeedback
                    ? tr(lang, '자동 저장됨', 'Auto-saved', '已自动保存')
                    : `${currentUpdatedAt.slice(5)}`}
                </span>
              ) : (
                <span className="text-slate-500">
                  {tr(lang, '타이핑 즉시 자동 저장', 'Instant auto-save', '输入实时自动保存')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Immediate Textarea Editor */}
        <div className="p-3.5 space-y-2">
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
            className="w-full p-3 rounded-xl bg-paper border border-divider text-[13px] text-ink leading-relaxed placeholder:text-slate-500 focus:outline-none focus:border-accent resize-y"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span className="font-mono tabular-nums">
              {displayedCurrentMemo.length}{' '}
              {tr(lang, '자 작성됨', 'chars', '字')}
            </span>
            {displayedCurrentMemo.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClearCurrentMemo}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-800 hover:text-accent-900"
              >
                <Trash2 className="w-3.5 h-3.5" />{' '}
                {tr(lang, '이 날짜 메모 비우기', 'Clear Memo', '清空该日备忘')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. RECENT MEMO TIMELINE LIST */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-3.5 py-3 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock strokeWidth={2.75} className="w-4 h-4 text-accent" />
            <h3 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                `최근 작성된 메모 타임라인 (${memoTimeline.length}건)`,
                `Recent Memo Timeline (${memoTimeline.length})`,
                `最近备忘时间轴 (${memoTimeline.length}条)`
              )}
            </h3>
          </div>
          <span className="text-[11px] text-slate-600">
            {tr(lang, '터치 시 해당 날짜로 이동', 'Tap to open date', '点击跳转至该日期')}
          </span>
        </div>

        {memoTimeline.length === 0 ? (
          <div className="p-7 text-center text-xs text-slate-500">
            {tr(
              lang,
              '작성된 메모가 없습니다. 위 메모장에 오늘의 할 일을 적어보세요.',
              'No memos yet. Write your first note above!',
              '暂无备忘录，请在上方输入今日待办事项。'
            )}
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {memoTimeline.map((item) => {
              const isSelected = item.dateStr === selectedDateStr;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(item.dateStr)}
                  className={`w-full px-3.5 py-3 text-left transition-colors space-y-1 ${
                    isSelected ? 'bg-accent-100' : 'hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink font-mono tabular-nums">
                        {item.dateStr} ({translateDay(item.dayLabel, lang)})
                      </span>
                      {item.isToday && (
                        <span className="px-1.5 py-px rounded-full text-[9px] font-bold bg-accent text-paper">
                          {tr(lang, '오늘', 'TODAY', '今天')}
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-1.5 py-px rounded-full text-[9px] font-semibold bg-slate-300 text-slate-800">
                          {tr(lang, '열람 중', 'Viewing', '当前查看')}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {item.updatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 line-clamp-2 whitespace-pre-wrap leading-normal">
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
