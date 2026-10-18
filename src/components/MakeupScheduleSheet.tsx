import React, { useState } from 'react';
import { CalendarClock, Clock, X } from 'lucide-react';
import { AppLanguage, DailyOverrides, MasterTimetable, ScheduleItem } from '../types';
import { tr, translateSubject } from '../i18n/translations';
import { TimeConflict, findTimeConflicts, timeToMinutes } from '../utils/timetableHelpers';
import { ConflictDialog } from './ConflictDialog';

interface MakeupScheduleSheetProps {
  lang: AppLanguage;
  academyName: string;
  /** Label of the missed class, e.g. "10/14(화) 결석". */
  missedLabel: string;
  initial: { date: string; start: string; end: string };
  /** Set when changing an existing plan (its class is ignored in the overlap check). */
  editingOverrideId?: string;
  masterTimetable: MasterTimetable;
  dailyOverrides: DailyOverrides;
  schedules?: ScheduleItem[];
  onSave: (plan: { date: string; start: string; end: string }) => void;
  onClose: () => void;
}

/** 보강 일정 등록: pick the date and time of the makeup for a missed academy class. */
export const MakeupScheduleSheet: React.FC<MakeupScheduleSheetProps> = ({
  lang,
  academyName,
  missedLabel,
  initial,
  editingOverrideId,
  masterTimetable,
  dailyOverrides,
  schedules,
  onSave,
  onClose,
}) => {
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [conflicts, setConflicts] = useState<TimeConflict[] | null>(null);
  const invalid = !date || !start || !end || timeToMinutes(end) <= timeToMinutes(start);

  const submit = () => {
    if (invalid) return;
    const found = findTimeConflicts({
      dateStr: date,
      start,
      end,
      masterTimetable,
      dailyOverrides,
      schedules,
      ignoreAcademyId: editingOverrideId,
    });
    if (found.length > 0) setConflicts(found);
    else onSave({ date, start, end });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, '보강 일정 등록', 'Schedule the makeup', '登记补课时间')}
    >
      <div
        className="w-full max-w-md bg-paper rounded-t-[28px] p-5 pb-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[1rem] font-bold text-ink truncate">
              {editingOverrideId
                ? tr(lang, '보강 일정 변경', 'Change the makeup', '修改补课时间')
                : tr(lang, '보강 일정 등록', 'Schedule the makeup', '登记补课时间')}
            </h3>
            <p className="text-[0.75rem] font-semibold text-slate-600 truncate">
              {translateSubject(academyName, lang)} · {missedLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(lang, '닫기', 'Close', '关闭')}
            className="w-9 h-9 shrink-0 rounded-full bg-surface flex items-center justify-center text-slate-600 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
            <CalendarClock className="w-4 h-4 text-accent-700" />
            {tr(lang, '보강 날짜', 'Makeup date', '补课日期')}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-11 px-4 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
            <Clock className="w-4 h-4 text-accent-700" />
            {tr(lang, '보강 시간', 'Makeup time', '补课时间')}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
              className="flex-1 min-w-0 h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
            />
            <span className="text-sm font-bold text-slate-500">–</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
              className="flex-1 min-w-0 h-11 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-accent"
            />
          </div>
          {start && end && timeToMinutes(end) <= timeToMinutes(start) && (
            <p className="text-[0.75rem] font-semibold text-accent-800">
              {tr(lang, '끝나는 시간이 시작보다 늦어야 해요', 'End must be after start', '结束时间须晚于开始时间')}
            </p>
          )}
        </div>

        <p className="text-[0.6875rem] text-slate-600 leading-snug">
          {tr(
            lang,
            '등록하면 시간표에 보강으로 들어가고, 보강 알림을 켜 두었다면 알림도 와요. 보강을 마친 뒤 「보강 완료」를 눌러 주세요.',
            'The makeup goes on the timetable (and gets a reminder if they’re on). Tap “Done” after it.',
            '登记后会作为补课加入课表（若开启提醒也会通知）。补课结束后请点「完成」。'
          )}
        </p>

        <button
          type="button"
          disabled={invalid}
          onClick={submit}
          className="w-full h-12 rounded-full bg-accent-700 text-paper text-[0.875rem] font-bold inline-flex items-center justify-center gap-2 hover:bg-accent-800 disabled:opacity-40"
        >
          <CalendarClock className="w-4 h-4" />
          {editingOverrideId ? tr(lang, '변경 저장', 'Save changes', '保存修改') : tr(lang, '보강 일정 등록', 'Schedule', '登记')}
        </button>
      </div>

      {conflicts && (
        // Keep clicks inside the dialog from reaching this sheet's backdrop
        <div onClick={(e) => e.stopPropagation()}>
        <ConflictDialog
          lang={lang}
          conflicts={conflicts}
          onCancel={() => setConflicts(null)}
          onConfirm={() => {
            setConflicts(null);
            onSave({ date, start, end });
          }}
        />
        </div>
      )}
    </div>
  );
};
