import React, { useState, useMemo } from 'react';
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

const STATUS_META: Record<
  AttendanceStatus,
  {
    ko: string;
    en: string;
    zh: string;
    barColor: string;
    btnActive: string;
    badgeClass: string;
  }
> = {
  present: {
    ko: '출석',
    en: 'Present',
    zh: '出勤',
    barColor: 'bg-sage',
    btnActive: 'bg-sage text-paper border-transparent',
    badgeClass: 'bg-sage-100 text-sage-800',
  },
  late: {
    ko: '지각',
    en: 'Late',
    zh: '迟到',
    barColor: 'bg-accent-300',
    btnActive: 'bg-accent-300 text-accent-900 border-transparent',
    badgeClass: 'bg-accent-300 text-accent-900',
  },
  absent: {
    ko: '결석',
    en: 'Absent',
    zh: '缺席',
    barColor: 'bg-accent-800',
    btnActive: 'bg-accent-800 text-paper border-transparent',
    badgeClass: 'bg-accent-800 text-accent-100',
  },
  cancelled: {
    ko: '공식휴강',
    en: 'Official Off',
    zh: '官方停课',
    barColor: 'bg-slate-400',
    btnActive: 'bg-slate-400 text-ink border-transparent',
    badgeClass: 'bg-slate-200 text-slate-700',
  },
};

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

function formatDateWithDay(
  dateStr: string,
  lang: AppLanguage
): { dayKor: string; shortDateLabel: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { dayKor: '', shortDateLabel: dateStr };
  const dateObj = new Date(y, m - 1, d);
  const dayKor = getDayOfWeekKor(dateObj);
  const dayLocalized = translateDay(dayKor, lang);
  const shortDateLabel =
    lang === 'en'
      ? `${m}/${d} (${dayLocalized})`
      : lang === 'zh'
      ? `${m}月${d}日 (${dayLocalized})`
      : `${m}월 ${d}일 (${dayKor})`;
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

  const monthPrefix = useMemo(() => {
    const y = cursorMonth.getFullYear();
    const m = String(cursorMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [cursorMonth]);

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
      reason?: string;
    }> = [];

    Object.entries(attendance).forEach(([dateStr, dayAtt]) => {
      if (dayAtt.academies) {
        Object.entries(dayAtt.academies).forEach(([acName, rec]) => {
          allAcademyNames.add(acName);
          if (rec.needsMakeup && !rec.makeupCompleted) {
            const { shortDateLabel } = formatDateWithDay(dateStr, lang);
            pendingMakeups.push({
              dateStr,
              shortDateLabel,
              academyName: acName,
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

    return {
      school: computeStatsWithDates(schoolDated, lang),
      academyTotal: computeStatsWithDates(academyDatedAll, lang),
      perAcademyStats,
      pendingMakeups,
    };
  }, [attendance, monthPrefix, subjectPool, masterTimetable, lang]);

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
      const dayAtt = attendance[dateStr];
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

    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      const dateStr = formatDateKey(d);
      const dayAtt = attendance[dateStr];
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        schoolRecord: dayAtt?.school,
        academyRecords: extractAcademyRecords(dateStr),
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dateStr = formatDateKey(d);
      const dayAtt = attendance[dateStr];
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        schoolRecord: dayAtt?.school,
        academyRecords: extractAcademyRecords(dateStr),
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = formatDateKey(d);
      const dayAtt = attendance[dateStr];
      cells.push({
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDateStr,
        schoolRecord: dayAtt?.school,
        academyRecords: extractAcademyRecords(dateStr),
      });
    }

    return cells;
  }, [cursorMonth, attendance, todayStr, selectedDateStr, selectedAcademyDetail]);

  const selectedDayResolved = useMemo(() => {
    const resolved = resolveDailyTimetable(selectedDateStr, masterTimetable, dailyOverrides);
    const dayAtt = attendance[selectedDateStr] || {};

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

  const monthHeaderTitle =
    lang === 'en'
      ? `${cursorMonth.toLocaleString('en-US', { month: 'short' })} ${cursorMonth.getFullYear()} Real Attendance`
      : lang === 'zh'
      ? `${cursorMonth.getFullYear()}年${cursorMonth.getMonth() + 1}月 实际出勤率`
      : `${cursorMonth.getFullYear()}년 ${cursorMonth.getMonth() + 1}월 실질 출석률`;

  const calendarWeekHeader =
    lang === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : lang === 'zh'
      ? ['日', '一', '二', '三', '四', '五', '六']
      : ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-3.5">
      {/* 1. TOP ATTENDANCE RATE DASHBOARD */}
      <section className="bg-surface rounded-2xl p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">{monthHeaderTitle}</h2>
            <p className="text-[11px] text-slate-500">
              {tr(
                lang,
                '공식휴강 제외 · 학원 터치 시 지각/결석일 상세 조회',
                'Excludes Official Off · Tap any academy for late/absent dates',
                '扣除官方停课 · 点击补习班查看迟到/缺席详情'
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setCursorMonth(
                  new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1)
                )
              }
              className="w-8 h-8 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100"
              aria-label="Prev Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDateStr(formatDateKey(now));
              }}
              className="px-2.5 h-8 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-accent-300/60"
            >
              {tr(lang, '이번달', 'This Mo', '本月')}
            </button>
            <button
              type="button"
              onClick={() =>
                setCursorMonth(
                  new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1)
                )
              }
              className="w-8 h-8 rounded-full border border-divider bg-paper flex items-center justify-center text-ink hover:bg-slate-100"
              aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* School Attendance Rate Compact Card */}
        <div className="px-3.5 py-3 rounded-xl bg-sage-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-sage-800" />
              <span className="text-xs font-bold text-sage-900">
                {tr(lang, '학교 실질 출석률', 'School Real Attendance', '学校实际出勤率')}
              </span>
            </div>
            <span className="text-[34px] leading-none text-sage-800 font-mono tabular-nums">
              {monthlyStats.school.rate}%
            </span>
          </div>
          <div className="w-full h-2 bg-paper/70 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, monthlyStats.school.rate)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-sage-800 font-mono tabular-nums">
            <span>
              {tr(
                lang,
                `출석 ${monthlyStats.school.present}회`,
                `Pres ${monthlyStats.school.present}`,
                `出勤 ${monthlyStats.school.present}次`
              )}
            </span>
            <span>·</span>
            <span>
              {tr(
                lang,
                `지각 ${monthlyStats.school.late}회`,
                `Late ${monthlyStats.school.late}`,
                `迟到 ${monthlyStats.school.late}次`
              )}
            </span>
            <span>·</span>
            <span>
              {tr(
                lang,
                `결석 ${monthlyStats.school.absent}회`,
                `Abs ${monthlyStats.school.absent}`,
                `缺席 ${monthlyStats.school.absent}次`
              )}
            </span>
            <span>·</span>
            <span className="text-sage-800/70">
              {tr(
                lang,
                `휴강 ${monthlyStats.school.cancelled}회(제외)`,
                `Off ${monthlyStats.school.cancelled} (Excl)`,
                `停课 ${monthlyStats.school.cancelled}次(扣除)`
              )}
            </span>
          </div>
        </div>

        {/* MINIMALIST PER-ACADEMY AT-A-GLANCE GRID (Academy Name + Rate Only) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-violet-600" />
              <h3 className="text-xs font-bold text-slate-900">
                {tr(
                  lang,
                  `학원별 출석률 (${monthlyStats.perAcademyStats.length}곳)`,
                  `By Academy (${monthlyStats.perAcademyStats.length})`,
                  `各补习班出勤率 (${monthlyStats.perAcademyStats.length}家)`
                )}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {tr(lang, '(터치하여 상세 보기)', '(Tap for details)', '(点击查看详情)')}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-mono font-bold tabular-nums">
              {tr(
                lang,
                `전체 평균 ${monthlyStats.academyTotal.rate}%`,
                `Avg ${monthlyStats.academyTotal.rate}%`,
                `总平均 ${monthlyStats.academyTotal.rate}%`
              )}
            </span>
          </div>

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
            <div className="grid grid-cols-2 gap-1.5">
              {monthlyStats.perAcademyStats.map(
                ({ academyName, stats, pendingMakeupCount }) => {
                  const isSelected = selectedAcademyDetail === academyName;
                  const isLowRate = stats.totalRecorded > 0 && stats.rate < 85;
                  const isWarningRate =
                    stats.totalRecorded > 0 && stats.rate >= 85 && stats.rate < 100;

                  const rateColorClass =
                    stats.totalRecorded === 0
                      ? 'text-slate-400'
                      : stats.rate < 75
                      ? 'text-accent-800'
                      : stats.rate < 90
                      ? 'text-accent-600'
                      : 'text-slate-900';

                  return (
                    <button
                      key={academyName}
                      type="button"
                      onClick={() =>
                        setSelectedAcademyDetail((prev) =>
                          prev === academyName ? null : academyName
                        )
                      }
                      className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-1.5 text-left transition-all ${
                        isSelected
                          ? 'bg-accent-100 text-accent-900 border-accent'
                          : isLowRate
                          ? 'bg-paper border-accent-800/40 hover:border-accent-800'
                          : isWarningRate
                          ? 'bg-paper border-accent-300 hover:border-accent'
                          : 'bg-paper border-transparent hover:border-divider'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? 'text-accent-900' : 'text-slate-900'
                          }`}
                        >
                          {translateSubject(academyName, lang)}
                        </span>
                        {pendingMakeupCount > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected ? 'bg-accent-800' : 'bg-accent'
                            }`}
                            title={`Pending Makeup: ${pendingMakeupCount}`}
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-xs font-mono font-bold tabular-nums ${
                            isSelected ? 'text-accent-900' : rateColorClass
                          }`}
                        >
                          {stats.totalRecorded === 0 ? '-' : `${stats.rate}%`}
                        </span>
                        {isSelected ? (
                          <ChevronUp className="w-3.5 h-3.5 text-accent-700" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          )}

          {/* EXPANDED DETAIL PANEL WHEN AN ACADEMY IS CLICKED */}
          {activeAcademyDetailObj && (
            <div className="mt-2 p-3 rounded-xl bg-paper space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {translateSubject(activeAcademyDetailObj.academyName, lang)}{' '}
                    {tr(lang, '상세 출결 리포트', 'Attendance Report', '详细出勤报告')}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tabular-nums ${
                      activeAcademyDetailObj.stats.rate < 75
                        ? 'bg-accent-800 text-accent-100'
                        : activeAcademyDetailObj.stats.rate < 90
                        ? 'bg-accent-300 text-accent-900'
                        : 'bg-accent-100 text-accent-800'
                    }`}
                  >
                    {tr(lang, '출석률', 'Rate', '出勤率')} {activeAcademyDetailObj.stats.rate}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAcademyDetail(null)}
                  className="p-1 rounded-full text-slate-500 hover:text-ink hover:bg-slate-200/60"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1) Concrete Counts Grid: 출석횟수 / 지각횟수 / 결석횟수 (+ 공식휴강) */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="p-2 rounded bg-surface">
                  <div className="text-[10px] font-semibold text-slate-500">
                    {tr(lang, '출석 횟수', 'Present', '出勤次数')}
                  </div>
                  <div className="text-base font-mono text-sage-800 tabular-nums mt-0.5">
                    {tr(
                      lang,
                      `${activeAcademyDetailObj.stats.present}회`,
                      `${activeAcademyDetailObj.stats.present}`,
                      `${activeAcademyDetailObj.stats.present}次`
                    )}
                  </div>
                </div>
                <div className="p-2 rounded bg-surface">
                  <div className="text-[10px] font-semibold text-slate-500">
                    {tr(lang, '지각 횟수', 'Late', '迟到次数')}
                  </div>
                  <div className="text-base font-mono text-accent-700 tabular-nums mt-0.5">
                    {tr(
                      lang,
                      `${activeAcademyDetailObj.stats.late}회`,
                      `${activeAcademyDetailObj.stats.late}`,
                      `${activeAcademyDetailObj.stats.late}次`
                    )}
                  </div>
                </div>
                <div className="p-2 rounded bg-surface">
                  <div className="text-[10px] font-semibold text-slate-500">
                    {tr(lang, '결석 횟수', 'Absent', '缺席次数')}
                  </div>
                  <div className="text-base font-mono text-accent-800 tabular-nums mt-0.5">
                    {tr(
                      lang,
                      `${activeAcademyDetailObj.stats.absent}회`,
                      `${activeAcademyDetailObj.stats.absent}`,
                      `${activeAcademyDetailObj.stats.absent}次`
                    )}
                  </div>
                </div>
                <div className="p-2 rounded bg-surface">
                  <div className="text-[10px] font-semibold text-slate-400">
                    {tr(lang, '휴강(제외)', 'Off (Excl)', '停课(扣除)')}
                  </div>
                  <div className="text-base font-mono text-slate-500 tabular-nums mt-0.5">
                    {tr(
                      lang,
                      `${activeAcademyDetailObj.stats.cancelled}회`,
                      `${activeAcademyDetailObj.stats.cancelled}`,
                      `${activeAcademyDetailObj.stats.cancelled}次`
                    )}
                  </div>
                </div>
              </div>

              {/* 2) Specific Late Days (지각한 날) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent-300" />
                    {tr(
                      lang,
                      `지각한 날 (${activeAcademyDetailObj.stats.lateDays.length}일)`,
                      `Late Dates (${activeAcademyDetailObj.stats.lateDays.length})`,
                      `迟到日期 (${activeAcademyDetailObj.stats.lateDays.length}天)`
                    )}
                  </span>
                </div>
                {activeAcademyDetailObj.stats.lateDays.length === 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-surface text-[11px] text-slate-500">
                    {tr(
                      lang,
                      '이번 달 지각한 날이 없습니다.',
                      'No late records this month.',
                      '本月没有迟到记录。'
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeAcademyDetailObj.stats.lateDays.map((item) => (
                      <div
                        key={item.dateStr}
                        onClick={() => setSelectedDateStr(item.dateStr)}
                        className="px-3 py-2 rounded-xl bg-surface flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-accent-700 shrink-0" />
                            <span className="text-xs font-bold font-mono text-slate-900 tabular-nums">
                              {item.shortDateLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-accent-300 text-accent-900 text-[10px] font-bold">
                              {tr(lang, '지각', 'Late', '迟到')}
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3) Specific Absent Days (결석한 날) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent-800" />
                    {tr(
                      lang,
                      `결석한 날 (${activeAcademyDetailObj.stats.absentDays.length}일)`,
                      `Absent Dates (${activeAcademyDetailObj.stats.absentDays.length})`,
                      `缺席日期 (${activeAcademyDetailObj.stats.absentDays.length}天)`
                    )}
                  </span>
                </div>
                {activeAcademyDetailObj.stats.absentDays.length === 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-surface text-[11px] text-slate-500">
                    {tr(
                      lang,
                      '이번 달 결석한 날이 없습니다.',
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
                        <div
                          onClick={() => setSelectedDateStr(item.dateStr)}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Calendar className="w-3.5 h-3.5 text-accent-800 shrink-0" />
                            <span className="text-xs font-bold font-mono text-slate-900 tabular-nums">
                              {item.shortDateLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-accent-800 text-accent-100 text-[10px] font-bold">
                              {tr(lang, '결석', 'Absent', '缺席')}
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
                        </div>

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
                            onClick={() => setSelectedDateStr(item.dateStr)}
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

        {/* Pending Makeup Alert Card */}
        <div
          className={`p-3 rounded-xl ${
            monthlyStats.pendingMakeups.length > 0
              ? 'bg-accent-100 text-accent-900'
              : 'bg-sage-100 text-sage-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {monthlyStats.pendingMakeups.length > 0 ? (
                <AlertCircle className="w-4 h-4 text-accent-800 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-sage-800 shrink-0" />
              )}
              <span className="text-xs font-bold tabular-nums">
                {tr(
                  lang,
                  `미완료 보강 건수: ${monthlyStats.pendingMakeups.length}건`,
                  `Pending Makeups: ${monthlyStats.pendingMakeups.length}`,
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
                  <div
                    onClick={() => {
                      setSelectedDateStr(mk.dateStr);
                      setSelectedAcademyDetail(mk.academyName);
                    }}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">
                        {translateSubject(mk.academyName, lang)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        ({mk.shortDateLabel} {tr(lang, '결석', 'Absent', '缺席')})
                      </span>
                    </div>
                    {mk.reason && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {tr(lang, '사유: ', 'Reason: ', '原因：')}
                        {translateSampleText(mk.reason, lang)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateAcademyDetail(mk.dateStr, mk.academyName, {
                        makeupCompleted: true,
                      })
                    }
                    className="h-[30px] px-2.5 rounded-full bg-accent text-paper text-[11px] font-bold hover:bg-accent-600 shrink-0 whitespace-nowrap"
                  >
                    {tr(lang, '보강 완료 체크', 'Complete', '完成补课')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2. MONTHLY INTUITIVE ATTENDANCE CALENDAR */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-divider flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-bold text-slate-700">
            {tr(lang, '상단 바: 학교 · 하단 점: ', 'Bar: School · Dots: ', '顶部条：学校 · 底部点：')}
            {selectedAcademyDetail
              ? translateSubject(selectedAcademyDetail, lang)
              : tr(lang, '전체 학원', 'All Academies', '全部补习班')}
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sage" />{' '}
              {tr(lang, '출석', 'Pres', '出勤')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-300" />{' '}
              {tr(lang, '지각', 'Late', '迟到')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-800" />{' '}
              {tr(lang, '결석', 'Abs', '缺席')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />{' '}
              {tr(lang, '휴강', 'Off', '停课')}
            </span>
          </div>
        </div>

        {/* Day of Week Header */}
        <div className="grid grid-cols-7 border-b border-divider text-center">
          {calendarWeekHeader.map((d, idx) => (
            <div
              key={d}
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
            const schoolMeta = cell.schoolRecord
              ? STATUS_META[cell.schoolRecord.status]
              : null;

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDateStr(cell.dateStr)}
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
                      cell.isToday
                        ? 'bg-accent text-paper'
                        : 'text-ink'
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

      {/* 3. DAY-LINKED 1-TOUCH ATTENDANCE RECORDER & MAKEUP CHECK */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-bold text-slate-900 tabular-nums">
              {selectedDateStr} ({translateDay(selectedDayResolved.dayOfWeek, lang)}){' '}
              {tr(lang, '원터치 출석 체크', '1-Touch Attendance Check', '一键出勤登记')}
            </h3>
            <p className="text-[11px] text-slate-500">
              {tr(
                lang,
                '해당 요일 시간표에 배정된 학교 및 학원 목록이 자동 연동됩니다.',
                'Automatically linked to school & academy classes scheduled for this day.',
                '自动关联该星期课表中排定的学校与补习班列表。'
              )}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* School Attendance Block */}
          <div className="p-3.5 rounded-xl bg-paper space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                >
                  <RotateCcw className="w-3 h-3" /> {tr(lang, '초기화', 'Clear', '重置')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(['present', 'late', 'absent', 'cancelled'] as AttendanceStatus[]).map((st) => {
                const meta = STATUS_META[st];
                const isSelected = selectedDayResolved.schoolRecord?.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleSetSchoolStatus(st)}
                    className={`min-h-[36px] py-2 px-2 rounded-full text-xs font-bold border transition-all ${
                      isSelected
                        ? meta.btnActive
                        : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                    }`}
                  >
                    {tr(lang, meta.ko, meta.en, meta.zh)}
                  </button>
                );
              })}
            </div>

            {selectedDayResolved.schoolRecord &&
              (selectedDayResolved.schoolRecord.status === 'late' ||
                selectedDayResolved.schoolRecord.status === 'absent' ||
                selectedDayResolved.schoolRecord.status === 'cancelled') && (
                <div>
                  <input
                    type="text"
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
              <Building2 className="w-4 h-4 text-violet-600" />
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
                  '이 요일에 배정된 학원 수업이 없습니다.',
                  'No academy classes scheduled for this day.',
                  '该星期未安排补习班课程。'
                )}
              </div>
            ) : (
              selectedDayResolved.academyList.map((ac) => {
                const rec = ac.record;
                return (
                  <div
                    key={ac.name}
                    className="p-3.5 rounded-xl bg-paper space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
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
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                        >
                          <RotateCcw className="w-3 h-3" /> {tr(lang, '초기화', 'Clear', '重置')}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(['present', 'late', 'absent', 'cancelled'] as AttendanceStatus[]).map(
                        (st) => {
                          const meta = STATUS_META[st];
                          const isSelected = rec?.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleSetAcademyStatus(ac.name, st)}
                              className={`min-h-[36px] py-2 px-2 rounded-full text-xs font-bold border transition-all ${
                                isSelected
                                  ? meta.btnActive
                                  : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                              }`}
                            >
                              {tr(lang, meta.ko, meta.en, meta.zh)}
                            </button>
                          );
                        }
                      )}
                    </div>

                    {rec &&
                      (rec.status === 'late' ||
                        rec.status === 'absent' ||
                        rec.status === 'cancelled') && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
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
                            <div className="flex items-center justify-between gap-2 pt-1">
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
    </div>
  );
};
