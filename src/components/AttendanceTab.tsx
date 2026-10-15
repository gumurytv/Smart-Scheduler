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
  X,
  BarChart3,
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
import { formatDateKey, getDayOfWeekKor } from '../data/initialData';
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
    badgeClass: string;
    cssVar: string;
  }
> = {
  present: {
    ko: '출석',
    en: 'Present',
    zh: '出勤',
    barColor: 'bg-sage',
    btnActive: 'bg-sage text-paper border-transparent',
    badgeClass: 'bg-sage-100 text-sage-800',
    cssVar: 'var(--color-sage)',
  },
  late: {
    ko: '지각',
    en: 'Late',
    zh: '迟到',
    barColor: 'bg-accent-300',
    btnActive: 'bg-accent-300 text-accent-900 border-transparent',
    badgeClass: 'bg-accent-300 text-accent-900',
    cssVar: 'var(--color-accent-300)',
  },
  absent: {
    ko: '결석',
    en: 'Absent',
    zh: '缺席',
    barColor: 'bg-accent-800',
    btnActive: 'bg-accent-800 text-paper border-transparent',
    badgeClass: 'bg-accent-800 text-accent-100',
    cssVar: 'var(--color-accent-800)',
  },
  cancelled: {
    ko: '공식휴강',
    en: 'Official Off',
    zh: '官方停课',
    barColor: 'bg-slate-400',
    btnActive: 'bg-slate-400 text-ink border-transparent',
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

function formatLongDate(dateStr: string, lang: AppLanguage): string {
  const date = parseDateKey(dateStr);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dayKor = getDayOfWeekKor(date);
  const day = translateDay(dayKor, lang);
  return tr(
    lang,
    `${y}년 ${m}월 ${d}일 (${day})`,
    `${EN_MONTHS[m - 1]} ${d}, ${y} (${day})`,
    `${y}年${m}月${d}日 (${day})`
  );
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
  const size = 112;
  const stroke = 14;
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
    <figure className="flex flex-col items-center gap-2 min-w-0" aria-label={ariaLabel}>
      <figcaption className="flex items-center gap-1 text-xs font-bold text-slate-900">
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
            stroke="var(--color-paper)"
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
          <span className="text-[22px] leading-none font-mono tabular-nums text-ink">
            {showRate ? `${stats.rate}%` : '–'}
          </span>
          <span className="text-[10px] text-slate-500 mt-1">
            {tr(lang, '실질 출석률', 'Real rate', '实际出勤率')}
          </span>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-700">
        {STATUS_ORDER.map((st) => (
          <li key={st} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[st].barColor}`} />
            <span>{statusShortLabel(st, lang)}</span>
            <span className="font-mono tabular-nums text-ink">{counts[st]}</span>
          </li>
        ))}
      </ul>
    </figure>
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

  const monthLabel = formatMonthLabel(cursorMonth, lang);
  const isSelectedToday = selectedDateStr === todayStr;

  const calendarWeekHeader = (['일', '월', '화', '수', '목', '금', '토'] as const).map((d) =>
    tr(lang, d, translateDay(d, 'en'), translateDay(d, 'zh').replace('周', ''))
  );

  const countUnit = (n: number) => tr(lang, `${n}회`, `${n}`, `${n}次`);

  const kpis: Array<{ key: string; label: string; value: number; swatch: string }> = [
    {
      key: 'present',
      label: statusShortLabel('present', lang),
      value: monthlyStats.combined.present,
      swatch: STATUS_META.present.barColor,
    },
    {
      key: 'late',
      label: statusShortLabel('late', lang),
      value: monthlyStats.combined.late,
      swatch: STATUS_META.late.barColor,
    },
    {
      key: 'absent',
      label: statusShortLabel('absent', lang),
      value: monthlyStats.combined.absent,
      swatch: STATUS_META.absent.barColor,
    },
    {
      key: 'makeup',
      label: tr(lang, '미완료 보강', 'Pending makeup', '未完成补课'),
      value: monthlyStats.pendingMakeups.length,
      swatch: 'bg-accent',
    },
  ];

  const renderStatusButtons = (
    current: AttendanceStatus | undefined,
    onPick: (st: AttendanceStatus) => void
  ) => (
    <div className="grid grid-cols-4 gap-1.5">
      {STATUS_ORDER.map((st) => {
        const meta = STATUS_META[st];
        const isSelected = current === st;
        return (
          <button
            key={st}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onPick(st)}
            className={`min-h-[36px] py-2 px-1 rounded-full text-xs font-bold border transition-all ${
              isSelected
                ? meta.btnActive
                : 'bg-transparent text-ink border-divider hover:bg-slate-100'
            }`}
          >
            {statusLabel(st, lang)}
          </button>
        );
      })}
    </div>
  );

  const monthNav = (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => shiftMonth(-1)}
        className="w-8 h-8 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100"
        aria-label={tr(lang, '이전 달', 'Previous month', '上个月')}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="min-w-[88px] text-center text-[13px] font-mono tabular-nums text-ink whitespace-nowrap">
        {monthLabel}
      </span>
      <button
        type="button"
        onClick={() => shiftMonth(1)}
        className="w-8 h-8 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100"
        aria-label={tr(lang, '다음 달', 'Next month', '下个月')}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3.5">
      {/* 1. SELECTED-DAY (DEFAULT: TODAY) 1-TOUCH ATTENDANCE CHECK */}
      <section
        ref={checkCardRef}
        className="bg-surface rounded-2xl shadow-xs overflow-hidden scroll-mt-4"
      >
        <div className="px-4 pt-3 pb-3 border-b border-divider space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-bold text-slate-900">
              {isSelectedToday
                ? tr(lang, '오늘 출석 체크', "Today's Attendance", '今日出勤登记')
                : tr(lang, '원터치 출석 체크', '1-Touch Attendance Check', '一键出勤登记')}
            </h2>
            <button
              type="button"
              onClick={goToday}
              disabled={isSelectedToday}
              className={`px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                isSelectedToday
                  ? 'bg-paper text-slate-400 cursor-default'
                  : 'bg-accent-100 text-accent-800 hover:bg-accent-300/60'
              }`}
            >
              {tr(lang, '오늘', 'Today', '今天')}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftSelectedDate(-1)}
              className="w-9 h-9 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 shrink-0"
              aria-label={tr(lang, '이전 날', 'Previous day', '前一天')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 text-center">
              <div
                className="text-[15px] font-mono tabular-nums text-ink truncate"
                aria-live="polite"
              >
                {formatLongDate(selectedDateStr, lang)}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {tr(
                  lang,
                  '시간표에 배정된 학교·학원이 자동 연동됩니다',
                  'Linked to classes scheduled for this day',
                  '自动关联当天课表中的学校与补习班'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => shiftSelectedDate(1)}
              className="w-9 h-9 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100 shrink-0"
              aria-label={tr(lang, '다음 날', 'Next day', '后一天')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* School Attendance Block */}
          <div className="p-3.5 rounded-xl bg-paper space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <GraduationCap className="w-4 h-4 text-sage" />
                <span className="text-sm font-bold text-slate-900">
                  {tr(lang, '학교 출석', 'School Attendance', '学校出勤')}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {selectedDayResolved.schoolPeriodsCount > 0
                    ? tr(
                        lang,
                        `(${selectedDayResolved.schoolPeriodsCount}교시 수업일)`,
                        `(${selectedDayResolved.schoolPeriodsCount} periods)`,
                        `(${selectedDayResolved.schoolPeriodsCount}节课)`
                      )
                    : tr(lang, '(주말/정규수업 없음)', '(No regular classes)', '(周末/无常规课)')}
                </span>
              </div>
              {selectedDayResolved.schoolRecord && (
                <button
                  type="button"
                  onClick={() => handleSetSchoolStatus(null)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 shrink-0"
                >
                  <RotateCcw className="w-3 h-3" /> {tr(lang, '초기화', 'Clear', '重置')}
                </button>
              )}
            </div>

            {renderStatusButtons(selectedDayResolved.schoolRecord?.status, (st) =>
              handleSetSchoolStatus(st)
            )}

            {selectedDayResolved.schoolRecord &&
              (selectedDayResolved.schoolRecord.status === 'late' ||
                selectedDayResolved.schoolRecord.status === 'absent' ||
                selectedDayResolved.schoolRecord.status === 'cancelled') && (
                <div>
                  <input
                    type="text"
                    aria-label={tr(lang, '학교 사유', 'School reason', '学校原因')}
                    placeholder={tr(
                      lang,
                      '지각/결석/휴강 사유 입력 (예: 병원 진료, 개교기념일)',
                      'Enter reason for late/absent/off (e.g. Clinic visit)',
                      '输入迟到/缺席/停课原因（如：医院就诊、校庆放假）'
                    )}
                    value={selectedDayResolved.schoolRecord.reason || ''}
                    onChange={(e) => handleSetSchoolReason(e.target.value)}
                    className="w-full h-10 px-4 rounded-full border border-divider bg-surface text-xs text-ink focus:outline-none focus:border-accent"
                  />
                </div>
              )}
          </div>

          {/* Academies Attendance List */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <Building2 className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-slate-700">
                {tr(
                  lang,
                  `당일 가는 학원 목록 (${selectedDayResolved.academyList.length}곳)`,
                  `Scheduled Academies (${selectedDayResolved.academyList.length})`,
                  `当天补习班列表 (${selectedDayResolved.academyList.length}家)`
                )}
              </span>
            </div>

            {selectedDayResolved.academyList.length === 0 ? (
              <div className="p-5 rounded-xl bg-paper text-center text-xs text-slate-500">
                {tr(
                  lang,
                  '이 날짜에 배정된 학원 수업이 없습니다.',
                  'No academy classes scheduled for this day.',
                  '该日期未安排补习班课程。'
                )}
              </div>
            ) : (
              selectedDayResolved.academyList.map((ac) => {
                const rec = ac.record;
                return (
                  <div key={ac.name} className="p-3.5 rounded-xl bg-paper space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900">
                          {translateSubject(ac.name, lang)}
                        </span>
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-mono text-slate-500 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {ac.timeLabel}
                        </span>
                      </div>
                      {rec && (
                        <button
                          type="button"
                          onClick={() => handleSetAcademyStatus(ac.name, null)}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" /> {tr(lang, '초기화', 'Clear', '重置')}
                        </button>
                      )}
                    </div>

                    {renderStatusButtons(rec?.status, (st) => handleSetAcademyStatus(ac.name, st))}

                    {rec &&
                      (rec.status === 'late' ||
                        rec.status === 'absent' ||
                        rec.status === 'cancelled') && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            aria-label={tr(lang, '학원 사유', 'Academy reason', '补习班原因')}
                            placeholder={tr(
                              lang,
                              '결석/지각/휴강 사유 메모 (예: 학교 행사, 감기 몸살)',
                              'Reason for absence/lateness (e.g. School event, Cold)',
                              '缺席/迟到/停课原因备注（如：学校活动、感冒）'
                            )}
                            value={rec.reason || ''}
                            onChange={(e) =>
                              handleUpdateAcademyDetail(selectedDateStr, ac.name, {
                                reason: e.target.value,
                              })
                            }
                            className="w-full h-10 px-4 rounded-full border border-divider bg-surface text-xs text-ink focus:outline-none focus:border-accent"
                          />

                          {(rec.status === 'absent' || rec.status === 'late') && (
                            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(rec.needsMakeup)}
                                  onChange={(e) =>
                                    handleUpdateAcademyDetail(selectedDateStr, ac.name, {
                                      needsMakeup: e.target.checked,
                                      makeupCompleted: e.target.checked
                                        ? Boolean(rec.makeupCompleted)
                                        : false,
                                    })
                                  }
                                  className="w-4 h-4 rounded accent-accent"
                                />
                                {tr(lang, '보강 필요', 'Needs Makeup', '需要补课')}
                              </label>

                              {rec.needsMakeup && (
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-sage-800 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(rec.makeupCompleted)}
                                    onChange={(e) =>
                                      handleUpdateAcademyDetail(selectedDateStr, ac.name, {
                                        makeupCompleted: e.target.checked,
                                      })
                                    }
                                    className="w-4 h-4 rounded accent-sage"
                                  />
                                  {tr(lang, '보강 완료됨', 'Makeup Completed', '已完成补课')}
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* 2. PENDING MAKEUPS (right after today's check) */}
      <section
        className={`p-3.5 rounded-2xl shadow-xs ${
          monthlyStats.pendingMakeups.length > 0
            ? 'bg-accent-100 text-accent-900'
            : 'bg-sage-100 text-sage-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {monthlyStats.pendingMakeups.length > 0 ? (
              <AlertCircle className="w-4 h-4 text-accent-800 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-sage-800 shrink-0" />
            )}
            <span className="text-[13px] font-bold tabular-nums">
              {tr(
                lang,
                `미완료 보강 ${monthlyStats.pendingMakeups.length}건`,
                `Pending makeups: ${monthlyStats.pendingMakeups.length}`,
                `未完成补课：${monthlyStats.pendingMakeups.length}项`
              )}
            </span>
          </div>
          <span className="text-[11px] opacity-80 text-right">
            {monthlyStats.pendingMakeups.length > 0
              ? tr(lang, '보강 완료 시 체크하세요', 'Check off when completed', '补课后请点击完成')
              : tr(lang, '모든 보강을 완료했습니다', 'All makeups completed!', '已完成所有补课')}
          </span>
        </div>

        {monthlyStats.pendingMakeups.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {monthlyStats.pendingMakeups.map((mk) => (
              <div
                key={`${mk.dateStr}-${mk.academyName}`}
                className="px-3 py-2 rounded-xl bg-paper text-ink flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    selectDate(mk.dateStr);
                    setSelectedAcademyDetail(mk.academyName);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">
                      {translateSubject(mk.academyName, lang)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      ({mk.shortDateLabel} {statusShortLabel(mk.status, lang)})
                    </span>
                  </div>
                  {mk.reason && (
                    <p className="text-[11px] text-slate-500 truncate">
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
                  className="h-[30px] px-2.5 rounded-full bg-accent text-paper text-[11px] font-bold hover:bg-accent-600 shrink-0 whitespace-nowrap"
                >
                  {tr(lang, '보강 완료 체크', 'Mark done', '完成补课')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. MONTHLY ATTENDANCE OVERVIEW (follows the calendar's month) */}
      <section className="bg-surface rounded-2xl p-3.5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-accent shrink-0" />
              {tr(
                lang,
                `${monthLabel} 출석 현황`,
                `${monthLabel} Attendance`,
                `${monthLabel} 出勤概况`
              )}
            </h2>
            <p className="text-[11px] text-slate-500">
              {tr(
                lang,
                '공식휴강은 출석률 계산에서 제외 · 아래 달력과 같은 달 기준',
                'Official Off excluded from rate · Follows the calendar month below',
                '官方停课不计入出勤率 · 与下方日历月份同步'
              )}
            </p>
          </div>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goToday}
              className="px-2.5 h-7 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-accent-300/60"
            >
              {tr(lang, '이번 달', 'This month', '本月')}
            </button>
          )}
        </div>

        {/* KPI tiles */}
        <div>
          <div className="text-[11px] text-slate-500 mb-1.5 px-0.5">
            {tr(lang, '학교 + 학원 합계', 'School + academies combined', '学校 + 补习班合计')}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {kpis.map((k) => (
              <div key={k.key} className="px-2 py-2 rounded-xl bg-paper min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${k.swatch}`} />
                  <span className="truncate">{k.label}</span>
                </div>
                <div className="text-xl leading-tight font-mono tabular-nums text-ink mt-0.5">
                  {k.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status distribution donuts */}
        <div className="grid grid-cols-2 gap-2">
          <StatusDonut
            lang={lang}
            title={tr(lang, '학교', 'School', '学校')}
            icon={<GraduationCap className="w-3.5 h-3.5 text-sage-700" />}
            stats={monthlyStats.school}
          />
          <StatusDonut
            lang={lang}
            title={tr(lang, '학원 전체', 'All academies', '全部补习班')}
            icon={<Building2 className="w-3.5 h-3.5 text-accent" />}
            stats={monthlyStats.academyTotal}
          />
        </div>

        {/* Weekly trend (column chart) */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-900 px-0.5">
            {tr(
              lang,
              '주차별 출석률 (학교+학원)',
              'Weekly attendance rate (school + academies)',
              '每周出勤率（学校+补习班）'
            )}
          </h3>
          <div
            role="img"
            aria-label={monthlyStats.weekly
              .map(
                (w) =>
                  `${tr(lang, `${w.index + 1}주`, `Week ${w.index + 1}`, `第${w.index + 1}周`)}: ${
                    hasEffective(w.stats)
                      ? `${w.stats.rate}%`
                      : tr(lang, '기록 없음', 'no records', '无记录')
                  }`
              )
              .join(', ')}
            className="px-1 pt-1"
          >
            <div className="relative h-[104px]">
              {/* gridlines at 100% / 50% / 0% */}
              {[0, 50, 100].map((g) => (
                <div
                  key={g}
                  className="absolute left-7 right-0 border-t border-divider"
                  style={{ bottom: `${(g / 100) * 84}px` }}
                >
                  <span className="absolute -left-7 -top-[7px] w-6 text-right text-[9px] font-mono tabular-nums text-slate-500">
                    {g}
                  </span>
                </div>
              ))}
              <div className="absolute left-7 right-0 bottom-0 top-0 flex items-end justify-around">
                {monthlyStats.weekly.map((w) => {
                  const has = hasEffective(w.stats);
                  const h = has ? Math.max(2, (w.stats.rate / 100) * 84) : 0;
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
                      className="flex flex-col items-center justify-end h-full w-10"
                    >
                      <span className="text-[10px] font-mono tabular-nums text-ink mb-0.5">
                        {has ? `${Math.round(w.stats.rate)}` : '–'}
                      </span>
                      <div
                        className="w-[22px] rounded-t-[4px] bg-sage"
                        style={{ height: `${h}px` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-around ml-7 mt-1">
              {monthlyStats.weekly.map((w) => (
                <span
                  key={w.index}
                  className="w-10 text-center text-[10px] text-slate-500 whitespace-nowrap"
                >
                  {tr(lang, `${w.index + 1}주`, `W${w.index + 1}`, `第${w.index + 1}周`)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Per-academy horizontal bars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 min-w-0">
              <Building2 className="w-4 h-4 text-accent shrink-0" />
              <span className="truncate">
                {tr(
                  lang,
                  `학원별 출석률 (${monthlyStats.perAcademyStats.length}곳)`,
                  `By academy (${monthlyStats.perAcademyStats.length})`,
                  `各补习班出勤率 (${monthlyStats.perAcademyStats.length}家)`
                )}
              </span>
            </h3>
            <span className="text-[10px] text-slate-500 shrink-0">
              {tr(lang, '막대를 눌러 상세 보기', 'Tap a bar for details', '点击条形查看详情')}
            </span>
          </div>

          {monthlyStats.perAcademyStats.length > 0 && (
            <div className="flex items-center gap-3 px-0.5 text-[10px] text-slate-600">
              {(['present', 'late'] as AttendanceStatus[]).map((st) => (
                <span key={st} className="inline-flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${STATUS_META[st].barColor}`} />
                  {statusShortLabel(st, lang)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-paper border border-divider" />
                {tr(lang, '결석(미달분)', 'Absent (gap)', '缺席(差额)')}
              </span>
            </div>
          )}

          {monthlyStats.perAcademyStats.length === 0 ? (
            <div className="p-3 rounded-xl bg-paper text-center text-xs text-slate-500">
              {tr(
                lang,
                '등록된 학원이 없습니다. [설정]에서 학원 후보군을 추가하세요.',
                'No academies found. Add academies in [Settings].',
                '暂无补习班，请在【设置】中添加。'
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {monthlyStats.perAcademyStats.map(({ academyName, stats, pendingMakeupCount }) => {
                const isSelected = selectedAcademyDetail === academyName;
                const has = hasEffective(stats);
                const eff = stats.present + stats.late + stats.absent;
                const presentPct = eff > 0 ? (stats.present / eff) * 100 : 0;
                const latePct = eff > 0 ? (stats.late / eff) * 100 : 0;
                const name = translateSubject(academyName, lang);
                const aria = `${name}: ${tr(lang, '출석률', 'rate', '出勤率')} ${
                  has ? `${stats.rate}%` : tr(lang, '기록 없음', 'no records', '无记录')
                }, ${STATUS_ORDER.map((st) => `${statusShortLabel(st, lang)} ${stats[st]}`).join(
                  ', '
                )}${
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
                        setSelectedAcademyDetail((prev) =>
                          prev === academyName ? null : academyName
                        )
                      }
                      className={`w-full grid grid-cols-[minmax(0,96px)_1fr_auto] items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                        isSelected ? 'bg-accent-100' : 'bg-paper hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">{name}</span>
                        {pendingMakeupCount > 0 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="relative h-3 rounded-full bg-surface overflow-hidden flex gap-[2px]">
                        {presentPct > 0 && (
                          <span
                            className="h-full bg-sage"
                            style={{ width: `${presentPct}%` }}
                          />
                        )}
                        {latePct > 0 && (
                          <span
                            className="h-full bg-accent-300 rounded-r-[4px]"
                            style={{ width: `${latePct}%` }}
                          />
                        )}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span
                          className={`w-12 text-right text-xs font-mono tabular-nums ${
                            has ? 'text-ink' : 'text-slate-400'
                          }`}
                        >
                          {has ? `${stats.rate}%` : '–'}
                        </span>
                        {isSelected ? (
                          <ChevronUp className="w-3.5 h-3.5 text-accent-700" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* EXPANDED DETAIL PANEL WHEN AN ACADEMY IS TAPPED */}
          {activeAcademyDetailObj && (
            <div className="mt-2 p-3 rounded-xl bg-paper space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-sm font-bold text-slate-900">
                    {translateSubject(activeAcademyDetailObj.academyName, lang)}{' '}
                    {tr(lang, '상세 출결 리포트', 'Attendance Report', '详细出勤报告')}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono tabular-nums ${
                      activeAcademyDetailObj.stats.rate < 75
                        ? 'bg-accent-800 text-accent-100'
                        : activeAcademyDetailObj.stats.rate < 90
                        ? 'bg-accent-300 text-accent-900'
                        : 'bg-accent-100 text-accent-800'
                    }`}
                  >
                    {tr(lang, '출석률', 'Rate', '出勤率')}{' '}
                    {hasEffective(activeAcademyDetailObj.stats)
                      ? `${activeAcademyDetailObj.stats.rate}%`
                      : '–'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAcademyDetail(null)}
                  className="p-1 rounded-full text-slate-500 hover:text-ink hover:bg-slate-200/60 shrink-0"
                  aria-label={tr(lang, '닫기', 'Close', '关闭')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center">
                {(
                  [
                    ['present', tr(lang, '출석 횟수', 'Present', '出勤次数'), 'text-sage-800'],
                    ['late', tr(lang, '지각 횟수', 'Late', '迟到次数'), 'text-accent-700'],
                    ['absent', tr(lang, '결석 횟수', 'Absent', '缺席次数'), 'text-accent-800'],
                    ['cancelled', tr(lang, '휴강(제외)', 'Off (excl.)', '停课(扣除)'), 'text-slate-500'],
                  ] as Array<[AttendanceStatus, string, string]>
                ).map(([st, label, color]) => (
                  <div key={st} className="p-2 rounded-xl bg-surface">
                    <div className="text-[10px] font-semibold text-slate-500">{label}</div>
                    <div className={`text-base font-mono tabular-nums mt-0.5 ${color}`}>
                      {countUnit(activeAcademyDetailObj.stats[st])}
                    </div>
                  </div>
                ))}
              </div>

              {/* Late days */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-300" />
                  {tr(
                    lang,
                    `지각한 날 (${activeAcademyDetailObj.stats.lateDays.length}일)`,
                    `Late Dates (${activeAcademyDetailObj.stats.lateDays.length})`,
                    `迟到日期 (${activeAcademyDetailObj.stats.lateDays.length}天)`
                  )}
                </span>
                {activeAcademyDetailObj.stats.lateDays.length === 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-surface text-[11px] text-slate-500">
                    {tr(
                      lang,
                      '이 달에 지각한 날이 없습니다.',
                      'No late records this month.',
                      '本月没有迟到记录。'
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeAcademyDetailObj.stats.lateDays.map((item) => (
                      <button
                        type="button"
                        key={item.dateStr}
                        onClick={() => selectDate(item.dateStr)}
                        className="w-full px-3 py-2 rounded-xl bg-surface flex items-center justify-between gap-2 text-left hover:bg-slate-100 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-accent-700 shrink-0" />
                            <span className="text-xs font-mono text-slate-900 tabular-nums">
                              {item.shortDateLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-accent-300 text-accent-900 text-[10px] font-bold">
                              {statusShortLabel('late', lang)}
                            </span>
                          </div>
                          {item.record.reason && (
                            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                              {tr(lang, '사유: ', 'Reason: ', '原因：')}
                              {translateSampleText(item.record.reason, lang)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-accent-700 shrink-0">
                          {tr(lang, '날짜 이동 →', 'Jump →', '跳转 →')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Absent days */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-800" />
                  {tr(
                    lang,
                    `결석한 날 (${activeAcademyDetailObj.stats.absentDays.length}일)`,
                    `Absent Dates (${activeAcademyDetailObj.stats.absentDays.length})`,
                    `缺席日期 (${activeAcademyDetailObj.stats.absentDays.length}天)`
                  )}
                </span>
                {activeAcademyDetailObj.stats.absentDays.length === 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-surface text-[11px] text-slate-500">
                    {tr(
                      lang,
                      '이 달에 결석한 날이 없습니다.',
                      'No absent records this month.',
                      '本月没有缺席记录。'
                    )}
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
                            <Calendar className="w-3.5 h-3.5 text-accent-800 shrink-0" />
                            <span className="text-xs font-mono text-slate-900 tabular-nums">
                              {item.shortDateLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-accent-800 text-accent-100 text-[10px] font-bold">
                              {statusShortLabel('absent', lang)}
                            </span>
                            {item.record.needsMakeup && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.record.makeupCompleted
                                    ? 'bg-sage-100 text-sage-800'
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
                            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                              {tr(lang, '사유: ', 'Reason: ', '原因：')}
                              {translateSampleText(item.record.reason, lang)}
                            </p>
                          )}
                        </button>

                        {item.record.needsMakeup && !item.record.makeupCompleted ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateAcademyDetail(
                                item.dateStr,
                                activeAcademyDetailObj.academyName,
                                { makeupCompleted: true }
                              )
                            }
                            className="px-2.5 py-1 rounded-full bg-accent text-paper text-[10px] font-bold hover:bg-accent-600 shrink-0 whitespace-nowrap"
                          >
                            {tr(lang, '보강 완료 체크', 'Mark Done', '完成补课')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => selectDate(item.dateStr)}
                            className="text-[10px] font-semibold text-accent-700 shrink-0"
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
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-divider space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-bold text-slate-900">
              {tr(lang, '출석 기록 달력', 'Attendance Calendar', '出勤记录日历')}
            </h2>
            {monthNav}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
            <div className="text-[11px] font-semibold text-slate-600">
              {tr(lang, '막대: 학교 · 점: ', 'Bar: School · Dots: ', '条：学校 · 点：')}
              {selectedAcademyDetail
                ? translateSubject(selectedAcademyDetail, lang)
                : tr(lang, '전체 학원', 'All academies', '全部补习班')}
            </div>
            <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-600">
              {STATUS_ORDER.map((st) => (
                <span key={st} className="inline-flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[st].barColor}`} />
                  {statusShortLabel(st, lang)}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            {tr(
              lang,
              '날짜를 누르면 맨 위 출석 체크에서 그 날짜를 수정할 수 있어요',
              'Tap a day to edit it in the check card at the top',
              '点击日期即可在顶部出勤登记中修改该日'
            )}
          </p>
        </div>

        {/* Day of Week Header */}
        <div className="grid grid-cols-7 border-b border-divider text-center">
          {calendarWeekHeader.map((d, idx) => (
            <div
              key={idx}
              className={`py-2 text-[11px] font-bold ${
                idx === 0 ? 'text-accent-700' : idx === 6 ? 'text-sage-700' : 'text-slate-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-divider">
          {calendarCells.map((cell) => {
            const schoolMeta = cell.schoolRecord ? STATUS_META[cell.schoolRecord.status] : null;
            const cellAria = [
              formatDateWithDay(cell.dateStr, lang).shortDateLabel,
              cell.schoolRecord
                ? `${tr(lang, '학교', 'School', '学校')} ${statusLabel(cell.schoolRecord.status, lang)}`
                : '',
              ...cell.academyRecords.map(
                ({ name, record }) =>
                  `${translateSubject(name, lang)} ${statusLabel(record.status, lang)}`
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
                className={`min-h-[64px] p-1.5 flex flex-col justify-between text-left transition-colors ${
                  cell.isSelected
                    ? 'bg-accent-100 ring-2 ring-inset ring-accent'
                    : cell.isCurrentMonth
                    ? 'bg-surface hover:bg-slate-50'
                    : 'bg-surface opacity-50'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-full ${
                      cell.isToday ? 'bg-accent text-paper' : 'text-ink'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                </div>

                <div className="w-full space-y-1.5 mt-1">
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    {schoolMeta && (
                      <div
                        className={`w-full h-full ${schoolMeta.barColor}`}
                        title={tr(lang, schoolMeta.ko, schoolMeta.en, schoolMeta.zh)}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1 min-h-[10px] flex-wrap">
                    {cell.academyRecords.map(({ name, record }) => {
                      const acMeta = STATUS_META[record.status];
                      return (
                        <span
                          key={name}
                          className={`w-2.5 h-2.5 rounded-full ${acMeta.barColor}`}
                          title={`${translateSubject(name, lang)}: ${tr(
                            lang,
                            acMeta.ko,
                            acMeta.en,
                            acMeta.zh
                          )}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
