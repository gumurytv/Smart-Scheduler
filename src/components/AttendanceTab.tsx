import React, { useState, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  CalendarDays,
  CalendarClock,
  X,
  Ban,
  Check,
  CheckCheck,
  ClipboardCheck,
  PartyPopper,
  TrendingUp,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import {
  AttendanceMap,
  AttendanceStatus,
  AttendanceRecord,
  MasterTimetable,
  DailyOverrides,
  SubjectPool,
  DAYS_OF_WEEK,
  AppLanguage,
} from '../types';
import { formatDateKey, getDayOfWeekKor, addDays } from '../data/initialData';
import { resolveDailyTimetable } from '../utils/timetableHelpers';
import {
  tr,
  translateDay,
  translateSubject,
  translateSampleText,
} from '../i18n/translations';

interface AttendanceTabProps {
  language?: AppLanguage;
  attendance: AttendanceMap;
  masterTimetable: MasterTimetable;
  dailyOverrides: DailyOverrides;
  subjectPool?: SubjectPool;
  onUpdateAttendance: (updater: (prev: AttendanceMap) => AttendanceMap) => void;
}

const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'cancelled'];

const STATUS_META: Record<
  AttendanceStatus,
  {
    ko: string;
    en: string;
    zh: string;
    barColor: string;
    btnActive: string;
    Icon: LucideIcon;
    badgeClass: string;
    cssVar: string;
  }
> = {
  present: {
    ko: '출석',
    en: 'Present',
    zh: '出勤',
    barColor: 'bg-sage',
    btnActive: 'bg-sage-700 text-paper',
    Icon: Check,
    badgeClass: 'bg-sage-200 text-sage-800',
    cssVar: 'var(--color-sage)',
  },
  late: {
    ko: '지각',
    en: 'Late',
    zh: '迟到',
    barColor: 'bg-accent-300',
    btnActive: 'bg-accent-300 text-accent-900',
    Icon: Clock,
    badgeClass: 'bg-accent-300 text-accent-900',
    cssVar: 'var(--color-accent-300)',
  },
  absent: {
    ko: '결석',
    en: 'Absent',
    zh: '缺席',
    barColor: 'bg-accent-800',
    btnActive: 'bg-accent-800 text-paper',
    Icon: X,
    badgeClass: 'bg-accent-800 text-paper',
    cssVar: 'var(--color-accent-800)',
  },
  cancelled: {
    ko: '공식휴강',
    en: 'Official Off',
    zh: '官方停课',
    barColor: 'bg-slate-400',
    btnActive: 'bg-slate-400 text-ink',
    Icon: Ban,
    badgeClass: 'bg-slate-200 text-slate-700',
    cssVar: 'var(--color-slate-400)',
  },
};

const statusLabel = (st: AttendanceStatus, lang: AppLanguage) =>
  tr(lang, STATUS_META[st].ko, STATUS_META[st].en, STATUS_META[st].zh);

/** Short legend label (휴강 instead of 공식휴강) */
const statusShortLabel = (st: AttendanceStatus, lang: AppLanguage) =>
  st === 'cancelled' ? tr(lang, '휴강', 'Off', '停课') : statusLabel(st, lang);

export interface DatedAttendanceEntry {
  dateStr: string;
  dayKor: string;
  shortDateLabel: string;
  record: AttendanceRecord;
}

interface StatCounter {
  present: number;
  late: number;
  absent: number;
  cancelled: number;
  totalRecorded: number;
  rate: number;
  lateDays: DatedAttendanceEntry[];
  absentDays: DatedAttendanceEntry[];
  presentDays: DatedAttendanceEntry[];
  cancelledDays: DatedAttendanceEntry[];
}

const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EN_MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const FULL_WEEKDAYS: { ko: string; en: string; zh: string }[] = [
  { ko: '일요일', en: 'Sunday', zh: '星期日' },
  { ko: '월요일', en: 'Monday', zh: '星期一' },
  { ko: '화요일', en: 'Tuesday', zh: '星期二' },
  { ko: '수요일', en: 'Wednesday', zh: '星期三' },
  { ko: '목요일', en: 'Thursday', zh: '星期四' },
  { ko: '금요일', en: 'Friday', zh: '星期五' },
  { ko: '토요일', en: 'Saturday', zh: '星期六' },
];
/** Plot height (px) of the weekly column chart. */
const WEEK_PLOT_H = 92;

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function formatMonthLabel(date: Date, lang: AppLanguage): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return tr(lang, `${y}년 ${m}월`, `${EN_MONTHS[m - 1]} ${y}`, `${y}年${m}月`);
}

function formatDateWithDay(
  dateStr: string,
  lang: AppLanguage
): { dayKor: string; shortDateLabel: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { dayKor: '', shortDateLabel: dateStr };
  const dateObj = new Date(y, m - 1, d);
  const dayKor = getDayOfWeekKor(dateObj);
  const dayLocalized = translateDay(dayKor, lang);
  const shortDateLabel = tr(
    lang,
    `${m}월 ${d}일 (${dayLocalized})`,
    `${EN_MONTHS[m - 1]} ${d} (${dayLocalized})`,
    `${m}月${d}日 (${dayLocalized})`
  );
  return {
    dayKor,
    shortDateLabel,
  };
}

function computeStatsWithDates(
  datedRecords: Array<{ dateStr: string; record: AttendanceRecord }>,
  lang: AppLanguage
): StatCounter {
  let present = 0;
  let late = 0;
  let absent = 0;
  let cancelled = 0;

  const lateDays: DatedAttendanceEntry[] = [];
  const absentDays: DatedAttendanceEntry[] = [];
  const presentDays: DatedAttendanceEntry[] = [];
  const cancelledDays: DatedAttendanceEntry[] = [];

  const sorted = [...datedRecords].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  for (const item of sorted) {
    const { dayKor, shortDateLabel } = formatDateWithDay(item.dateStr, lang);
    const entry: DatedAttendanceEntry = {
      dateStr: item.dateStr,
      dayKor,
      shortDateLabel,
      record: item.record,
    };

    if (item.record.status === 'present') {
      present++;
      presentDays.push(entry);
    } else if (item.record.status === 'late') {
      late++;
      lateDays.push(entry);
    } else if (item.record.status === 'absent') {
      absent++;
      absentDays.push(entry);
    } else if (item.record.status === 'cancelled') {
      cancelled++;
      cancelledDays.push(entry);
    }
  }

  const totalRecorded = present + late + absent + cancelled;
  const effectiveTotal = present + late + absent;
  const rate =
    effectiveTotal > 0 ? Math.round(((present + late) / effectiveTotal) * 1000) / 10 : 100;

  return {
    present,
    late,
    absent,
    cancelled,
    totalRecorded,
    rate,
    lateDays,
    absentDays,
    presentDays,
    cancelledDays,
  };
}

/** Rate is only meaningful when at least one non-cancelled record exists. */
const hasEffective = (s: { present: number; late: number; absent: number }) =>
  s.present + s.late + s.absent > 0;

/* ------------------------------------------------------------------ */
/* Charts (hand-written SVG / CSS)                                     */
/* ------------------------------------------------------------------ */

const StatusDonut: React.FC<{
  lang: AppLanguage;
  title: string;
  icon: React.ReactNode;
  stats: StatCounter;
}> = ({ lang, title, icon, stats }) => {
  const size = 104;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = stats.totalRecorded;
  const counts: Record<AttendanceStatus, number> = {
    present: stats.present,
    late: stats.late,
    absent: stats.absent,
    cancelled: stats.cancelled,
  };
  const nonZero = STATUS_ORDER.filter((st) => counts[st] > 0);
  const gap = nonZero.length > 1 ? 3 : 0;
  const showRate = hasEffective(stats);

  let offset = 0;
  const segments = nonZero.map((st) => {
    const len = (counts[st] / total) * c;
    const seg = {
      st,
      dash: Math.max(0.5, len - gap),
      offset,
      pct: Math.round((counts[st] / total) * 100),
    };
    offset += len;
    return seg;
  });

  const ariaLabel = `${title}: ${tr(lang, '출석률', 'attendance rate', '出勤率')} ${
    showRate ? `${stats.rate}%` : tr(lang, '기록 없음', 'no records', '无记录')
  }. ${STATUS_ORDER.map((st) => `${statusShortLabel(st, lang)} ${counts[st]}`).join(', ')}`;

  return (
    <figure
      className="flex flex-col items-center gap-2.5 min-w-0 rounded-2xl bg-paper p-3"
      aria-label={ariaLabel}
    >
      <figcaption className="self-start flex items-center gap-1.5 text-[0.75rem] font-bold text-ink">
        {icon}
        {title}
      </figcaption>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-slate-200)"
            strokeWidth={stroke}
          />
          {segments.map((seg) => (
            <circle
              key={seg.st}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={STATUS_META[seg.st].cssVar}
              strokeWidth={stroke}
              strokeDasharray={`${seg.dash} ${c - seg.dash}`}
              strokeDashoffset={-seg.offset}
            >
              <title>{`${statusShortLabel(seg.st, lang)} ${counts[seg.st]} (${seg.pct}%)`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[1.375rem] leading-none font-mono tabular-nums text-ink">
            {showRate ? `${Math.round(stats.rate)}%` : '–'}
          </span>
          <span className="text-[0.6875rem] font-semibold text-slate-600 mt-1">
            {tr(lang, '실질 출석률', 'Real rate', '实际出勤率')}
          </span>
        </div>
      </div>
      <ul className="w-full grid grid-cols-2 gap-x-2 gap-y-1 text-[0.6875rem] font-semibold text-slate-700">
        {STATUS_ORDER.map((st) => (
          <li key={st} className="flex items-center gap-1 whitespace-nowrap min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[st].barColor}`} />
            <span className="truncate">{statusShortLabel(st, lang)}</span>
            <span className="ml-auto font-mono tabular-nums text-ink">{counts[st]}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
};

/** Single-value progress ring for the monthly hero stat (real attendance rate). */
const RateRing: React.FC<{ rate: number | null; label: string }> = ({ rate, label }) => {
  const size = 104;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = rate === null ? 0 : Math.max(0, Math.min(100, rate));
  const dash = (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-slate-200)" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-sage-700)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="font-mono tabular-nums text-ink leading-none">
          {rate === null ? (
            <span className="text-[28px]">–</span>
          ) : (
            <>
              <span className="text-[28px]">{Math.round(rate)}</span>
              <span className="text-[0.9375rem]">%</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  language = 'ko',
  attendance,
  masterTimetable,
  dailyOverrides,
  subjectPool,
  onUpdateAttendance,
}) => {
  const lang = language;
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateKey(today), [today]);

  const [cursorMonth, setCursorMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [selectedAcademyDetail, setSelectedAcademyDetail] = useState<string | null>(null);
  // Monthly KPI tile tapped → history sheet (지각 / 결석 / 출석 / 보강 대기)
  const [kpiDetail, setKpiDetail] = useState<'present' | 'late' | 'absent' | 'makeup' | null>(null);
  const checkCardRef = useRef<HTMLElement>(null);

  /** Select a date and keep the shared month cursor (calendar + charts) in sync. */
  const selectDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const d = parseDateKey(dateStr);
    if (
      d.getFullYear() !== cursorMonth.getFullYear() ||
      d.getMonth() !== cursorMonth.getMonth()
    ) {
      setCursorMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const shiftSelectedDate = (delta: number) => {
    const d = parseDateKey(selectedDateStr);
    d.setDate(d.getDate() + delta);
    selectDate(formatDateKey(d));
  };

  const goToday = () => {
    const now = new Date();
    setSelectedDateStr(formatDateKey(now));
    setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const shiftMonth = (delta: number) =>
    setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + delta, 1));

  const monthPrefix = useMemo(() => {
    const y = cursorMonth.getFullYear();
    const m = String(cursorMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [cursorMonth]);

  const isCurrentMonth =
    cursorMonth.getFullYear() === today.getFullYear() &&
    cursorMonth.getMonth() === today.getMonth();

  const monthlyStats = useMemo(() => {
    const schoolDated: Array<{ dateStr: string; record: AttendanceRecord }> = [];
    const academyDatedAll: Array<{ dateStr: string; record: AttendanceRecord }> = [];
    const byAcademyMap: Record<string, Array<{ dateStr: string; record: AttendanceRecord }>> = {};

    const allAcademyNames = new Set<string>();
    if (subjectPool?.academy) {
      subjectPool.academy.forEach((a) => allAcademyNames.add(a));
    }
    DAYS_OF_WEEK.forEach((d) => {
      masterTimetable[d]?.academy?.forEach((ac) => allAcademyNames.add(ac.subject));
    });

    const pendingMakeups: Array<{
      dateStr: string;
      shortDateLabel: string;
      academyName: string;
      status: AttendanceStatus;
      reason?: string;
    }> = [];

    Object.entries(attendance || {}).forEach(([dateStr, dayAtt]) => {
      if (!dayAtt) return;
      if (dayAtt.academies) {
        Object.entries(dayAtt.academies).forEach(([acName, rec]) => {
          allAcademyNames.add(acName);
          if (rec.needsMakeup && !rec.makeupCompleted) {
            const { shortDateLabel } = formatDateWithDay(dateStr, lang);
            pendingMakeups.push({
              dateStr,
              shortDateLabel,
              academyName: acName,
              status: rec.status,
              reason: rec.reason,
            });
          }
        });
      }

      if (!dateStr.startsWith(monthPrefix)) return;

      if (dayAtt.school) {
        schoolDated.push({ dateStr, record: dayAtt.school });
      }

      if (dayAtt.academies) {
        Object.entries(dayAtt.academies).forEach(([acName, rec]) => {
          academyDatedAll.push({ dateStr, record: rec });
          if (!byAcademyMap[acName]) byAcademyMap[acName] = [];
          byAcademyMap[acName].push({ dateStr, record: rec });
        });
      }
    });

    pendingMakeups.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    const perAcademyStats = Array.from(allAcademyNames)
      .map((acName) => {
        const recs = byAcademyMap[acName] || [];
        const pendingForThisAcademy = pendingMakeups.filter(
          (mk) => mk.academyName === acName
        ).length;
        return {
          academyName: acName,
          stats: computeStatsWithDates(recs, lang),
          pendingMakeupCount: pendingForThisAcademy,
        };
      })
      .sort((a, b) => {
        if (a.stats.totalRecorded > 0 && b.stats.totalRecorded === 0) return -1;
        if (a.stats.totalRecorded === 0 && b.stats.totalRecorded > 0) return 1;
        if (a.stats.rate !== b.stats.rate) return a.stats.rate - b.stats.rate;
        return b.stats.absent - a.stats.absent;
      });

    // Weekly trend: calendar rows (Sun-start weeks) of the displayed month, school + academies.
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const weekCount = Math.ceil((startWeekday + totalDays) / 7);
    const weekBuckets: Array<Array<{ dateStr: string; record: AttendanceRecord }>> = Array.from(
      { length: weekCount },
      () => []
    );
    const weekRanges: Array<{ from: number; to: number }> = Array.from(
      { length: weekCount },
      (_, i) => ({
        from: Math.max(1, i * 7 - startWeekday + 1),
        to: Math.min(totalDays, i * 7 - startWeekday + 7),
      })
    );
    [...schoolDated, ...academyDatedAll].forEach((item) => {
      const day = Number(item.dateStr.slice(8, 10));
      const idx = Math.floor((day + startWeekday - 1) / 7);
      if (weekBuckets[idx]) weekBuckets[idx].push(item);
    });
    const weekly = weekBuckets.map((bucket, i) => ({
      index: i,
      range: weekRanges[i],
      stats: computeStatsWithDates(bucket, lang),
    }));

    return {
      school: computeStatsWithDates(schoolDated, lang),
      academyTotal: computeStatsWithDates(academyDatedAll, lang),
      combined: computeStatsWithDates([...schoolDated, ...academyDatedAll], lang),
      perAcademyStats,
      pendingMakeups,
      weekly,
    };
  }, [attendance, monthPrefix, cursorMonth, subjectPool, masterTimetable, lang]);

  const activeAcademyDetailObj = useMemo(() => {
    if (!selectedAcademyDetail) return null;
    return (
      monthlyStats.perAcademyStats.find((item) => item.academyName === selectedAcademyDetail) ||
      null
    );
  }, [selectedAcademyDetail, monthlyStats.perAcademyStats]);

  const calendarCells = useMemo(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const extractAcademyRecords = (dateStr: string) => {
      const dayAtt = attendance?.[dateStr];
      if (!dayAtt?.academies) return [];
      const entries = Object.entries(dayAtt.academies).map(([name, record]) => ({
        name,
        record,
      }));
      if (!selectedAcademyDetail) return entries;
      return entries.filter((e) => e.name === selectedAcademyDetail);
    };

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      schoolRecord?: AttendanceRecord;
      academyRecords: Array<{ name: string; record: AttendanceRecord }>;
    }> = [];

    const pushCell = (d: Date, inMonth: boolean) => {
      const dateStr = formatDateKey(d);
      const dayAtt = attendance?.[dateStr];
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: inMonth,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        schoolRecord: dayAtt?.school,
        academyRecords: extractAcademyRecords(dateStr),
      });
    };

    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      pushCell(new Date(year, month - 1, prevMonthLast - i), false);
    }
    for (let day = 1; day <= totalDays; day++) {
      pushCell(new Date(year, month, day), true);
    }
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      pushCell(new Date(year, month + 1, i), false);
    }

    return cells;
  }, [cursorMonth, attendance, todayStr, selectedDateStr, selectedAcademyDetail]);

  const selectedDayResolved = useMemo(() => {
    const resolved = resolveDailyTimetable(selectedDateStr, masterTimetable, dailyOverrides);
    const dayAtt = attendance?.[selectedDateStr] || {};

    const academyNamesSet = new Set<string>();
    resolved.academy.forEach((ac) => academyNamesSet.add(ac.subject));
    if (dayAtt.academies) {
      Object.keys(dayAtt.academies).forEach((name) => academyNamesSet.add(name));
    }

    const hasSchoolSchedule = resolved.school.length > 0 || Boolean(dayAtt.school);

    return {
      dayOfWeek: resolved.dayOfWeek,
      hasSchoolSchedule,
      schoolPeriodsCount: resolved.school.length,
      academyList: Array.from(academyNamesSet).map((acName) => {
        const timetableInfo = resolved.academy.find((a) => a.subject === acName);
        return {
          name: acName,
          timeLabel: timetableInfo
            ? `${timetableInfo.startTime} ~ ${timetableInfo.endTime}`
            : tr(lang, '기록된 학원', 'Recorded Academy', '已记录补习班'),
          isCancelledOnTimetable: Boolean(timetableInfo?.isCancelled),
          record: dayAtt.academies?.[acName],
        };
      }),
      schoolRecord: dayAtt.school,
    };
  }, [selectedDateStr, masterTimetable, dailyOverrides, attendance, lang]);

  const handleSetSchoolStatus = (status: AttendanceStatus | null) => {
    onUpdateAttendance((prev) => {
      const next = { ...prev };
      const dayAtt = { ...(next[selectedDateStr] || {}) };
      if (status === null) {
        delete dayAtt.school;
      } else {
        const existing = dayAtt.school || { status };
        dayAtt.school = {
          ...existing,
          status,
        };
      }
      next[selectedDateStr] = dayAtt;
      return next;
    });
  };

  const handleSetSchoolReason = (reason: string) => {
    onUpdateAttendance((prev) => {
      const next = { ...prev };
      const dayAtt = { ...(next[selectedDateStr] || {}) };
      if (!dayAtt.school) return prev;
      dayAtt.school = { ...dayAtt.school, reason };
      next[selectedDateStr] = dayAtt;
      return next;
    });
  };

  const handleSetAcademyStatus = (academyName: string, status: AttendanceStatus | null) => {
    onUpdateAttendance((prev) => {
      const next = { ...prev };
      const dayAtt = { ...(next[selectedDateStr] || {}) };
      const academies = { ...(dayAtt.academies || {}) };

      if (status === null) {
        delete academies[academyName];
      } else {
        const existing = academies[academyName] || { status };
        academies[academyName] = {
          ...existing,
          status,
          needsMakeup:
            status === 'absent' || status === 'late'
              ? existing.needsMakeup ?? (status === 'absent')
              : false,
        };
      }

      dayAtt.academies = academies;
      next[selectedDateStr] = dayAtt;
      return next;
    });
  };

  const handleUpdateAcademyDetail = (
    dateStr: string,
    academyName: string,
    patch: Partial<AttendanceRecord>
  ) => {
    onUpdateAttendance((prev) => {
      const next = { ...prev };
      const dayAtt = { ...(next[dateStr] || {}) };
      const academies = { ...(dayAtt.academies || {}) };
      const existing = academies[academyName];
      if (!existing) return prev;
      academies[academyName] = { ...existing, ...patch };
      dayAtt.academies = academies;
      next[dateStr] = dayAtt;
      return next;
    });
  };

  /** One tap: fill every not-yet-recorded class of the selected day (timetable-cancelled academies → 휴강). */
  const handleMarkAllPresent = () => {
    const day = selectedDayResolved;
    onUpdateAttendance((prev) => {
      const next = { ...prev };
      const dayAtt = { ...(next[selectedDateStr] || {}) };
      if (day.schoolPeriodsCount > 0 && !dayAtt.school) {
        dayAtt.school = { status: 'present' };
      }
      const academies = { ...(dayAtt.academies || {}) };
      day.academyList.forEach((ac) => {
        if (!academies[ac.name]) {
          academies[ac.name] = {
            status: ac.isCancelledOnTimetable ? 'cancelled' : 'present',
            needsMakeup: false,
          };
        }
      });
      dayAtt.academies = academies;
      next[selectedDateStr] = dayAtt;
      return next;
    });
  };

  const monthLabel = formatMonthLabel(cursorMonth, lang);
  const isSelectedToday = selectedDateStr === todayStr;
  const selectedDateObj = parseDateKey(selectedDateStr);

  const calendarWeekHeader = (['일', '월', '화', '수', '목', '금', '토'] as const).map((d) =>
    tr(lang, d, translateDay(d, 'en'), translateDay(d, 'zh').replace('周', ''))
  );

  const countUnit = (n: number) => tr(lang, `${n}회`, `${n}`, `${n}次`);

  /* ---- Day progress (selected day) ---- */
  const dayTotalClasses =
    (selectedDayResolved.hasSchoolSchedule ? 1 : 0) + selectedDayResolved.academyList.length;
  const dayRecordedClasses =
    (selectedDayResolved.schoolRecord ? 1 : 0) +
    selectedDayResolved.academyList.filter((ac) => Boolean(ac.record)).length;
  const dayFillable =
    (selectedDayResolved.schoolPeriodsCount > 0 && !selectedDayResolved.schoolRecord ? 1 : 0) +
    selectedDayResolved.academyList.filter((ac) => !ac.record).length;
  const dayProgressPct =
    dayTotalClasses > 0 ? Math.round((dayRecordedClasses / dayTotalClasses) * 100) : 0;
  const dayAllDone = dayTotalClasses > 0 && dayRecordedClasses >= dayTotalClasses;

  const daySummary =
    dayTotalClasses === 0
      ? tr(lang, '이 날은 기록할 수업이 없어요', 'No classes to record this day', '这天没有需要登记的课程')
      : dayAllDone
      ? isSelectedToday
        ? tr(lang, '오늘 수업 모두 기록 완료!', "All of today's classes recorded!", '今天的课程已全部登记！')
        : tr(lang, '이 날 수업 모두 기록 완료!', 'All classes recorded!', '当天课程已全部登记！')
      : isSelectedToday
      ? tr(
          lang,
          `오늘 ${dayTotalClasses}개 중 ${dayRecordedClasses}개 기록됨`,
          `${dayRecordedClasses} of ${dayTotalClasses} recorded today`,
          `今天 ${dayTotalClasses} 节中已登记 ${dayRecordedClasses} 节`
        )
      : tr(
          lang,
          `이 날 ${dayTotalClasses}개 중 ${dayRecordedClasses}개 기록됨`,
          `${dayRecordedClasses} of ${dayTotalClasses} recorded`,
          `当天 ${dayTotalClasses} 节中已登记 ${dayRecordedClasses} 节`
        );

  /* ---- Week strip (Mon–Sun around the selected day) ---- */
  const weekDays = (() => {
    const offset = (selectedDateObj.getDay() + 6) % 7;
    const monday = addDays(selectedDateObj, -offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      const key = formatDateKey(d);
      const dayAtt = attendance?.[key];
      return {
        key,
        date: d,
        isToday: key === todayStr,
        isSelected: key === selectedDateStr,
        school: dayAtt?.school?.status,
        academies: Object.values(dayAtt?.academies || {}).map((r) => r.status),
      };
    });
  })();

  /* ---- Monthly hero ---- */
  const combined = monthlyStats.combined;
  const combinedEff = combined.present + combined.late + combined.absent;
  const combinedHas = hasEffective(combined);
  const heroMessage = !combinedHas
    ? tr(lang, '아직 이 달 기록이 없어요', 'No records this month yet', '本月还没有记录')
    : combined.rate >= 95
    ? tr(lang, '아주 훌륭해요!', 'Excellent!', '非常棒！')
    : combined.rate >= 85
    ? tr(lang, '잘하고 있어요', 'Doing well', '表现不错')
    : tr(lang, '조금만 더 힘내요', 'Keep going', '再加把劲');

  const kpis: Array<{
    key: string;
    label: string;
    value: number;
    icon: React.ReactNode;
    iconWrap: string;
    valueColor: string;
  }> = [
    {
      key: 'present',
      label: statusShortLabel('present', lang),
      value: combined.present,
      icon: <Check strokeWidth={3} className="w-3.5 h-3.5" />,
      iconWrap: 'bg-sage-200 text-sage-800',
      valueColor: 'text-sage-700',
    },
    {
      key: 'late',
      label: statusShortLabel('late', lang),
      value: combined.late,
      icon: <Clock strokeWidth={2.75} className="w-3.5 h-3.5" />,
      iconWrap: 'bg-accent-300 text-accent-900',
      valueColor: 'text-accent-700',
    },
    {
      key: 'absent',
      label: statusShortLabel('absent', lang),
      value: combined.absent,
      icon: <X strokeWidth={3} className="w-3.5 h-3.5" />,
      iconWrap: 'bg-accent-800 text-paper',
      valueColor: 'text-accent-800',
    },
    {
      key: 'makeup',
      label: tr(lang, '보강 대기', 'Makeup due', '待补课'),
      value: monthlyStats.pendingMakeups.length,
      icon: <CalendarClock strokeWidth={2.5} className="w-3.5 h-3.5" />,
      iconWrap: 'bg-accent-100 text-accent-700',
      valueColor: 'text-accent-700',
    },
  ];

  /* ---- KPI history (sheet opened from the monthly tiles) ---- */
  type KpiRow = {
    key: string;
    dateStr: string;
    who: string;
    isSchool: boolean;
    status: AttendanceStatus;
    reason?: string;
    makeup?: 'pending' | 'done';
  };
  const kpiRows: KpiRow[] = (() => {
    if (!kpiDetail) return [];
    if (kpiDetail === 'makeup') {
      return monthlyStats.pendingMakeups.map((mk) => ({
        key: `${mk.dateStr}-${mk.academyName}`,
        dateStr: mk.dateStr,
        who: translateSubject(mk.academyName, lang),
        isSchool: false,
        status: mk.status,
        reason: mk.reason,
        makeup: 'pending' as const,
      }));
    }
    const rows: KpiRow[] = [];
    Object.entries(attendance || {}).forEach(([dateStr, dayAtt]) => {
      if (!dayAtt || !dateStr.startsWith(monthPrefix)) return;
      if (dayAtt.school?.status === kpiDetail) {
        rows.push({
          key: `${dateStr}-school`,
          dateStr,
          who: tr(lang, '학교', 'School', '学校'),
          isSchool: true,
          status: dayAtt.school.status,
          reason: dayAtt.school.reason,
        });
      }
      Object.entries(dayAtt.academies || {}).forEach(([acName, rec]) => {
        if (rec.status !== kpiDetail) return;
        rows.push({
          key: `${dateStr}-${acName}`,
          dateStr,
          who: translateSubject(acName, lang),
          isSchool: false,
          status: rec.status,
          reason: rec.reason,
          makeup: rec.needsMakeup ? (rec.makeupCompleted ? 'done' : 'pending') : undefined,
        });
      });
    });
    return rows.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  })();
  const kpiTitle =
    kpiDetail === 'makeup'
      ? tr(lang, '보강 대기 목록', 'Makeups due', '待补课列表')
      : kpiDetail
      ? tr(
          lang,
          `${monthLabel} ${statusShortLabel(kpiDetail, lang)} 이력`,
          `${monthLabel} · ${statusShortLabel(kpiDetail, lang)}`,
          `${monthLabel} ${statusShortLabel(kpiDetail, lang)}记录`
        )
      : '';

  /* ---- Shared UI pieces ---- */
  const navBtn =
    'w-[34px] h-[34px] rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 active:scale-95 transition-transform shrink-0';

  const renderStatusControl = (
    groupLabel: string,
    current: AttendanceStatus | undefined,
    onPick: (st: AttendanceStatus) => void
  ) => (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-surface"
    >
      {STATUS_ORDER.map((st) => {
        const meta = STATUS_META[st];
        const Icon = meta.Icon;
        const isSelected = current === st;
        return (
          <button
            key={st}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={statusLabel(st, lang)}
            onClick={() => onPick(st)}
            className={`min-h-[50px] min-w-0 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[0.75rem] font-bold transition-all active:scale-[0.97] ${
              isSelected ? `${meta.btnActive} shadow-xs` : 'text-slate-700 hover:bg-paper'
            }`}
          >
            <Icon strokeWidth={isSelected ? 3 : 2.5} className="w-4 h-4 shrink-0" />
            <span className="max-w-full truncate leading-tight">{statusShortLabel(st, lang)}</span>
          </button>
        );
      })}
    </div>
  );

  const reasonInputClass =
    'w-full h-10 px-4 rounded-full border border-divider bg-surface text-[0.75rem] text-ink placeholder:text-slate-500 focus:outline-none focus:border-accent';

  const clearButton = (onClear: () => void, label: string) => (
    <button
      type="button"
      onClick={onClear}
      title={tr(lang, '초기화', 'Clear', '重置')}
      aria-label={`${label} ${tr(lang, '초기화', 'clear', '重置')}`}
      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-ink hover:bg-surface shrink-0"
    >
      <RotateCcw strokeWidth={2.5} className="w-3.5 h-3.5" />
    </button>
  );

  const unrecordedChip = (
    <span className="px-2 py-0.5 rounded-full bg-surface text-[0.6875rem] font-semibold text-slate-600 whitespace-nowrap shrink-0">
      {tr(lang, '미기록', 'Not set', '未登记')}
    </span>
  );

  const monthNav = (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => shiftMonth(-1)}
        className={navBtn}
        aria-label={tr(lang, '이전 달', 'Previous month', '上个月')}
      >
        <ChevronLeft strokeWidth={2.75} className="w-3.5 h-3.5" />
      </button>
      <span className="min-w-[84px] text-center text-[0.875rem] font-mono tabular-nums text-ink whitespace-nowrap">
        {monthLabel}
      </span>
      <button
        type="button"
        onClick={() => shiftMonth(1)}
        className={navBtn}
        aria-label={tr(lang, '다음 달', 'Next month', '下个月')}
      >
        <ChevronRight strokeWidth={2.75} className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const legendChip = (st: AttendanceStatus, shape: 'dot' | 'bar' = 'dot') => (
    <span
      key={st}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-paper text-[0.6875rem] font-semibold text-slate-700 whitespace-nowrap"
    >
      <span
        className={`${shape === 'bar' ? 'w-3 h-1.5' : 'w-2 h-2'} rounded-full ${STATUS_META[st].barColor}`}
        aria-hidden="true"
      />
      {statusShortLabel(st, lang)}
    </span>
  );

  const schoolRec = selectedDayResolved.schoolRecord;
  const schoolLabel = tr(lang, '학교', 'School', '学校');

  return (
    <div className="space-y-4">
      {/* 1. SELECTED-DAY (DEFAULT: TODAY) 1-TOUCH ATTENDANCE CHECK */}
      <section
        ref={checkCardRef}
        className="bg-surface rounded-2xl shadow-xs p-4 space-y-3.5 scroll-mt-4"
      >
        {/* Title row */}
        <div className="flex items-center gap-1.5 min-w-0">
          <ClipboardCheck strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
          <h2 className="text-[0.8125rem] font-bold text-ink truncate">
            {isSelectedToday
              ? tr(lang, '오늘 출석 체크', "Today's Attendance", '今日出勤登记')
              : tr(lang, '출석 체크', 'Attendance Check', '出勤登记')}
          </h2>
        </div>

        {/* Date hero */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0" aria-live="polite">
            <span className="font-mono text-[48px] leading-none tabular-nums text-ink">
              {selectedDateObj.getDate()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-[0.9375rem] font-bold text-ink truncate">
                  {tr(
                    lang,
                    `${selectedDateObj.getMonth() + 1}월`,
                    EN_MONTHS_FULL[selectedDateObj.getMonth()],
                    `${selectedDateObj.getMonth() + 1}月`
                  )}
                </span>
                {isSelectedToday && (
                  <span className="px-2 py-px rounded-full text-[0.6875rem] font-bold bg-accent-700 text-paper whitespace-nowrap">
                    {tr(lang, '오늘', 'TODAY', '今天')}
                  </span>
                )}
              </div>
              <div className="text-[0.75rem] font-semibold text-slate-600 truncate">
                {(() => {
                  const w = FULL_WEEKDAYS[selectedDateObj.getDay()];
                  return `${tr(lang, w.ko, w.en, w.zh)} · ${selectedDateObj.getFullYear()}`;
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => shiftSelectedDate(-1)}
              className={navBtn}
              aria-label={tr(lang, '이전 날', 'Previous day', '前一天')}
            >
              <ChevronLeft strokeWidth={2.75} className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={goToday}
              disabled={isSelectedToday}
              className={`px-3 h-[34px] rounded-full text-[0.75rem] font-bold whitespace-nowrap transition-colors ${
                isSelectedToday
                  ? 'bg-paper/60 text-slate-500 cursor-default'
                  : 'bg-accent-700 text-paper hover:bg-accent-800'
              }`}
            >
              {tr(lang, '오늘', 'Today', '今天')}
            </button>
            <button
              type="button"
              onClick={() => shiftSelectedDate(1)}
              className={navBtn}
              aria-label={tr(lang, '다음 날', 'Next day', '后一天')}
            >
              <ChevronRight strokeWidth={2.75} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Week strip (Mon–Sun) with status marks: bar = school, dots = academies */}
        <div
          className="grid grid-cols-7 gap-1"
          role="group"
          aria-label={tr(lang, '이번 주', 'This week', '本周')}
        >
          {weekDays.map((day) => {
            const tone = day.isSelected
              ? 'bg-accent-700 text-paper'
              : day.isToday
              ? 'bg-paper ring-[1.5px] ring-inset ring-accent text-accent-800'
              : 'bg-paper/70 text-ink hover:bg-paper';
            const ring = day.isSelected ? 'ring-1 ring-paper' : '';
            const aria = [
              formatDateWithDay(day.key, lang).shortDateLabel,
              day.school ? `${schoolLabel} ${statusLabel(day.school, lang)}` : '',
              day.academies.length > 0
                ? `${tr(lang, '학원', 'Academy', '补习班')} ${day.academies
                    .map((s) => statusShortLabel(s, lang))
                    .join('/')}`
                : '',
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => selectDate(day.key)}
                aria-pressed={day.isSelected}
                aria-label={aria}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors min-w-0 ${tone}`}
              >
                <span
                  className={`text-[0.6875rem] font-semibold leading-tight ${
                    day.isSelected ? 'text-paper/90' : day.isToday ? 'text-accent-800' : 'text-slate-600'
                  }`}
                >
                  {translateDay(KO_WEEKDAYS[day.date.getDay()], lang)}
                </span>
                <span className="font-mono text-[1rem] leading-none tabular-nums">
                  {day.date.getDate()}
                </span>
                <span className="h-1.5 flex items-center gap-[3px]" aria-hidden="true">
                  {day.school && (
                    <span className={`w-3 h-1.5 rounded-full ${STATUS_META[day.school].barColor} ${ring}`} />
                  )}
                  {day.academies.slice(0, 3).map((s, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s].barColor} ${ring}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Day progress + quick action */}
        <div className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-slate-700">
              {dayAllDone && <CheckCircle2 strokeWidth={2.75} className="w-3.5 h-3.5 text-sage-700 shrink-0" />}
              <span className="truncate">{daySummary}</span>
            </div>
            {dayTotalClasses > 0 && (
              <div
                className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={dayTotalClasses}
                aria-valuenow={dayRecordedClasses}
                aria-label={tr(lang, '기록 진행률', 'Recorded progress', '登记进度')}
              >
                <div
                  className="h-full rounded-full bg-sage-700 transition-[width] duration-300"
                  style={{ width: `${dayProgressPct}%` }}
                />
              </div>
            )}
          </div>
          {dayFillable > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="h-9 px-3.5 rounded-full bg-sage-700 text-paper text-[0.75rem] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-sage-800 active:scale-95 transition-transform"
              title={tr(
                lang,
                '아직 기록하지 않은 수업을 모두 출석으로',
                'Mark every unrecorded class present',
                '将未登记课程全部记为出勤'
              )}
            >
              <CheckCheck strokeWidth={2.75} className="w-4 h-4" />
              {dayRecordedClasses > 0
                ? tr(lang, '나머지 출석', 'Rest present', '其余出勤')
                : tr(lang, '모두 출석', 'All present', '全部出勤')}
            </button>
          )}
        </div>

        {/* Class rows */}
        <div className="space-y-2.5">
          {/* School */}
          <div className="relative rounded-2xl bg-paper p-3 pl-4 space-y-2.5 overflow-hidden">
            <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-sage" aria-hidden="true" />
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-sage-200 text-sage-800 flex items-center justify-center shrink-0">
                <GraduationCap strokeWidth={2.5} className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[0.875rem] font-bold text-ink truncate">{schoolLabel}</div>
                <div className="text-[0.6875rem] font-semibold text-slate-600 truncate">
                  {selectedDayResolved.schoolPeriodsCount > 0
                    ? tr(
                        lang,
                        `${selectedDayResolved.schoolPeriodsCount}교시 수업일`,
                        `${selectedDayResolved.schoolPeriodsCount} periods`,
                        `${selectedDayResolved.schoolPeriodsCount}节课`
                      )
                    : tr(lang, '주말 · 정규수업 없음', 'No regular classes', '周末 · 无常规课')}
                </div>
              </div>
              {schoolRec ? clearButton(() => handleSetSchoolStatus(null), schoolLabel) : unrecordedChip}
            </div>

            {renderStatusControl(
              tr(lang, '학교 출석 상태', 'School status', '学校出勤状态'),
              schoolRec?.status,
              (st) => handleSetSchoolStatus(st)
            )}

            {schoolRec && schoolRec.status !== 'present' && (
              <input
                type="text"
                aria-label={tr(lang, '학교 사유', 'School reason', '学校原因')}
                placeholder={
                  schoolRec.status === 'cancelled'
                    ? tr(lang, '휴강 사유 (예: 개교기념일)', 'Reason for day off (e.g. School holiday)', '停课原因（如：校庆放假）')
                    : tr(lang, '사유 입력 (예: 병원 진료)', 'Reason (e.g. Clinic visit)', '原因（如：医院就诊）')
                }
                value={schoolRec.reason || ''}
                onChange={(e) => handleSetSchoolReason(e.target.value)}
                className={reasonInputClass}
              />
            )}
          </div>

          {/* Academies */}
          {selectedDayResolved.academyList.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-divider px-3.5 py-3 text-[0.75rem] text-slate-600">
              <Building2 strokeWidth={2.5} className="w-4 h-4 text-slate-500 shrink-0" />
              {tr(
                lang,
                '이 날짜에 배정된 학원 수업이 없어요',
                'No academy classes scheduled for this day',
                '该日期未安排补习班课程'
              )}
            </div>
          ) : (
            selectedDayResolved.academyList.map((ac) => {
              const rec = ac.record;
              const name = translateSubject(ac.name, lang);
              return (
                <div
                  key={ac.name}
                  className="relative rounded-2xl bg-paper p-3 pl-4 space-y-2.5 overflow-hidden"
                >
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-accent" aria-hidden="true" />
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-accent-200 text-accent-800 flex items-center justify-center shrink-0">
                      <Building2 strokeWidth={2.5} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[0.875rem] font-bold text-ink truncate">{name}</span>
                        {ac.isCancelledOnTimetable && (
                          <span className="px-1.5 py-px rounded-full bg-slate-200 text-slate-700 text-[0.6875rem] font-semibold whitespace-nowrap shrink-0">
                            {tr(lang, '시간표 휴강', 'Off on timetable', '课表停课')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[0.6875rem] font-semibold text-slate-600 min-w-0">
                        <Clock strokeWidth={2.5} className="w-3 h-3 shrink-0" />
                        <span className="font-mono tabular-nums truncate">{ac.timeLabel}</span>
                      </div>
                    </div>
                    {rec ? clearButton(() => handleSetAcademyStatus(ac.name, null), name) : unrecordedChip}
                  </div>

                  {renderStatusControl(
                    `${name} ${tr(lang, '출석 상태', 'status', '出勤状态')}`,
                    rec?.status,
                    (st) => handleSetAcademyStatus(ac.name, st)
                  )}

                  {rec && rec.status !== 'present' && (
                    <input
                      type="text"
                      aria-label={tr(lang, '학원 사유', 'Academy reason', '补习班原因')}
                      placeholder={
                        rec.status === 'cancelled'
                          ? tr(lang, '휴강 사유 (예: 선생님 사정)', 'Reason for day off', '停课原因')
                          : tr(lang, '사유 입력 (예: 학교 행사, 감기)', 'Reason (e.g. School event, Cold)', '原因（如：学校活动、感冒）')
                      }
                      value={rec.reason || ''}
                      onChange={(e) =>
                        handleUpdateAcademyDetail(selectedDateStr, ac.name, {
                          reason: e.target.value,
                        })
                      }
                      className={reasonInputClass}
                    />
                  )}

                  {rec && (rec.status === 'absent' || rec.status === 'late') && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        aria-pressed={Boolean(rec.needsMakeup)}
                        onClick={() =>
                          handleUpdateAcademyDetail(selectedDateStr, ac.name, {
                            needsMakeup: !rec.needsMakeup,
                            makeupCompleted: !rec.needsMakeup ? Boolean(rec.makeupCompleted) : false,
                          })
                        }
                        className={`h-8 px-3 rounded-full text-[0.75rem] font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                          rec.needsMakeup
                            ? 'bg-accent-700 text-paper hover:bg-accent-800'
                            : 'border border-divider text-slate-700 hover:bg-surface'
                        }`}
                      >
                        <CalendarClock strokeWidth={2.5} className="w-3.5 h-3.5" />
                        {tr(lang, '보강 필요', 'Needs makeup', '需要补课')}
                      </button>
                      {rec.needsMakeup && (
                        <button
                          type="button"
                          aria-pressed={Boolean(rec.makeupCompleted)}
                          onClick={() =>
                            handleUpdateAcademyDetail(selectedDateStr, ac.name, {
                              makeupCompleted: !rec.makeupCompleted,
                            })
                          }
                          className={`h-8 px-3 rounded-full text-[0.75rem] font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                            rec.makeupCompleted
                              ? 'bg-sage-700 text-paper hover:bg-sage-800'
                              : 'border border-divider text-slate-700 hover:bg-surface'
                          }`}
                        >
                          <Check strokeWidth={3} className="w-3.5 h-3.5" />
                          {rec.makeupCompleted
                            ? tr(lang, '보강 완료됨', 'Makeup done', '已完成补课')
                            : tr(lang, '보강 완료 표시', 'Mark makeup done', '标记补课完成')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2. PENDING MAKEUPS (right after today's check) */}
      {monthlyStats.pendingMakeups.length === 0 ? (
        <section className="rounded-2xl shadow-xs bg-sage-100 px-4 py-3.5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-sage-700 text-paper flex items-center justify-center shrink-0">
            <PartyPopper strokeWidth={2.5} className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[0.8125rem] font-bold text-sage-900">
              {tr(lang, '밀린 보강이 없어요', 'No pending makeups', '没有待补的课')}
            </h2>
            <p className="text-[0.75rem] text-sage-800">
              {tr(lang, '모든 보강을 마쳤어요. 멋져요!', 'All makeups are done. Nice!', '所有补课都已完成，真棒！')}
            </p>
          </div>
        </section>
      ) : (
        <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
              <h2 className="text-[0.8125rem] font-bold text-ink truncate">
                {tr(lang, '미완료 보강', 'Pending makeups', '未完成补课')}
              </h2>
              <span className="px-2 py-px rounded-full bg-accent-700 text-paper text-[0.6875rem] font-bold tabular-nums">
                {tr(
                  lang,
                  `${monthlyStats.pendingMakeups.length}건`,
                  `${monthlyStats.pendingMakeups.length}`,
                  `${monthlyStats.pendingMakeups.length}项`
                )}
              </span>
            </div>
            <span className="text-[0.6875rem] text-slate-600 text-right">
              {tr(lang, '보강하면 완료를 눌러요', 'Tap done after makeup', '补课后点击完成')}
            </span>
          </div>

          <ul className="space-y-2">
            {monthlyStats.pendingMakeups.map((mk) => (
              <li
                key={`${mk.dateStr}-${mk.academyName}`}
                className="relative rounded-2xl bg-paper p-3 pl-4 flex items-center gap-3 overflow-hidden"
              >
                <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-accent" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    selectDate(mk.dateStr);
                    setSelectedAcademyDetail(mk.academyName);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-[0.875rem] font-bold text-ink truncate">
                    {translateSubject(mk.academyName, lang)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface text-[0.6875rem] font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      <Calendar strokeWidth={2.5} className="w-3 h-3" />
                      {mk.shortDateLabel}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold whitespace-nowrap ${STATUS_META[mk.status].badgeClass}`}
                    >
                      {statusShortLabel(mk.status, lang)}
                    </span>
                  </div>
                  {mk.reason && (
                    <p className="mt-1 text-[0.75rem] text-slate-600 truncate">
                      {tr(lang, '사유: ', 'Reason: ', '原因：')}
                      {translateSampleText(mk.reason, lang)}
                    </p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateAcademyDetail(mk.dateStr, mk.academyName, {
                      makeupCompleted: true,
                    })
                  }
                  className="h-10 px-3.5 rounded-full bg-sage-700 text-paper text-[0.75rem] font-bold inline-flex items-center gap-1.5 hover:bg-sage-800 active:scale-95 transition-transform shrink-0 whitespace-nowrap"
                >
                  <Check strokeWidth={3} className="w-4 h-4" />
                  {tr(lang, '보강 완료', 'Done', '补课完成')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. MONTHLY ATTENDANCE OVERVIEW (follows the calendar's month) */}
      <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[0.8125rem] font-bold text-ink flex items-center gap-1.5">
              <BarChart3 strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
              <span className="truncate">
                {tr(lang, `${monthLabel} 출석 현황`, `${monthLabel} Attendance`, `${monthLabel} 出勤概况`)}
              </span>
            </h2>
            <p className="text-[0.6875rem] text-slate-600 mt-0.5">
              {tr(
                lang,
                '공식휴강은 출석률에서 제외 · 아래 달력과 같은 달',
                'Official Off excluded · Same month as the calendar',
                '官方停课不计入 · 与下方日历同月'
              )}
            </p>
          </div>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goToday}
              className="px-3 h-8 rounded-full bg-accent-700 text-paper text-[0.75rem] font-bold whitespace-nowrap shrink-0 hover:bg-accent-800"
            >
              {tr(lang, '이번 달', 'This month', '本月')}
            </button>
          )}
        </div>

        {/* Hero stat: real attendance rate */}
        <div className="flex items-center gap-4 rounded-2xl bg-paper p-4">
          <RateRing
            rate={combinedHas ? combined.rate : null}
            label={`${tr(lang, '실질 출석률', 'Real attendance rate', '实际出勤率')} ${
              combinedHas ? `${combined.rate}%` : tr(lang, '기록 없음', 'no records', '无记录')
            }`}
          />
          <div className="min-w-0">
            <div className="text-[0.75rem] font-bold text-slate-600">
              {tr(lang, '실질 출석률 · 학교+학원', 'Real rate · school + academies', '实际出勤率 · 学校+补习班')}
            </div>
            <div className="text-[1.0625rem] font-bold text-ink mt-0.5">{heroMessage}</div>
            <div className="text-[0.6875rem] text-slate-600 mt-1 leading-snug">
              {tr(
                lang,
                `출석·지각 ${combined.present + combined.late} / ${combinedEff}회`,
                `Present+late ${combined.present + combined.late} of ${combinedEff}`,
                `出勤+迟到 ${combined.present + combined.late} / ${combinedEff}次`
              )}
              {combined.cancelled > 0 &&
                tr(
                  lang,
                  ` · 휴강 ${combined.cancelled}회 제외`,
                  ` · ${combined.cancelled} off excluded`,
                  ` · 扣除停课${combined.cancelled}次`
                )}
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-4 gap-1.5">
          {kpis.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKpiDetail(k.key as 'present' | 'late' | 'absent' | 'makeup')}
              aria-label={tr(lang, `${k.label} 이력 보기`, `Show ${k.label} history`, `查看${k.label}记录`)}
              className="px-2 py-2.5 rounded-2xl bg-paper min-w-0 flex flex-col items-center text-center hover:bg-slate-100 active:scale-[0.97] transition-transform"
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${k.iconWrap}`} aria-hidden="true">
                {k.icon}
              </span>
              <div className={`text-[1.375rem] leading-tight font-mono tabular-nums mt-1 ${k.valueColor}`}>
                {k.value}
              </div>
              <div className="text-[0.6875rem] font-semibold text-slate-600 max-w-full truncate">{k.label}</div>
            </button>
          ))}
        </div>

        <p className="-mt-1 text-[0.625rem] text-slate-500 text-center">
          {tr(lang, '숫자를 누르면 날짜별 이력을 볼 수 있어요', 'Tap a number to see the dates', '点击数字可查看每日记录')}
        </p>

        {/* Status distribution donuts */}
        <div className="grid grid-cols-2 gap-2">
          <StatusDonut
            lang={lang}
            title={tr(lang, '학교', 'School', '学校')}
            icon={<GraduationCap strokeWidth={2.5} className="w-3.5 h-3.5 text-sage-700" />}
            stats={monthlyStats.school}
          />
          <StatusDonut
            lang={lang}
            title={tr(lang, '학원 전체', 'All academies', '全部补习班')}
            icon={<Building2 strokeWidth={2.5} className="w-3.5 h-3.5 text-accent-700" />}
            stats={monthlyStats.academyTotal}
          />
        </div>

        {/* Weekly trend (column chart) */}
        <div className="rounded-2xl bg-paper p-3 space-y-2">
          <h3 className="text-[0.75rem] font-bold text-ink flex items-center gap-1.5">
            <TrendingUp strokeWidth={2.75} className="w-3.5 h-3.5 text-sage-700 shrink-0" />
            {tr(lang, '주차별 출석률', 'Weekly attendance rate', '每周出勤率')}
            <span className="font-semibold text-slate-600">
              {tr(lang, '· 학교+학원', '· school + academies', '· 学校+补习班')}
            </span>
          </h3>
          <div
            role="img"
            aria-label={monthlyStats.weekly
              .map(
                (w) =>
                  `${tr(lang, `${w.index + 1}주`, `Week ${w.index + 1}`, `第${w.index + 1}周`)}: ${
                    hasEffective(w.stats) ? `${w.stats.rate}%` : tr(lang, '기록 없음', 'no records', '无记录')
                  }`
              )
              .join(', ')}
          >
            <div className="relative h-[116px]">
              {[0, 50, 100].map((g) => (
                <div
                  key={g}
                  className={`absolute left-8 right-0 border-t ${
                    g === 0 ? 'border-slate-300' : 'border-dashed border-slate-200'
                  }`}
                  style={{ bottom: `${(g / 100) * WEEK_PLOT_H}px` }}
                >
                  <span className="absolute -left-8 -top-[8px] w-6 text-right text-[0.6875rem] font-mono tabular-nums text-slate-500">
                    {g}
                  </span>
                </div>
              ))}
              <div className="absolute left-8 right-0 bottom-0 top-0 flex items-end justify-around">
                {monthlyStats.weekly.map((w) => {
                  const has = hasEffective(w.stats);
                  const h = has ? Math.max(3, (w.stats.rate / 100) * WEEK_PLOT_H) : 0;
                  const isNowWeek =
                    isCurrentMonth && today.getDate() >= w.range.from && today.getDate() <= w.range.to;
                  const tip = `${tr(
                    lang,
                    `${w.index + 1}주 (${w.range.from}–${w.range.to}일)`,
                    `Week ${w.index + 1} (${w.range.from}–${w.range.to})`,
                    `第${w.index + 1}周 (${w.range.from}–${w.range.to}日)`
                  )}: ${has ? `${w.stats.rate}%` : '–'} · ${STATUS_ORDER.map(
                    (st) => `${statusShortLabel(st, lang)} ${w.stats[st]}`
                  ).join(' / ')}`;
                  return (
                    <div
                      key={w.index}
                      title={tip}
                      className="group flex flex-col items-center justify-end h-full flex-1 max-w-[48px] cursor-default"
                    >
                      <span
                        className={`text-[0.6875rem] font-mono tabular-nums mb-0.5 ${
                          has ? 'text-ink' : 'text-slate-400'
                        }`}
                      >
                        {has ? `${Math.round(w.stats.rate)}` : '–'}
                      </span>
                      <div
                        className={`w-[22px] rounded-t-[4px] transition-colors ${
                          isNowWeek ? 'bg-sage-700' : 'bg-sage group-hover:bg-sage-600'
                        }`}
                        style={{ height: `${h}px` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-around ml-8 mt-1">
              {monthlyStats.weekly.map((w) => {
                const isNowWeek =
                  isCurrentMonth && today.getDate() >= w.range.from && today.getDate() <= w.range.to;
                return (
                  <span
                    key={w.index}
                    className={`flex-1 max-w-[48px] text-center text-[0.6875rem] whitespace-nowrap ${
                      isNowWeek ? 'font-bold text-sage-800' : 'text-slate-600'
                    }`}
                  >
                    {tr(lang, `${w.index + 1}주`, `W${w.index + 1}`, `第${w.index + 1}周`)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Per-academy stacked bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 pt-1">
            <h3 className="text-[0.75rem] font-bold text-ink flex items-center gap-1.5 min-w-0">
              <Building2 strokeWidth={2.5} className="w-3.5 h-3.5 text-accent-700 shrink-0" />
              <span className="truncate">
                {tr(
                  lang,
                  `학원별 출석률 (${monthlyStats.perAcademyStats.length}곳)`,
                  `By academy (${monthlyStats.perAcademyStats.length})`,
                  `各补习班出勤率 (${monthlyStats.perAcademyStats.length}家)`
                )}
              </span>
            </h3>
            <span className="text-[0.6875rem] text-slate-600 shrink-0">
              {tr(lang, '눌러서 상세 보기', 'Tap for details', '点击查看详情')}
            </span>
          </div>

          {monthlyStats.perAcademyStats.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['present', 'late', 'absent'] as AttendanceStatus[]).map((st) => legendChip(st))}
            </div>
          )}

          {monthlyStats.perAcademyStats.length === 0 ? (
            <div className="p-3 rounded-2xl bg-paper text-center text-[0.75rem] text-slate-600">
              {tr(
                lang,
                '등록된 학원이 없습니다. [설정]에서 학원 후보군을 추가하세요.',
                'No academies found. Add academies in [Settings].',
                '暂无补习班，请在【设置】中添加。'
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {monthlyStats.perAcademyStats.map(({ academyName, stats, pendingMakeupCount }) => {
                const isSelected = selectedAcademyDetail === academyName;
                const has = hasEffective(stats);
                const eff = stats.present + stats.late + stats.absent;
                const segs = (['present', 'late', 'absent'] as AttendanceStatus[])
                  .map((st) => ({ st, pct: eff > 0 ? (stats[st] / eff) * 100 : 0 }))
                  .filter((s) => s.pct > 0);
                const name = translateSubject(academyName, lang);
                const aria = `${name}: ${tr(lang, '출석률', 'rate', '出勤率')} ${
                  has ? `${stats.rate}%` : tr(lang, '기록 없음', 'no records', '无记录')
                }, ${STATUS_ORDER.map((st) => `${statusShortLabel(st, lang)} ${stats[st]}`).join(', ')}${
                  pendingMakeupCount > 0
                    ? `, ${tr(lang, '미완료 보강', 'pending makeup', '未完成补课')} ${pendingMakeupCount}`
                    : ''
                }`;
                return (
                  <li key={academyName}>
                    <button
                      type="button"
                      aria-expanded={isSelected}
                      aria-label={aria}
                      title={aria}
                      onClick={() =>
                        setSelectedAcademyDetail((prev) => (prev === academyName ? null : academyName))
                      }
                      className={`w-full px-3 py-2.5 rounded-2xl text-left transition-colors space-y-1.5 ${
                        isSelected ? 'bg-accent-100 ring-[1.5px] ring-inset ring-accent' : 'bg-paper hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden="true" />
                        <span className="text-[0.8125rem] font-bold text-ink truncate">{name}</span>
                        {pendingMakeupCount > 0 && (
                          <span className="px-1.5 py-px rounded-full bg-accent-700 text-paper text-[0.6875rem] font-bold whitespace-nowrap shrink-0">
                            {tr(lang, `보강 ${pendingMakeupCount}`, `Makeup ${pendingMakeupCount}`, `补课 ${pendingMakeupCount}`)}
                          </span>
                        )}
                        <span
                          className={`ml-auto text-[1rem] font-mono tabular-nums shrink-0 ${
                            has ? 'text-ink' : 'text-slate-400'
                          }`}
                        >
                          {has ? `${stats.rate}%` : '–'}
                        </span>
                        {isSelected ? (
                          <ChevronUp strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
                        ) : (
                          <ChevronDown strokeWidth={2.75} className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </span>
                      <span className="flex h-2.5 rounded-full bg-slate-200 overflow-hidden gap-[2px]">
                        {segs.map((s) => (
                          <span
                            key={s.st}
                            className={`h-full first:rounded-l-full last:rounded-r-full ${STATUS_META[s.st].barColor}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        ))}
                      </span>
                      <span className="block text-[0.6875rem] text-slate-600 tabular-nums">
                        {has || stats.cancelled > 0
                          ? STATUS_ORDER.filter((st) => stats[st] > 0)
                              .map((st) => `${statusShortLabel(st, lang)} ${stats[st]}`)
                              .join(' · ')
                          : tr(lang, '이 달 기록 없음', 'No records this month', '本月无记录')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* EXPANDED DETAIL PANEL WHEN AN ACADEMY IS TAPPED */}
          {activeAcademyDetailObj && (
            <div className="mt-1 p-3.5 rounded-2xl bg-paper space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-[0.875rem] font-bold text-ink">
                    {translateSubject(activeAcademyDetailObj.academyName, lang)}{' '}
                    {tr(lang, '상세 출결 리포트', 'Attendance Report', '详细出勤报告')}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[0.75rem] font-mono tabular-nums ${
                      !hasEffective(activeAcademyDetailObj.stats)
                        ? 'bg-slate-200 text-slate-700'
                        : activeAcademyDetailObj.stats.rate < 75
                        ? 'bg-accent-800 text-paper'
                        : activeAcademyDetailObj.stats.rate < 90
                        ? 'bg-accent-300 text-accent-900'
                        : 'bg-sage-700 text-paper'
                    }`}
                  >
                    {tr(lang, '출석률', 'Rate', '出勤率')}{' '}
                    {hasEffective(activeAcademyDetailObj.stats) ? `${activeAcademyDetailObj.stats.rate}%` : '–'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAcademyDetail(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-ink hover:bg-surface shrink-0"
                  aria-label={tr(lang, '닫기', 'Close', '关闭')}
                >
                  <X strokeWidth={2.75} className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center">
                {(
                  [
                    ['present', tr(lang, '출석', 'Present', '出勤'), 'text-sage-700'],
                    ['late', tr(lang, '지각', 'Late', '迟到'), 'text-accent-700'],
                    ['absent', tr(lang, '결석', 'Absent', '缺席'), 'text-accent-800'],
                    ['cancelled', tr(lang, '휴강(제외)', 'Off (excl.)', '停课(扣除)'), 'text-slate-600'],
                  ] as Array<[AttendanceStatus, string, string]>
                ).map(([st, label, color]) => (
                  <div key={st} className="p-2 rounded-xl bg-surface min-w-0">
                    <div className="text-[0.6875rem] font-semibold text-slate-600 truncate">{label}</div>
                    <div className={`text-[1rem] font-mono tabular-nums mt-0.5 ${color}`}>
                      {countUnit(activeAcademyDetailObj.stats[st])}
                    </div>
                  </div>
                ))}
              </div>

              {/* Late days */}
              <div className="space-y-1.5">
                <span className="text-[0.75rem] font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-300" />
                  {tr(
                    lang,
                    `지각한 날 (${activeAcademyDetailObj.stats.lateDays.length}일)`,
                    `Late Dates (${activeAcademyDetailObj.stats.lateDays.length})`,
                    `迟到日期 (${activeAcademyDetailObj.stats.lateDays.length}天)`
                  )}
                </span>
                {activeAcademyDetailObj.stats.lateDays.length === 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-surface text-[0.6875rem] text-slate-600">
                    {tr(lang, '이 달에 지각한 날이 없습니다.', 'No late records this month.', '本月没有迟到记录。')}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeAcademyDetailObj.stats.lateDays.map((item) => (
                      <button
                        type="button"
                        key={item.dateStr}
                        onClick={() => selectDate(item.dateStr)}
                        className="w-full px-3 py-2 rounded-xl bg-surface flex items-center justify-between gap-2 text-left hover:bg-slate-200/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Calendar strokeWidth={2.5} className="w-3.5 h-3.5 text-accent-700 shrink-0" />
                            <span className="text-[0.75rem] font-semibold text-ink tabular-nums">{item.shortDateLabel}</span>
                            <span className="px-2 py-0.5 rounded-full bg-accent-300 text-accent-900 text-[0.6875rem] font-bold">
                              {statusShortLabel('late', lang)}
                            </span>
                          </div>
                          {item.record.reason && (
                            <p className="text-[0.6875rem] text-slate-600 mt-0.5 truncate">
                              {tr(lang, '사유: ', 'Reason: ', '原因：')}
                              {translateSampleText(item.record.reason, lang)}
                            </p>
                          )}
                        </div>
                        <span className="text-[0.6875rem] font-semibold text-accent-700 shrink-0">
                          {tr(lang, '날짜 이동 →', 'Jump →', '跳转 →')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Absent days */}
              <div className="space-y-1.5">
                <span className="text-[0.75rem] font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-800" />
                  {tr(
                    lang,
                    `결석한 날 (${activeAcademyDetailObj.stats.absentDays.length}일)`,
                    `Absent Dates (${activeAcademyDetailObj.stats.absentDays.length})`,
                    `缺席日期 (${activeAcademyDetailObj.stats.absentDays.length}天)`
                  )}
                </span>
                {activeAcademyDetailObj.stats.absentDays.length === 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-surface text-[0.6875rem] text-slate-600">
                    {tr(lang, '이 달에 결석한 날이 없습니다.', 'No absent records this month.', '本月没有缺席记录。')}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeAcademyDetailObj.stats.absentDays.map((item) => (
                      <div
                        key={item.dateStr}
                        className="px-3 py-2 rounded-xl bg-surface flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => selectDate(item.dateStr)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Calendar strokeWidth={2.5} className="w-3.5 h-3.5 text-accent-800 shrink-0" />
                            <span className="text-[0.75rem] font-semibold text-ink tabular-nums">{item.shortDateLabel}</span>
                            <span className="px-2 py-0.5 rounded-full bg-accent-800 text-paper text-[0.6875rem] font-bold">
                              {statusShortLabel('absent', lang)}
                            </span>
                            {item.record.needsMakeup && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${
                                  item.record.makeupCompleted
                                    ? 'bg-sage-200 text-sage-800'
                                    : 'bg-accent-100 text-accent-800'
                                }`}
                              >
                                {item.record.makeupCompleted
                                  ? tr(lang, '보강 완료', 'Makeup Done', '已补课')
                                  : tr(lang, '보강 필요', 'Needs Makeup', '需补课')}
                              </span>
                            )}
                          </div>
                          {item.record.reason && (
                            <p className="text-[0.6875rem] text-slate-600 mt-0.5 truncate">
                              {tr(lang, '사유: ', 'Reason: ', '原因：')}
                              {translateSampleText(item.record.reason, lang)}
                            </p>
                          )}
                        </button>

                        {item.record.needsMakeup && !item.record.makeupCompleted ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateAcademyDetail(item.dateStr, activeAcademyDetailObj.academyName, {
                                makeupCompleted: true,
                              })
                            }
                            className="h-8 px-3 rounded-full bg-sage-700 text-paper text-[0.6875rem] font-bold inline-flex items-center gap-1 hover:bg-sage-800 shrink-0 whitespace-nowrap"
                          >
                            <Check strokeWidth={3} className="w-3.5 h-3.5" />
                            {tr(lang, '보강 완료', 'Done', '补课完成')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => selectDate(item.dateStr)}
                            className="text-[0.6875rem] font-semibold text-accent-700 shrink-0"
                          >
                            {tr(lang, '날짜 이동 →', 'Jump →', '跳转 →')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. MONTHLY CALENDAR FOR REVIEW (drives the charts above) */}
      <section className="bg-surface rounded-2xl shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[0.8125rem] font-bold text-ink flex items-center gap-1.5 min-w-0">
            <CalendarDays strokeWidth={2.75} className="w-4 h-4 text-accent-700 shrink-0" />
            <span className="truncate">{tr(lang, '출석 기록 달력', 'Attendance Calendar', '出勤记录日历')}</span>
          </h2>
          {monthNav}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_ORDER.map((st) => legendChip(st))}
          </div>
          <p className="text-[0.6875rem] text-slate-600 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-1.5 rounded-full bg-slate-500" aria-hidden="true" />
              {tr(lang, '학교', 'School', '学校')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" aria-hidden="true" />
              {selectedAcademyDetail
                ? translateSubject(selectedAcademyDetail, lang)
                : tr(lang, '학원', 'Academies', '补习班')}
            </span>
            <span>·</span>
            <span>
              {tr(
                lang,
                '날짜를 누르면 맨 위에서 수정',
                'Tap a day to edit it at the top',
                '点击日期即可在顶部修改'
              )}
            </span>
          </p>
        </div>

        <div>
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {calendarWeekHeader.map((d, idx) => (
              <div
                key={idx}
                className={`py-1 text-[0.6875rem] font-bold ${
                  idx === 0 ? 'text-accent-700' : idx === 6 ? 'text-sage-700' : 'text-slate-600'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const schoolMeta = cell.schoolRecord ? STATUS_META[cell.schoolRecord.status] : null;
              const markRing = cell.isSelected ? 'ring-1 ring-paper' : '';
              const cellAria = [
                formatDateWithDay(cell.dateStr, lang).shortDateLabel,
                cell.schoolRecord
                  ? `${schoolLabel} ${statusLabel(cell.schoolRecord.status, lang)}`
                  : '',
                ...cell.academyRecords.map(
                  ({ name, record }) => `${translateSubject(name, lang)} ${statusLabel(record.status, lang)}`
                ),
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  aria-label={cellAria}
                  aria-pressed={cell.isSelected}
                  onClick={() => {
                    selectDate(cell.dateStr);
                    checkCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`min-h-[58px] min-w-0 px-1 pt-1.5 pb-2 rounded-xl flex flex-col items-center gap-1.5 transition-colors ${
                    cell.isSelected
                      ? 'bg-accent-700 text-paper shadow-xs'
                      : cell.isToday
                      ? 'bg-paper ring-[1.5px] ring-inset ring-accent text-accent-800'
                      : cell.isCurrentMonth
                      ? 'bg-paper/70 text-ink hover:bg-paper'
                      : 'text-ink opacity-40 hover:opacity-70'
                  }`}
                >
                  <span className="text-[0.8125rem] leading-none font-mono tabular-nums">{cell.dayNum}</span>
                  <span
                    className={`w-full max-w-[32px] h-1.5 rounded-full ${
                      schoolMeta ? `${schoolMeta.barColor} ${markRing}` : 'bg-transparent'
                    }`}
                    title={schoolMeta ? `${schoolLabel}: ${tr(lang, schoolMeta.ko, schoolMeta.en, schoolMeta.zh)}` : undefined}
                  />
                  <span className="flex items-center justify-center gap-[3px] flex-wrap min-h-[6px]">
                    {cell.academyRecords.map(({ name, record }) => {
                      const acMeta = STATUS_META[record.status];
                      return (
                        <span
                          key={name}
                          className={`w-1.5 h-1.5 rounded-full ${acMeta.barColor} ${markRing}`}
                          title={`${translateSubject(name, lang)}: ${tr(lang, acMeta.ko, acMeta.en, acMeta.zh)}`}
                        />
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* KPI history sheet */}
      {kpiDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
          onClick={() => setKpiDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-label={kpiTitle}
        >
          <div
            className="w-full max-w-md max-h-[80vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-2.5 pb-3 border-b border-divider shrink-0 space-y-2">
              <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-bold text-ink truncate">{kpiTitle}</h3>
                  <p className="text-[0.6875rem] text-slate-600">
                    {kpiDetail === 'makeup'
                      ? tr(lang, '아직 보강하지 않은 수업 (모든 달)', 'Missed classes not made up yet (all months)', '尚未补课的课程（所有月份）')
                      : tr(lang, `학교·학원 합계 ${kpiRows.length}건`, `${kpiRows.length} in total (school + academies)`, `学校+补习班共 ${kpiRows.length} 条`)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setKpiDetail(null)}
                  aria-label={tr(lang, '닫기', 'Close', '关闭')}
                  className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {kpiRows.length === 0 ? (
                <div className="py-10 text-center text-[0.8125rem] text-slate-600">
                  {tr(lang, '해당하는 기록이 없어요', 'Nothing to show', '没有相关记录')}
                </div>
              ) : (
                kpiRows.map((row) => {
                  const meta = STATUS_META[row.status];
                  const StatusIcon = meta.Icon;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => {
                        // Jump the day picker to that date so it can be fixed right away.
                        const [y, m] = row.dateStr.split('-').map(Number);
                        setCursorMonth(new Date(y, m - 1, 1));
                        setSelectedDateStr(row.dateStr);
                        setKpiDetail(null);
                        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 text-left hover:bg-slate-100"
                    >
                      <span
                        className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-paper ${
                          row.isSchool ? 'bg-sage-700' : 'bg-accent-700'
                        }`}
                      >
                        {row.isSchool ? (
                          <GraduationCap strokeWidth={2.5} className="w-4 h-4" />
                        ) : (
                          <Building2 strokeWidth={2.5} className="w-4 h-4" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[0.875rem] font-bold text-ink truncate">{row.who}</span>
                          <span className="inline-flex items-center gap-0.5 text-[0.6875rem] font-bold text-slate-700 shrink-0">
                            <StatusIcon strokeWidth={2.75} className="w-3 h-3" />
                            {statusShortLabel(row.status, lang)}
                          </span>
                        </span>
                        <span className="block text-[0.75rem] text-slate-600 truncate">
                          {formatDateWithDay(row.dateStr, lang).shortDateLabel}
                          {row.reason ? ` · ${row.reason}` : ''}
                        </span>
                      </span>
                      {row.makeup && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold shrink-0 ${
                            row.makeup === 'done' ? 'bg-sage-100 text-sage-800' : 'bg-accent-100 text-accent-800'
                          }`}
                        >
                          {row.makeup === 'done'
                            ? tr(lang, '보강 완료', 'Made up', '已补课')
                            : tr(lang, '보강 대기', 'Makeup due', '待补课')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
