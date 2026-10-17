// Settings → 과목/수업 설정: an optional colour per subject, used wherever the subject is shown.
// Pastel background + dark text (readable, AA) + a saturated dot/strip colour.

export type SubjectColorKey =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'sky'
  | 'blue'
  | 'violet'
  | 'pink'
  | 'brown'
  | 'gray';

export interface SubjectColor {
  bg: string;
  fg: string;
  dot: string;
}

export const SUBJECT_COLORS: Record<SubjectColorKey, SubjectColor> = {
  red: { bg: '#FBDAD3', fg: '#7A2617', dot: '#D2553C' },
  orange: { bg: '#FDE3C8', fg: '#7A3D0C', dot: '#E08A3C' },
  yellow: { bg: '#FBF0C2', fg: '#6B5409', dot: '#D6B02A' },
  lime: { bg: '#E6F2C6', fg: '#3F5212', dot: '#8DB33A' },
  green: { bg: '#D5EDD5', fg: '#1F5A2A', dot: '#4A9A5A' },
  teal: { bg: '#CDEDE7', fg: '#145249', dot: '#3A9E8E' },
  sky: { bg: '#D3EAF7', fg: '#164A68', dot: '#3F92C4' },
  blue: { bg: '#D9E0F7', fg: '#22357A', dot: '#5470CC' },
  violet: { bg: '#E6DCF6', fg: '#46287A', dot: '#8A63C9' },
  pink: { bg: '#F8D9E6', fg: '#7A1F48', dot: '#D2568C' },
  brown: { bg: '#EBDCCB', fg: '#5A3A1C', dot: '#9C6B3C' },
  gray: { bg: '#E3DFD8', fg: '#3E3A33', dot: '#8A8378' },
};

export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColorKey[];

/** The colour picked for a subject, or undefined to keep the default sage / terracotta look. */
export function subjectColor(map: Record<string, string> | undefined, subject: string): SubjectColor | undefined {
  const key = map?.[subject];
  return key && key in SUBJECT_COLORS ? SUBJECT_COLORS[key as SubjectColorKey] : undefined;
}
