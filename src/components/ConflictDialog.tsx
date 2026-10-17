import React from 'react';
import { AlertTriangle, Building2, CalendarClock, GraduationCap } from 'lucide-react';
import { AppLanguage } from '../types';
import { tr, translateSampleText, translateSubject } from '../i18n/translations';
import type { TimeConflict } from '../utils/timetableHelpers';

/** "이 시간에 이미 … 이 있어요" — shown before saving a makeup or event that overlaps something. */
export const ConflictDialog: React.FC<{
  lang: AppLanguage;
  conflicts: TimeConflict[];
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ lang, conflicts, onCancel, onConfirm }) => (
  <div
    className="fixed inset-0 z-[70] bg-slate-900/55 flex items-center justify-center px-5"
    onClick={onCancel}
    role="alertdialog"
    aria-modal="true"
    aria-label={tr(lang, '시간이 겹쳐요', 'Time overlap', '时间冲突')}
  >
    <div className="w-full max-w-sm bg-paper rounded-[24px] p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-accent-100 text-accent-800 grid place-items-center shrink-0">
          <AlertTriangle strokeWidth={2.5} className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[1rem] font-bold text-ink">{tr(lang, '시간이 겹쳐요', 'This overlaps', '时间有冲突')}</h3>
          <p className="text-[0.75rem] text-slate-600 leading-snug">
            {tr(
              lang,
              '같은 시간에 이미 아래 일정이 있어요. 그래도 저장할까요?',
              'Something is already planned at this time. Save anyway?',
              '同一时间已有以下安排，仍要保存吗？'
            )}
          </p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {conflicts.map((c, i) => {
          const Icon = c.kind === 'school' ? GraduationCap : c.kind === 'academy' ? Building2 : CalendarClock;
          const tone = c.kind === 'school' ? 'bg-sage-700' : c.kind === 'academy' ? 'bg-accent-700' : 'bg-other-600';
          const name =
            c.kind === 'school'
              ? `${tr(lang, `${c.period}교시`, `P${c.period}`, `第${c.period}节`)} · ${translateSubject(c.name, lang)}`
              : c.kind === 'academy'
              ? translateSubject(c.name, lang)
              : translateSampleText(c.name, lang);
          return (
            <li key={i} className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2">
              <span className={`w-7 h-7 rounded-lg grid place-items-center text-paper shrink-0 ${tone}`}>
                <Icon strokeWidth={2.5} className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0 text-[0.8125rem] font-bold text-ink truncate">{name}</span>
              <span className="font-mono text-[0.75rem] tabular-nums text-slate-700 shrink-0">
                {c.endTime ? `${c.startTime}~${c.endTime}` : c.startTime}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-full border border-divider bg-paper text-ink text-[0.8125rem] font-bold hover:bg-slate-100"
        >
          {tr(lang, '시간 바꾸기', 'Change time', '修改时间')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 rounded-full bg-accent-700 text-paper text-[0.8125rem] font-bold hover:bg-accent-800"
        >
          {tr(lang, '그래도 저장', 'Save anyway', '仍然保存')}
        </button>
      </div>
    </div>
  </div>
);
