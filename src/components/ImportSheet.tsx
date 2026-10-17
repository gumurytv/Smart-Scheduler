import React, { useState } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  FileUp,
  GraduationCap,
  IdCard,
  Settings2,
  StickyNote,
  Tags,
  UserPlus,
  UserRound,
  X,
  LucideIcon,
} from 'lucide-react';
import { AppLanguage, PlannerState } from '../types';
import { tr } from '../i18n/translations';
import { IMPORT_PARTS, ImportPart, ParsedBackup, applyImportParts, describeChild } from '../utils/backupImport';
import { addChild, childName, emptyChildData, extractChildData, listChildren, setChildData } from '../utils/children';

interface ImportSheetProps {
  lang: AppLanguage;
  fileName: string;
  parsed: ParsedBackup;
  state: PlannerState;
  onUpdateState: (updater: (prev: PlannerState) => PlannerState) => void;
  onDone: (message: string) => void;
  onClose: () => void;
}

/** 데이터 불러오기: pick which parts of a backup file to apply, and to which child. */
export const ImportSheet: React.FC<ImportSheetProps> = ({ lang, fileName, parsed, state, onUpdateState, onDone, onClose }) => {
  const childLabel = (n: number) => tr(lang, `자녀 ${n}`, `Child ${n}`, `孩子 ${n}`);
  const [srcIdx, setSrcIdx] = useState(0);
  const [parts, setParts] = useState<ImportPart[]>(['school', 'academy']);
  const [target, setTarget] = useState<'current' | 'new'>('current');
  const [confirming, setConfirming] = useState(false);

  const src = parsed.children[srcIdx].data;
  const counts = describeChild(src);
  const mine = listChildren(state);
  const activeIdx = mine.findIndex((c) => c.isActive);
  const currentName = childName(mine[activeIdx]?.data, activeIdx, childLabel);
  const srcName = (i: number) => childName(parsed.children[i].data, i, childLabel);

  const meta: Record<ImportPart, { icon: LucideIcon; tone: string; label: string; detail: string }> = {
    school: {
      icon: GraduationCap,
      tone: 'bg-sage-700',
      label: tr(lang, '학교 시간표', 'School timetable', '学校课表'),
      detail: tr(lang, `과목 ${counts.school}칸 · 수업 시간 설정 포함`, `${counts.school} periods · incl. class times`, `${counts.school} 节 · 含上课时间`),
    },
    academy: {
      icon: Building2,
      tone: 'bg-accent-700',
      label: tr(lang, '학원 시간표', 'Academy timetable', '补习班课表'),
      detail: tr(lang, `수업 ${counts.academy}개 · 보강·휴강 포함`, `${counts.academy} classes · incl. makeups`, `${counts.academy} 节课 · 含补课停课`),
    },
    schedules: {
      icon: CalendarDays,
      tone: 'bg-other-600',
      label: tr(lang, '일정', 'Schedule', '日程'),
      detail: tr(lang, `일정 ${counts.schedules}개`, `${counts.schedules} events`, `${counts.schedules} 个日程`),
    },
    attendance: {
      icon: CheckCircle2,
      tone: 'bg-sage-600',
      label: tr(lang, '출석 기록', 'Attendance', '出勤记录'),
      detail: tr(lang, `${counts.attendance}일 기록`, `${counts.attendance} days`, `${counts.attendance} 天记录`),
    },
    memos: {
      icon: StickyNote,
      tone: 'bg-accent-600',
      label: tr(lang, '메모', 'Memos', '备忘录'),
      detail: tr(lang, `메모 ${counts.memos}개`, `${counts.memos} memos`, `${counts.memos} 条备忘`),
    },
    profile: {
      icon: IdCard,
      tone: 'bg-sage-800',
      label: tr(lang, '내 정보', 'Profile', '个人信息'),
      detail:
        [src.profile?.name, src.profile?.school, src.profile?.grade].map((v) => v?.trim()).filter(Boolean).join(' · ') ||
        tr(lang, '비어 있어요', 'Empty', '为空'),
    },
    subjects: {
      icon: Tags,
      tone: 'bg-slate-600',
      label: tr(lang, '과목 후보군 · 색상', 'Subjects & colours', '候选科目 · 颜色'),
      detail: tr(lang, `과목 ${counts.subjects}개`, `${counts.subjects} subjects`, `${counts.subjects} 个科目`),
    },
    app: {
      icon: Settings2,
      tone: 'bg-ink',
      label: tr(lang, '앱 설정', 'App settings', '应用设置'),
      detail: tr(lang, '언어·글자 크기·위젯·표시 범위·보강 알림', 'Language, text size, widgets, range, reminders', '语言、字体、小组件、显示范围、补课提醒'),
    },
  };

  const toggle = (p: ImportPart) => {
    setConfirming(false);
    setParts((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };
  const allOn = parts.length === IMPORT_PARTS.length;
  const childParts = parts.filter((p) => p !== 'app');

  const apply = () => {
    onUpdateState((prev) => {
      let next = prev;
      if (childParts.length > 0) {
        if (target === 'new') {
          const index = listChildren(prev).length;
          const base = emptyChildData(prev, src.profile?.name?.trim() || childLabel(index + 1));
          const data = applyImportParts(base, src, childParts);
          if (!data.profile?.name?.trim()) data.profile = { ...base.profile!, ...data.profile, name: base.profile!.name };
          next = addChild(prev, data, true);
        } else {
          next = setChildData(prev, prev.children?.activeId || 'c1', applyImportParts(extractChildData(prev), src, childParts));
        }
      }
      if (parts.includes('app')) {
        const app = Object.fromEntries(Object.entries(parsed.app).filter(([, v]) => v !== undefined));
        next = { ...next, ...app };
      }
      return next;
    });
    onDone(
      target === 'new' && childParts.length > 0
        ? tr(lang, `새 자녀로 추가하고 ${parts.length}개 항목을 불러왔어요`, `Added as a new child with ${parts.length} item(s)`, `已作为新孩子添加并导入 ${parts.length} 项`)
        : tr(lang, `${parts.length}개 항목을 불러왔어요`, `Imported ${parts.length} item(s)`, `已导入 ${parts.length} 项`)
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, '데이터 불러오기', 'Import data', '导入数据')}
    >
      <div
        className="w-full max-w-md max-h-[92vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-2.5 pb-3 border-b border-divider space-y-2.5 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[1rem] font-bold text-ink">{tr(lang, '데이터 불러오기', 'Import data', '导入数据')}</h3>
              <p className="text-[0.6875rem] text-slate-600 truncate">
                <FileUp className="inline w-3 h-3 mr-1 -mt-0.5" />
                {fileName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(lang, '닫기', 'Close', '关闭')}
              className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {parsed.children.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-[0.75rem] font-bold text-ink">
                {tr(lang, '파일 속 자녀', 'Child in the file', '文件中的孩子')}
              </span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup">
                {parsed.children.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={srcIdx === i}
                    onClick={() => {
                      setConfirming(false);
                      setSrcIdx(i);
                    }}
                    className={`h-9 px-3.5 rounded-full text-[0.8125rem] font-bold inline-flex items-center gap-1.5 ${
                      srcIdx === i ? 'bg-accent-700 text-paper' : 'bg-surface text-ink hover:bg-slate-100'
                    }`}
                  >
                    <UserRound className="w-3.5 h-3.5" />
                    {srcName(i)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '불러올 항목', 'What to import', '导入内容')}</span>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setParts(allOn ? [] : [...IMPORT_PARTS]);
                }}
                className="h-8 px-3 rounded-full border border-divider bg-paper text-[0.75rem] font-bold text-ink inline-flex items-center gap-1.5 hover:bg-slate-100"
              >
                <Check strokeWidth={3} className="w-3.5 h-3.5" />
                {allOn ? tr(lang, '모두 해제', 'Clear selection', '全部取消') : tr(lang, '모두 선택', 'Select all', '全选')}
              </button>
            </div>
            {IMPORT_PARTS.map((part) => {
              const m = meta[part];
              const Icon = m.icon;
              const on = parts.includes(part);
              return (
                <button
                  key={part}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(part)}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                    on ? 'bg-accent-100 ring-2 ring-accent-600' : 'bg-surface hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-paper ${m.tone}`}>
                    <Icon strokeWidth={2.5} className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[0.875rem] font-bold text-ink">{m.label}</span>
                    <span className="block text-[0.6875rem] text-slate-600 truncate">{m.detail}</span>
                  </span>
                  <span
                    className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 border-2 ${
                      on ? 'bg-accent-700 border-accent-700 text-paper' : 'border-slate-400 bg-paper'
                    }`}
                  >
                    {on && <Check strokeWidth={3.5} className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '어디에 넣을까요?', 'Apply to', '应用到')}</span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface" role="radiogroup">
              {(
                [
                  ['current', UserRound, currentName, tr(lang, '고른 항목을 덮어써요', 'Replaces the picked items', '覆盖所选内容')],
                  ['new', UserPlus, tr(lang, '새 자녀로 추가', 'Add as a new child', '添加为新孩子'), tr(lang, '지금 데이터는 그대로', 'Keeps current data', '保留现有数据')],
                ] as Array<['current' | 'new', LucideIcon, string, string]>
              ).map(([value, Icon, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={target === value}
                  onClick={() => {
                    setConfirming(false);
                    setTarget(value);
                  }}
                  className={`rounded-xl px-2 py-2 text-center transition-colors min-w-0 ${
                    target === value ? 'bg-accent-700 text-paper' : 'text-ink hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1 text-[0.8125rem] font-bold min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className={`block text-[0.625rem] ${target === value ? 'text-paper/80' : 'text-slate-600'}`}>{hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[0.6875rem] text-slate-600 leading-snug">
              {tr(
                lang,
                '친구나 다른 가족이 보낸 파일도 불러올 수 있어요. 고르지 않은 항목은 지금 내용 그대로 남아요.',
                "Files from friends or family work too. Anything you don't pick stays as it is.",
                '也可以导入朋友或家人发来的文件。未选择的内容保持不变。'
              )}
            </p>
          </div>
        </div>

        <div className="px-4 pt-3 pb-5 border-t border-divider shrink-0 space-y-2">
          {confirming && (
            <p role="alert" className="rounded-xl bg-accent-100 border border-accent-300 px-3 py-2 text-[0.75rem] font-semibold text-accent-900 leading-snug">
              {tr(
                lang,
                `「${currentName}」의 고른 ${parts.length}개 항목이 파일 내용으로 바뀌어요. 계속할까요?`,
                `${parts.length} item(s) of “${currentName}” will be replaced by the file. Continue?`,
                `「${currentName}」所选的 ${parts.length} 项将被文件内容替换，继续吗？`
              )}
            </p>
          )}
          <button
            type="button"
            disabled={parts.length === 0}
            onClick={() => (target === 'current' && childParts.length > 0 && !confirming ? setConfirming(true) : apply())}
            className="w-full h-12 rounded-full bg-accent-700 text-paper text-[0.875rem] font-bold inline-flex items-center justify-center gap-2 hover:bg-accent-800 disabled:opacity-40"
          >
            <FileUp strokeWidth={2.5} className="w-4 h-4" />
            {parts.length === 0
              ? tr(lang, '불러올 항목을 고르세요', 'Pick something to import', '请选择要导入的内容')
              : confirming
              ? tr(lang, '네, 불러올게요', 'Yes, import', '确认导入')
              : tr(lang, `선택한 ${parts.length}개 불러오기`, `Import ${parts.length} item(s)`, `导入所选 ${parts.length} 项`)}
          </button>
        </div>
      </div>
    </div>
  );
};
