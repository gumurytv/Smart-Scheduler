import React, { useState } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  Settings,
  StickyNote,
  X,
  LayoutGrid,
  LucideIcon,
} from 'lucide-react';
import { AppLanguage } from '../types';
import { tr } from '../i18n/translations';
import { FEATURE_GUIDE, GuideMenu, L10n, SETUP_GUIDE, SetupTarget } from '../data/userGuide';
import { usePersistentState } from '../utils/usePersistentState';

const MENU_ICONS: Record<GuideMenu, LucideIcon> = {
  timetable: CalendarClock,
  schedule: CalendarDays,
  attendance: CheckCircle2,
  memo: StickyNote,
  settings: Settings,
};

interface GuideSheetProps {
  lang: AppLanguage;
  onClose: () => void;
  /** Jumps to the settings card a setup step lives in. */
  onGo: (target: SetupTarget) => void;
}

/** 사용 가이드: features by bottom menu, or the first-time setup order. */
export const GuideSheet: React.FC<GuideSheetProps> = ({ lang, onClose, onGo }) => {
  const t = (s: L10n) => tr(lang, s.ko, s.en, s.zh);
  const [view, setView] = usePersistentState<'features' | 'setup'>('settings.guideView', 'features', ['features', 'setup']);
  const [menu, setMenu] = useState<GuideMenu>('timetable');
  const section = FEATURE_GUIDE.find((s) => s.menu === menu) ?? FEATURE_GUIDE[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, '사용 가이드', 'User guide', '使用指南')}
    >
      <div
        className="w-full max-w-md h-[92vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-2.5 pb-3 border-b border-divider space-y-2.5 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[1rem] font-bold text-ink">{tr(lang, '사용 가이드', 'User guide', '使用指南')}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(lang, '닫기', 'Close', '关闭')}
              className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-surface" role="tablist">
            {(
              [
                ['features', LayoutGrid, tr(lang, '메뉴별 기능', 'By menu', '按菜单功能')],
                ['setup', ListChecks, tr(lang, '처음 설정 순서', 'Setup steps', '初次设置步骤')],
              ] as Array<['features' | 'setup', LucideIcon, string]>
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`h-9 rounded-full text-[0.8125rem] font-bold inline-flex items-center justify-center gap-1.5 ${
                  view === v ? 'bg-accent-700 text-paper' : 'text-ink hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {view === 'features' ? (
            <>
              <p className="text-[0.75rem] text-slate-600 leading-snug">
                {tr(lang, '아래 메뉴 이름을 누르면 그 메뉴에서 할 수 있는 일을 보여줘요.', 'Pick a menu to see what it can do.', '点击菜单名称，查看该菜单的功能。')}
              </p>
              <div className="grid grid-cols-5 gap-1" role="tablist" aria-label={tr(lang, '하단 메뉴', 'Bottom menu', '底部菜单')}>
                {FEATURE_GUIDE.map((s) => {
                  const Icon = MENU_ICONS[s.menu];
                  const on = s.menu === menu;
                  return (
                    <button
                      key={s.menu}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setMenu(s.menu)}
                      className={`min-h-[56px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${
                        on ? 'bg-accent-700 text-paper' : 'bg-surface text-ink hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={on ? 2.75 : 2} />
                      <span className="text-[0.6875rem] font-bold whitespace-nowrap">{t(s.name)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl bg-surface p-3.5 space-y-3">
                <p className="text-[0.8125rem] font-semibold text-ink leading-snug">{t(section.summary)}</p>
                <ul className="space-y-2.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 mt-px rounded-full bg-accent-700 text-paper font-mono text-[0.6875rem] grid place-items-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-[0.8125rem] font-bold text-ink">{t(item.title)}</div>
                        <p className="text-[0.75rem] text-slate-700 leading-[1.5] break-keep">{t(item.desc)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-[0.75rem] text-slate-600 leading-snug">
                {tr(
                  lang,
                  '처음 쓸 때 이 순서대로 설정하면 돼요. 「바로 가기」를 누르면 그 설정으로 이동해요.',
                  'Set the app up in this order. “Go” takes you to each setting.',
                  '首次使用时按此顺序设置即可。点击「前往」可跳到对应设置。'
                )}
              </p>
              <ol className="space-y-2">
                {SETUP_GUIDE.map((step, i) => (
                  <li key={i} className="rounded-2xl bg-surface p-3 flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-accent-700 text-paper font-mono text-[0.8125rem] grid place-items-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[0.875rem] font-bold text-ink">{t(step.title)}</span>
                        {step.optional && (
                          <span className="px-1.5 py-px rounded-full bg-paper text-slate-600 text-[0.625rem] font-bold">
                            {tr(lang, '선택', 'Optional', '可选')}
                          </span>
                        )}
                      </div>
                      <div className="text-[0.6875rem] font-semibold text-accent-800">{t(step.where)}</div>
                      <p className="text-[0.75rem] text-slate-700 leading-[1.5] break-keep">{t(step.desc)}</p>
                      <button
                        type="button"
                        onClick={() => onGo(step.target)}
                        className="mt-1 h-8 px-3 rounded-full border border-divider bg-paper text-[0.6875rem] font-bold text-ink inline-flex items-center gap-1 hover:bg-slate-100"
                      >
                        {tr(lang, '바로 가기', 'Go', '前往')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
