// 자녀 선택: one planner per child. The selected child's data is kept in the top-level PlannerState
// fields (so every screen keeps working unchanged); the others are parked in children.list[].data.
import { CHILD_DATA_KEYS, ChildData, PlannerState } from '../types';
import { createInitialPlannerState } from '../data/initialData';
import { resetPlannerParts } from './appReset';

export interface ChildSummary {
  id: string;
  name: string;
  isActive: boolean;
  data: ChildData;
}

export function extractChildData(state: PlannerState): ChildData {
  const out = {} as Record<string, unknown>;
  CHILD_DATA_KEYS.forEach((k) => {
    out[k] = state[k];
  });
  return out as ChildData;
}

function applyChildData(state: PlannerState, data: ChildData): PlannerState {
  const next = { ...state } as Record<string, unknown>;
  CHILD_DATA_KEYS.forEach((k) => {
    next[k] = data[k];
  });
  return next as unknown as PlannerState;
}

/** Name shown in the switcher: the child's profile name, or "자녀 N". */
export function childName(data: ChildData | undefined, index: number, fallback: (n: number) => string): string {
  return data?.profile?.name?.trim() || fallback(index + 1);
}

/** Every child with its data (the selected one read from the top level). Always at least one. */
export function listChildren(state: PlannerState): Omit<ChildSummary, 'name'>[] {
  const ch = state.children;
  if (!ch || ch.list.length === 0) return [{ id: 'c1', isActive: true, data: extractChildData(state) }];
  return ch.list.map((c) => ({
    id: c.id,
    isActive: c.id === ch.activeId,
    data: c.id === ch.activeId ? extractChildData(state) : (c.data as ChildData),
  }));
}

function newId(state: PlannerState): string {
  const used = new Set((state.children?.list || []).map((c) => c.id).concat('c1'));
  let i = used.size + 1;
  while (used.has(`c${i}`)) i += 1;
  return `c${i}`;
}

/** A fresh planner for a new child: empty timetables and records, the same class times and subjects. */
export function emptyChildData(state: PlannerState, name: string): ChildData {
  const base = resetPlannerParts(
    { ...createInitialPlannerState(new Date()), schoolTimeConfig: state.schoolTimeConfig },
    ['school', 'academy', 'schedules', 'attendance', 'memos', 'profile'],
    'empty'
  );
  return {
    ...extractChildData(base),
    subjectPool: { school: [...state.subjectPool.school], academy: [...state.subjectPool.academy] },
    subjectColors: state.subjectColors ? { ...state.subjectColors } : undefined,
    profile: { name, school: '', grade: '' },
  };
}

/** Adds a child (and selects it when `select`). */
export function addChild(state: PlannerState, data: ChildData, select = true): PlannerState {
  const id = newId(state);
  const list = state.children?.list.length ? state.children.list : [{ id: 'c1' }];
  const activeId = state.children?.activeId || 'c1';
  if (!select) {
    return { ...state, children: { activeId, list: [...list, { id, data }] } };
  }
  const parked = list.map((c) => (c.id === activeId ? { id: c.id, data: extractChildData(state) } : c));
  return applyChildData({ ...state, children: { activeId: id, list: [...parked, { id }] } }, data);
}

export function switchChild(state: PlannerState, id: string): PlannerState {
  const ch = state.children;
  if (!ch || ch.activeId === id) return state;
  const target = ch.list.find((c) => c.id === id);
  if (!target?.data) return state;
  const list = ch.list.map((c) =>
    c.id === ch.activeId ? { id: c.id, data: extractChildData(state) } : c.id === id ? { id } : c
  );
  return applyChildData({ ...state, children: { activeId: id, list } }, target.data);
}

/** Removes a child. Removing the selected one switches to the first remaining child. */
export function removeChild(state: PlannerState, id: string): PlannerState {
  const ch = state.children;
  if (!ch || ch.list.length < 2) return state;
  let next = state;
  if (ch.activeId === id) {
    const other = ch.list.find((c) => c.id !== id)!;
    next = switchChild(state, other.id);
  }
  const list = next.children!.list.filter((c) => c.id !== id);
  return { ...next, children: list.length > 1 ? { activeId: next.children!.activeId, list } : undefined };
}

/** Renames a child (the name is the profile name). */
export function renameChild(state: PlannerState, id: string, name: string): PlannerState {
  const activeId = state.children?.activeId || 'c1';
  if (id === activeId) {
    return { ...state, profile: { name, school: state.profile?.school || '', grade: state.profile?.grade || '' } };
  }
  const list = (state.children?.list || []).map((c) =>
    c.id === id && c.data
      ? { ...c, data: { ...c.data, profile: { name, school: c.data.profile?.school || '', grade: c.data.profile?.grade || '' } } }
      : c
  );
  return { ...state, children: { activeId, list } };
}

/** Replaces one child's data (used by 데이터 불러오기). */
export function setChildData(state: PlannerState, id: string, data: ChildData): PlannerState {
  const activeId = state.children?.activeId || 'c1';
  if (id === activeId) return applyChildData(state, data);
  const list = (state.children?.list || []).map((c) => (c.id === id ? { id, data } : c));
  return { ...state, children: { activeId, list } };
}
