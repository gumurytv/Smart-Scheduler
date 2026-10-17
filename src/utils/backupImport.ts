// 데이터 불러오기: read a backup file (mine or someone else's) and apply only the parts the user picks.
import { ChildData, DAYS_OF_WEEK, DailyOverrides, MasterTimetable, PlannerState } from '../types';
import { extractChildData } from './children';

export type ImportPart = 'school' | 'academy' | 'schedules' | 'attendance' | 'memos' | 'profile' | 'subjects' | 'app';
export const IMPORT_PARTS: ImportPart[] = ['school', 'academy', 'schedules', 'attendance', 'memos', 'profile', 'subjects', 'app'];

export interface ParsedBackup {
  /** One entry per child saved in the file (a single-child file has one). */
  children: { id: string; data: ChildData }[];
  /** Shared settings: language, text size, widgets, timeline range, reminders. */
  app: Pick<PlannerState, 'language' | 'textScale' | 'widgetConfig' | 'timelineConfig' | 'reminders'>;
}

function looksLikeChild(d: unknown): d is ChildData {
  const o = d as ChildData;
  return (
    !!o &&
    typeof o === 'object' &&
    !!o.subjectPool &&
    Array.isArray(o.subjectPool.school) &&
    Array.isArray(o.subjectPool.academy) &&
    !!o.masterTimetable &&
    typeof o.masterTimetable === 'object' &&
    Array.isArray(o.schedules) &&
    typeof o.attendance === 'object' &&
    typeof o.memos === 'object'
  );
}

/** Fills the optional parts an older or hand-edited file may leave out. */
function normalizeChild(d: ChildData): ChildData {
  const master = { ...d.masterTimetable } as MasterTimetable;
  DAYS_OF_WEEK.forEach((day) => {
    const v = master[day];
    master[day] = { school: Array.isArray(v?.school) ? v.school : [], academy: Array.isArray(v?.academy) ? v.academy : [] };
  });
  return { ...d, masterTimetable: master, dailyOverrides: d.dailyOverrides || {} };
}

/** Returns null when the text isn't a TeumTeum backup. */
export function parseBackup(text: string): ParsedBackup | null {
  let parsed: PlannerState;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!looksLikeChild(parsed)) return null;
  const top = normalizeChild(extractChildData(parsed));
  const list = parsed.children?.list;
  let children: ParsedBackup['children'] = [{ id: parsed.children?.activeId || 'c1', data: top }];
  if (Array.isArray(list) && list.length > 1) {
    children = list
      .map((c) => ({ id: c.id, data: c.id === parsed.children!.activeId ? top : c.data }))
      .filter((c): c is { id: string; data: ChildData } => looksLikeChild(c.data))
      .map((c) => ({ id: c.id, data: normalizeChild(c.data) }));
  }
  return {
    children,
    app: {
      language: parsed.language,
      textScale: parsed.textScale,
      widgetConfig: parsed.widgetConfig,
      timelineConfig: parsed.timelineConfig,
      reminders: parsed.reminders,
    },
  };
}

function keepOverrides(overrides: DailyOverrides, side: 'school' | 'academy'): DailyOverrides {
  const out: DailyOverrides = {};
  Object.entries(overrides).forEach(([date, o]) => {
    if (side === 'school' ? o.school : o.academy?.length) out[date] = { [side]: o[side] };
  });
  return out;
}

/** Merges two override maps, taking `school` from one and `academy` from the other. */
function joinOverrides(school: DailyOverrides, academy: DailyOverrides): DailyOverrides {
  const out: DailyOverrides = {};
  Object.entries(school).forEach(([d, o]) => (out[d] = { school: o.school }));
  Object.entries(academy).forEach(([d, o]) => (out[d] = { ...(out[d] || {}), academy: o.academy }));
  return out;
}

/** The target child's data with the chosen parts replaced by the file's. */
export function applyImportParts(target: ChildData, src: ChildData, parts: ImportPart[]): ChildData {
  const has = (p: ImportPart) => parts.includes(p);
  const next: ChildData = { ...target };
  if (has('school') || has('academy')) {
    const master = { ...target.masterTimetable } as MasterTimetable;
    DAYS_OF_WEEK.forEach((d) => {
      master[d] = {
        school: has('school') ? src.masterTimetable[d].school.map((p) => ({ ...p })) : target.masterTimetable[d]?.school || [],
        academy: has('academy') ? src.masterTimetable[d].academy.map((a) => ({ ...a })) : target.masterTimetable[d]?.academy || [],
      };
    });
    next.masterTimetable = master;
    next.dailyOverrides = joinOverrides(
      keepOverrides(has('school') ? src.dailyOverrides : target.dailyOverrides, 'school'),
      keepOverrides(has('academy') ? src.dailyOverrides : target.dailyOverrides, 'academy')
    );
    if (has('school') && src.schoolTimeConfig) next.schoolTimeConfig = { ...src.schoolTimeConfig };
  }
  if (has('schedules')) next.schedules = src.schedules.map((s) => ({ ...s }));
  if (has('attendance')) next.attendance = { ...src.attendance };
  if (has('memos')) next.memos = { ...src.memos };
  if (has('profile')) next.profile = src.profile ? { ...src.profile } : undefined;
  if (has('subjects')) {
    next.subjectPool = { school: [...src.subjectPool.school], academy: [...src.subjectPool.academy] };
    next.subjectColors = src.subjectColors ? { ...src.subjectColors } : undefined;
  } else if (has('school') || has('academy')) {
    // Keep the pool usable: add subjects the imported timetable uses.
    const pool = { school: [...next.subjectPool.school], academy: [...next.subjectPool.academy] };
    DAYS_OF_WEEK.forEach((d) => {
      if (has('school'))
        next.masterTimetable[d].school.forEach((p) => p.subject && !pool.school.includes(p.subject) && pool.school.push(p.subject));
      if (has('academy'))
        next.masterTimetable[d].academy.forEach((a) => a.subject && !pool.academy.includes(a.subject) && pool.academy.push(a.subject));
    });
    next.subjectPool = pool;
  }
  return next;
}

/** Counts shown next to each choice so the user knows what the file holds. */
export function describeChild(d: ChildData) {
  let school = 0;
  let academy = 0;
  DAYS_OF_WEEK.forEach((day) => {
    school += (d.masterTimetable[day]?.school || []).filter((p) => p.subject.trim()).length;
    academy += (d.masterTimetable[day]?.academy || []).length;
  });
  return {
    school,
    academy,
    schedules: d.schedules.length,
    attendance: Object.keys(d.attendance).length,
    memos: Object.values(d.memos).filter((m) => m?.content?.trim()).length,
    subjects: d.subjectPool.school.length + d.subjectPool.academy.length,
  };
}
