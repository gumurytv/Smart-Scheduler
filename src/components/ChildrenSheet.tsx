import React, { useState } from 'react';
import { Check, Pencil, Trash2, UserPlus, UserRound, X } from 'lucide-react';
import { AppLanguage, PlannerState } from '../types';
import { tr } from '../i18n/translations';
import { addChild, childName, emptyChildData, listChildren, removeChild, renameChild, switchChild } from '../utils/children';

interface ChildrenSheetProps {
  lang: AppLanguage;
  state: PlannerState;
  onUpdateState: (updater: (prev: PlannerState) => PlannerState) => void;
  onClose: () => void;
}

export const childFallbackName = (lang: AppLanguage) => (n: number) => tr(lang, `자녀 ${n}`, `Child ${n}`, `孩子 ${n}`);

/** 자녀 선택: switch between children, add, rename or remove one. */
export const ChildrenSheet: React.FC<ChildrenSheetProps> = ({ lang, state, onUpdateState, onClose }) => {
  const fallback = childFallbackName(lang);
  const children = listChildren(state).map((c, i) => ({ ...c, name: childName(c.data, i, fallback) }));
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const add = () => {
    const name = newName.trim() || fallback(children.length + 1);
    onUpdateState((prev) => addChild(prev, emptyChildData(prev, name), true));
    setNewName('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, '자녀 선택', 'Choose child', '选择孩子')}
    >
      <div
        className="w-full max-w-md max-h-[92vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-2.5 pb-3 border-b border-divider space-y-2.5 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[1rem] font-bold text-ink">{tr(lang, '자녀 선택', 'Children', '选择孩子')}</h3>
              <p className="text-[0.6875rem] text-slate-600">
                {tr(
                  lang,
                  '자녀마다 시간표·일정·출석·메모가 따로 저장돼요',
                  'Each child has their own timetable, schedule, attendance and memos',
                  '每个孩子的课表、日程、出勤和备忘都分开保存'
                )}
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

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {children.map((c) => {
            const isEditing = editing?.id === c.id;
            const school = [c.data.profile?.school, c.data.profile?.grade].map((v) => v?.trim()).filter(Boolean).join(' · ');
            return (
              <div
                key={c.id}
                className={`rounded-2xl px-3 py-2.5 flex items-center gap-3 ${
                  c.isActive ? 'bg-accent-100 ring-2 ring-accent-600' : 'bg-surface'
                }`}
              >
                {isEditing ? (
                  <form
                    className="flex-1 flex items-center gap-2 min-w-0"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editing.name.trim()) onUpdateState((prev) => renameChild(prev, c.id, editing.name.trim()));
                      setEditing(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      aria-label={tr(lang, '이름', 'Name', '姓名')}
                      className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-paper border border-divider text-[0.875rem] text-ink"
                    />
                    <button
                      type="submit"
                      aria-label={tr(lang, '저장', 'Save', '保存')}
                      className="w-10 h-10 rounded-full bg-accent-700 text-paper grid place-items-center shrink-0"
                    >
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateState((prev) => switchChild(prev, c.id));
                        onClose();
                      }}
                      aria-pressed={c.isActive}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                      <span
                        className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${
                          c.isActive ? 'bg-accent-700 text-paper' : 'bg-paper text-slate-700'
                        }`}
                      >
                        <UserRound className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.9375rem] font-bold text-ink truncate">{c.name}</span>
                        <span className="block text-[0.6875rem] text-slate-600 truncate">
                          {c.isActive ? tr(lang, '지금 보는 중', 'Showing now', '正在查看') : school || tr(lang, '눌러서 보기', 'Tap to view', '点按查看')}
                          {c.isActive && school ? ` · ${school}` : ''}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing({ id: c.id, name: c.data.profile?.name || '' })}
                      aria-label={tr(lang, `${c.name} 이름 바꾸기`, `Rename ${c.name}`, `重命名 ${c.name}`)}
                      className="w-9 h-9 rounded-full grid place-items-center text-slate-700 hover:bg-paper shrink-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeleting(c.id)}
                        aria-label={tr(lang, `${c.name} 삭제`, `Remove ${c.name}`, `删除 ${c.name}`)}
                        className="w-9 h-9 rounded-full grid place-items-center text-accent-800 hover:bg-paper shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {deleting && (
            <div role="alert" className="rounded-2xl bg-accent-100 border border-accent-300 p-3 space-y-2">
              <p className="text-[0.8125rem] font-semibold text-accent-900 leading-snug">
                {tr(
                  lang,
                  `「${children.find((c) => c.id === deleting)?.name}」의 시간표·일정·출석·메모가 모두 지워져요. 되돌릴 수 없어요.`,
                  `All of ${children.find((c) => c.id === deleting)?.name}'s data will be deleted. This cannot be undone.`,
                  `「${children.find((c) => c.id === deleting)?.name}」的全部数据将被删除，无法撤销。`
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleting(null)}
                  className="h-10 rounded-full border border-divider bg-paper text-[0.8125rem] font-bold text-ink"
                >
                  {tr(lang, '취소', 'Cancel', '取消')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState((prev) => removeChild(prev, deleting));
                    setDeleting(null);
                  }}
                  className="h-10 rounded-full bg-accent-800 text-paper text-[0.8125rem] font-bold"
                >
                  {tr(lang, '삭제', 'Delete', '删除')}
                </button>
              </div>
            </div>
          )}

          <form
            className="pt-2 space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '자녀 추가', 'Add a child', '添加孩子')}</span>
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={tr(lang, `이름 (예: ${fallback(children.length + 1)})`, `Name (e.g. ${fallback(children.length + 1)})`, `姓名（例：${fallback(children.length + 1)}）`)}
                aria-label={tr(lang, '새 자녀 이름', "New child's name", '新孩子姓名')}
                className="flex-1 min-w-0 h-11 px-3.5 rounded-full bg-surface border border-divider text-[0.875rem] text-ink placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="h-11 px-4 rounded-full bg-accent-700 text-paper text-[0.8125rem] font-bold inline-flex items-center gap-1.5 hover:bg-accent-800 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                {tr(lang, '추가', 'Add', '添加')}
              </button>
            </div>
            <p className="text-[0.6875rem] text-slate-600 leading-snug">
              {tr(
                lang,
                '새 자녀는 빈 시간표로 시작해요. 수업 시간과 과목 후보는 지금 설정을 그대로 가져가요. 위젯은 고른 자녀 기준으로 바뀌고, 보강 알림은 모든 자녀 것이 와요.',
                "A new child starts with an empty timetable, using the current class times and subjects. Widgets follow the selected child; makeup reminders come for every child.",
                '新孩子从空白课表开始，沿用当前的上课时间和候选科目。小组件跟随所选孩子，补课提醒对所有孩子有效。'
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
