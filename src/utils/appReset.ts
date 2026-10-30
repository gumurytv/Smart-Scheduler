// Settings → 앱 초기화: clear (or restore sample data for) the parts of the planner the user picks.
import {
  DAYS_OF_WEEK,
  DEFAULT_SCHOOL_TIME_CONFIG,
  DEFAULT_WIDGET_CONFIG,
  DailyOverrides,
  MasterTimetable,
  PlannerState,
} from '../types';
import { createInitialPlannerState } from '../data/initialData';

export type ResetPart = 'school' | 'academy' | 'schedules' | 'attendance' | 'memos' | 'profile' | 'settings';
export const RESET_PARTS: ResetPart[] = ['school', 'academy', 'schedules', 'attendance', 'memos', 'profile', 'settings'];

/** 'empty' clears the data; 'sample' puts the example data back. */
export type ResetMode = 'empty' | 'sample';

/** Day-by-day changes (휴강·보강 etc.) without the school or academy side. */
function dropOverrides(overrides: DailyOverrides, side: 'school' | 'academy'): DailyOverrides {
  const next: DailyOverrides = {};
  Object.entries(overrides).forEach(([date, o]) => {
    const rest = { ...o };
    delete rest[side];
    if (rest.school || (rest.academy && rest.academy.length > 0)) next[date] = rest;
  });
  return next;
}

export function resetPlannerParts(prev: PlannerState, parts: ResetPart[], mode: ResetMode): PlannerState {
  const has = (p: ResetPart) => parts.includes(p);
  const sample = createInitialPlannerState(new Date());
  let next: PlannerState = { ...prev };

  if (has('school') || has('academy')) {
    const master = { ...prev.masterTimetable } as MasterTimetable;
    let overrides = prev.dailyOverrides;
    DAYS_OF_WEEK.forEach((d) => {
      const day = prev.masterTimetable[d] || { school: [], academy: [] };
      master[d] = {
        // Clearing keeps the class times so the timetable grid stays in place.
        school: has('school')
          ? mode === 'sample'
            ? (sample.masterTimetable[d]?.school || []).map((p) => ({ ...p }))
            : day.school.map((p) => ({ ...p, subject: '' }))
          : day.school,
        academy: has('academy')
          ? mode === 'sample'
            ? (sample.masterTimetable[d]?.academy || []).map((a) => ({ ...a }))
            : []
          : day.academy,
      };
    });
    if (has('school')) overrides = dropOverrides(overrides, 'school');
    if (has('academy')) overrides = dropOverrides(overrides, 'academy');
    next = { ...next, masterTimetable: master, dailyOverrides: overrides };
    if (has('school') && mode === 'sample') next.schoolTimeConfig = { ...DEFAULT_SCHOOL_TIME_CONFIG };
  }
  if (has('schedules')) next.schedules = mode === 'sample' ? sample.schedules : [];
  if (has('attendance')) next.attendance = mode === 'sample' ? sample.attendance : {};
  if (has('memos')) next.memos = mode === 'sample' ? sample.memos : {};
  if (has('profile')) next.profile = undefined;
  if (has('settings')) {
    // Language stays, so the app doesn't switch under the user.
    next = {
      ...next,
      subjectPool: sample.subjectPool,
      timelineConfig: { startHour: 8, endHour: 24 },
      schoolTimeConfig: { ...DEFAULT_SCHOOL_TIME_CONFIG },
      widgetConfig: { ...DEFAULT_WIDGET_CONFIG, enabled: [...DEFAULT_WIDGET_CONFIG.enabled] },
      textScale: undefined,
      subjectColors: undefined,
      reminders: undefined,
      timetableLayout: undefined,
      medalsEnabled: undefined,
    };
  }
  return next;
}
