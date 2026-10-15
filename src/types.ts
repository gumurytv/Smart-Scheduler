export type DayOfWeek = '월' | '화' | '수' | '목' | '금' | '토' | '일';

export const DAYS_OF_WEEK: DayOfWeek[] = ['월', '화', '수', '목', '금', '토', '일'];

export interface SubjectPool {
  school: string[];
  academy: string[];
}

export interface SchoolPeriod {
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
}

export interface AcademyItem {
  id: string;
  startTime: string;
  endTime: string;
  subject: string;
}

export interface DayMasterTimetable {
  school: SchoolPeriod[];
  academy: AcademyItem[];
}

export type MasterTimetable = Record<DayOfWeek, DayMasterTimetable>;

export interface SchoolPeriodOverride {
  subject: string;
  isCancelled?: boolean;
}

export interface AcademyOverrideItem {
  id: string;
  masterId?: string; // Reference to MasterTimetable academy item if modified from master
  startTime: string;
  endTime: string;
  subject: string;
  isCancelled?: boolean;
  isAdded?: boolean; // True if added as a one-day makeup/special class
  originalSubject?: string;
  originalStartTime?: string;
  originalEndTime?: string;
}

export interface DailyOverride {
  school?: Record<number, SchoolPeriodOverride>;
  academy?: AcademyOverrideItem[];
}

export type DailyOverrides = Record<string, DailyOverride>; // Key: YYYY-MM-DD

export type ScheduleCategory = 'school' | 'academy' | 'other';

export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  category: ScheduleCategory;
  memo: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'cancelled';

export interface AttendanceRecord {
  status: AttendanceStatus;
  reason?: string;
  needsMakeup?: boolean;
  makeupCompleted?: boolean;
}

export interface DailyAttendance {
  school?: AttendanceRecord;
  academies?: Record<string, AttendanceRecord>; // Key: academy subject name
}

export type AttendanceMap = Record<string, DailyAttendance>; // Key: YYYY-MM-DD

export interface DailyMemo {
  content: string;
  updatedAt: string; // ISO string or YYYY-MM-DD HH:MM
}

export type MemoMap = Record<string, DailyMemo>; // Key: YYYY-MM-DD

export interface BackupMeta {
  lastBackupDate: string | null;
}

export type AppLanguage = 'ko' | 'en' | 'zh';

export interface TimelineConfig {
  startHour: number; // e.g. 8 (08:00)
  endHour: number;   // e.g. 24 (24:00)
}

export interface PlannerState {
  language?: AppLanguage;
  subjectPool: SubjectPool;
  masterTimetable: MasterTimetable;
  dailyOverrides: DailyOverrides;
  schedules: ScheduleItem[];
  attendance: AttendanceMap;
  memos: MemoMap;
  backupMeta: BackupMeta;
  timelineConfig: TimelineConfig;
}

export interface AIExtractedEntry {
  id: string;
  day: DayOfWeek;
  type: 'school' | 'academy';
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
}
