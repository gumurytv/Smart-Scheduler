import React from 'react';
import { AlertTriangle, Building2, CalendarDays, Clock, GraduationCap, StickyNote } from 'lucide-react';
import { AppLanguage, HomeWidgetId, ScheduleCategory, SlotStatus, WidgetConfig } from '../types';
import { tr } from '../i18n/translations';
import type {
  HomeWidgetsData,
  MonthCalendarWidgetData,
  NowWidgetData,
  TimelineWidgetData,
  WeeklyAcademyWidgetData,
  WeeklySchoolWidgetData,
} from '../utils/widgetSync';

type WidgetTheme = WidgetConfig['theme'];
type WidgetSize = 'medium' | 'large' | 'largeTall';

// ===================== Widget catalog (name / size / description) =====================

export interface HomeWidgetMeta {
  size: WidgetSize;
  name: (lang: AppLanguage) => string;
  sizeLabel: (lang: AppLanguage) => string;
  description: (lang: AppLanguage) => string;
  source: (lang: AppLanguage) => string;
}

export const HOME_WIDGET_META: Record<HomeWidgetId, HomeWidgetMeta> = {
  weeklySchool: {
    size: 'large',
    name: (l) => tr(l, '주간 학교 시간표', 'Weekly School Timetable', '每周学校课表'),
    sizeLabel: (l) => tr(l, '대형 · 4×3', 'Large · 4×3', '大 · 4×3'),
    description: (l) =>
      tr(
        l,
        '이번 주 월~금 교시별 과목을 한눈에. 오늘 요일이 강조돼요.',
        'Mon–Fri subjects by period for this week, with today highlighted.',
        '本周一至周五各节课程一目了然，今天会高亮显示。'
      ),
    source: (l) => tr(l, '시간표', 'Timetable', '课表'),
  },
  weeklyAcademy: {
    size: 'large',
    name: (l) => tr(l, '주간 학원 시간표', 'Weekly Academy Timetable', '每周补习班课表'),
    sizeLabel: (l) => tr(l, '대형 · 4×3', 'Large · 4×3', '大 · 4×3'),
    description: (l) =>
      tr(
        l,
        '월~일 요일별 학원 수업 시간과 과목, 보강·휴강 표시.',
        'Academy classes Mon–Sun with times, makeups and cancellations.',
        '周一至周日补习班时间与科目，标注补课与停课。'
      ),
    source: (l) => tr(l, '시간표', 'Timetable', '课表'),
  },
  now: {
    size: 'medium',
    name: (l) => tr(l, '지금', 'Now', '现在'),
    sizeLabel: (l) => tr(l, '중형 · 4×2', 'Medium · 4×2', '中 · 4×2'),
    description: (l) =>
      tr(
        l,
        '지금 진행 중인 수업과 남은 시간, 다음 수업, 오늘 보강/특강.',
        'Current class with time left, next class and today’s makeups.',
        '当前课程与剩余时间、下一节课及今日补课。'
      ),
    source: (l) => tr(l, '시간표', 'Timetable', '课表'),
  },
  timeline: {
    size: 'largeTall',
    name: (l) => tr(l, '오늘 타임라인', "Today's Timeline", '今日时间线'),
    sizeLabel: (l) => tr(l, '대형 · 4×4', 'Large · 4×4', '大 · 4×4'),
    description: (l) =>
      tr(
        l,
        '오늘의 학교·학원·일정을 시간순으로, 빈 시간과 상태(휴강/결석/자습)까지.',
        "Today's school, academy and events in order, with free time and statuses.",
        '按时间顺序显示今日学校、补习班与日程，含空闲时间和状态。'
      ),
    source: (l) => tr(l, '시간표', 'Timetable', '课表'),
  },
  monthCalendar: {
    size: 'large',
    name: (l) => tr(l, '월간 캘린더', 'Monthly Calendar', '月历'),
    sizeLabel: (l) => tr(l, '대형 · 4×4', 'Large · 4×4', '大 · 4×4'),
    description: (l) =>
      tr(
        l,
        '이번 달 일정을 날짜별 색 점(학교·학원·기타)으로 표시해요.',
        'This month’s events as coloured dots per day (school / academy / other).',
        '以彩色圆点按日期显示本月日程（学校/补习班/其他）。'
      ),
    source: (l) => tr(l, '일정표', 'Schedule', '日程表'),
  },
};

// ===================== Theme palette =====================

interface Palette {
  frame: string;
  sub: string;
  muted: string;
  panel: string;
  divider: string;
  schoolCell: string;
  schoolToday: string;
  academyChip: string;
  todayHead: string;
  todayRow: string;
  icon: string;
}

const PALETTES: Record<WidgetTheme, Palette> = {
  light: {
    frame: 'bg-paper text-ink',
    sub: 'text-slate-600',
    muted: 'text-slate-400',
    panel: 'bg-surface',
    divider: 'border-divider',
    schoolCell: 'bg-sage-100/60 text-sage-900',
    schoolToday: 'bg-sage-100 text-sage-900 font-semibold',
    academyChip: 'bg-accent-100 text-accent-800',
    todayHead: 'bg-accent-100 text-accent-800',
    todayRow: 'bg-accent-100/60',
    icon: 'text-accent',
  },
  dark: {
    frame: 'bg-slate-900 text-slate-100',
    sub: 'text-slate-400',
    muted: 'text-slate-500',
    panel: 'bg-slate-800',
    divider: 'border-slate-700',
    schoolCell: 'bg-sage-900/70 text-sage-200',
    schoolToday: 'bg-sage-800 text-sage-100 font-semibold',
    academyChip: 'bg-accent-900/80 text-accent-200',
    todayHead: 'bg-accent/25 text-accent-300',
    todayRow: 'bg-accent/15',
    icon: 'text-accent-400',
  },
};

const SIZE_CLASS: Record<WidgetSize, string> = {
  medium: 'h-[176px]',
  large: 'h-[292px]',
  largeTall: 'h-[340px]',
};

/** Background opacity of the widget frame (Settings → 배경 투명도), 0–1. */
const WidgetBgOpacity = React.createContext(1);
const FRAME_RGB: Record<WidgetTheme, string> = { light: '245, 234, 216', dark: '32, 30, 29' };

const WidgetFrame: React.FC<{
  theme: WidgetTheme;
  size: WidgetSize;
  children: React.ReactNode;
  className?: string;
}> = ({ theme, size, children, className = '' }) => {
  const opacity = React.useContext(WidgetBgOpacity);
  return (
    <div
      className={`w-full max-w-[360px] mx-auto rounded-[26px] p-3 overflow-hidden flex flex-col ${
        opacity < 1 ? '' : 'shadow-md'
      } ${SIZE_CLASS[size]} ${PALETTES[theme].frame} ${className}`}
      style={opacity < 1 ? { backgroundColor: `rgba(${FRAME_RGB[theme]}, ${opacity})` } : undefined}
    >
      {children}
    </div>
  );
};

const WidgetHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  p: Palette;
}> = ({ icon, title, right, p }) => (
  <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
    <div className="flex items-center gap-1.5 min-w-0">
      {icon}
      <span className="text-[0.75rem] font-bold truncate">{title}</span>
    </div>
    {right && <span className={`text-[0.625rem] font-mono tabular-nums shrink-0 ${p.sub}`}>{right}</span>}
  </div>
);

const StatusPill: React.FC<{ status?: SlotStatus; label?: string; dark?: boolean }> = ({ status, label, dark }) => {
  if (!status || status === 'cancelled' || !label) return null;
  return (
    <span
      className={`px-1 rounded-full text-[0.5rem] font-bold whitespace-nowrap ${
        status === 'absent'
          ? 'bg-accent-800 text-paper'
          : dark
          ? 'bg-sage-700 text-sage-100'
          : 'bg-sage-200 text-sage-900'
      }`}
    >
      {label}
    </span>
  );
};

// ===================== 1) Weekly school (Mon–Fri) =====================

export const WeeklySchoolWidget: React.FC<{ data: WeeklySchoolWidgetData; theme: WidgetTheme; lang: AppLanguage }> = ({
  data,
  theme,
  lang,
}) => {
  const p = PALETTES[theme];
  const rows = Math.min(data.periodCount, 8);
  return (
    <WidgetFrame theme={theme} size="large">
      <WidgetHeader
        p={p}
        icon={<GraduationCap className="w-3.5 h-3.5 text-sage shrink-0" />}
        title={data.title}
        right={tr(lang, '월~금', 'Mon–Fri', '周一至周五')}
      />
      <div
        className="flex-1 min-h-0 grid gap-[3px] text-center"
        style={{
          gridTemplateColumns: '30px repeat(5, minmax(0, 1fr))',
          gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {data.days.map((d) => (
          <div
            key={d.date}
            className={`rounded-md py-0.5 text-[0.625rem] font-bold leading-tight ${d.isToday ? p.todayHead : ''}`}
          >
            {d.dayLabel}
            <span className={`block font-mono text-[0.5rem] font-normal ${d.isToday ? '' : p.sub}`}>{d.dayNum}</span>
          </div>
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center justify-center font-mono text-[0.5625rem] tabular-nums ${p.sub}`}>
              {i + 1}
            </div>
            {data.days.map((d) => {
              const cell = d.periods[i];
              if (!cell || !cell.subject.trim()) {
                return (
                  <div key={d.date} className={`flex items-center justify-center text-[0.625rem] ${p.muted}`}>
                    -
                  </div>
                );
              }
              const cls = cell.isCancelled
                ? `${p.muted} line-through`
                : cell.status === 'absent'
                ? theme === 'dark'
                  ? 'bg-accent-900 text-accent-200 font-semibold'
                  : 'bg-accent-100 text-accent-900 font-semibold'
                : cell.status === 'selfStudy'
                ? theme === 'dark'
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-slate-200 text-ink'
                : d.isToday
                ? p.schoolToday
                : p.schoolCell;
              return (
                <div
                  key={d.date}
                  className={`relative rounded-md flex items-center justify-center px-0.5 text-[0.625rem] leading-none min-w-0 ${cls}`}
                >
                  <span className="truncate">{cell.subjectLabel}</span>
                  {(cell.note || cell.status === 'absent') && (
                    <span
                      className={`absolute top-0.5 right-0.5 w-1 h-1 rounded-full ${
                        cell.status === 'absent' ? 'bg-accent-700' : 'bg-slate-500'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </WidgetFrame>
  );
};

// ===================== 2) Weekly academy (Mon–Sun) =====================

export const WeeklyAcademyWidget: React.FC<{ data: WeeklyAcademyWidgetData; theme: WidgetTheme; lang: AppLanguage }> = ({
  data,
  theme,
  lang,
}) => {
  const p = PALETTES[theme];
  const MAX_CHIPS = 2;
  return (
    <WidgetFrame theme={theme} size="large">
      <WidgetHeader
        p={p}
        icon={<Building2 className={`w-3.5 h-3.5 shrink-0 ${p.icon}`} />}
        title={data.title}
        right={tr(lang, '월~일', 'Mon–Sun', '周一至周日')}
      />
      <div className={`flex-1 min-h-0 flex flex-col divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-divider'}`}>
        {data.days.map((d) => {
          const extra = d.items.length - MAX_CHIPS;
          return (
            <div
              key={d.date}
              className={`flex-1 min-h-0 flex items-center gap-1.5 px-1 rounded-md ${d.isToday ? p.todayRow : ''}`}
            >
              <div className="w-7 shrink-0 text-[0.625rem] font-bold leading-none">
                <span className={d.isToday ? (theme === 'dark' ? 'text-accent-300' : 'text-accent-800') : ''}>
                  {d.dayLabel}
                </span>
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                {d.items.length === 0 ? (
                  <span className={`text-[0.5625rem] ${p.muted}`}>{tr(lang, '없음', 'None', '无')}</span>
                ) : (
                  d.items.slice(0, MAX_CHIPS).map((it) => (
                    <span
                      key={it.id}
                      className={`min-w-0 px-1.5 py-[3px] rounded-full text-[0.5625rem] leading-none inline-flex items-center gap-1 ${
                        it.isCancelled
                          ? `border border-dashed ${theme === 'dark' ? 'border-slate-600' : 'border-slate-400'} ${p.muted} line-through`
                          : it.status === 'selfStudy'
                          ? theme === 'dark'
                            ? 'bg-slate-700 text-slate-100'
                            : 'bg-slate-200 text-ink'
                          : p.academyChip
                      }`}
                    >
                      {it.isOverlapping && !it.isCancelled && (
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-orange-500" />
                      )}
                      <span className="font-mono tabular-nums shrink-0">{it.startTime}</span>
                      <span className="font-bold truncate">{it.subjectLabel}</span>
                      {it.isAdded && !it.isCancelled && (
                        <span className="shrink-0 font-bold">{tr(lang, '보강', 'M', '补')}</span>
                      )}
                    </span>
                  ))
                )}
                {extra > 0 && <span className={`text-[0.5625rem] font-mono shrink-0 ${p.sub}`}>+{extra}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetFrame>
  );
};

// ===================== 3) Now card =====================

export const NowWidget: React.FC<{ data: NowWidgetData; theme: WidgetTheme; lang: AppLanguage }> = ({
  data,
  theme,
  lang,
}) => {
  const p = PALETTES[theme];
  const cur = data.current[0];
  const makeupCount = data.makeups.length + data.makeupSchedules.length;
  return (
    <WidgetFrame theme={theme} size="medium">
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div>
          <div className={`inline-flex items-center gap-1.5 text-[0.625rem] font-bold ${p.sub}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse" />
            {tr(lang, '지금', 'Now', '现在')}
          </div>
          <div className="font-mono text-[30px] leading-none tabular-nums">{data.timeLabel}</div>
        </div>
        <div className="text-right">
          <div className={`text-[0.625rem] font-semibold ${p.sub}`}>{data.dateLabel}</div>
          {makeupCount > 0 && (
            <span className="mt-1 inline-block px-1.5 py-0.5 rounded-full bg-accent-700 text-paper text-[0.5625rem] font-bold">
              {tr(lang, `보강 ${makeupCount}`, `Makeup ${makeupCount}`, `补课 ${makeupCount}`)}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2 flex flex-col gap-1.5">
        {cur ? (
          <div
            className={`rounded-2xl px-2.5 py-2 text-paper ${cur.kind === 'school' ? 'bg-sage-800' : 'bg-accent-800'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.8125rem] font-bold truncate">{cur.title}</span>
              <span className="shrink-0 font-mono text-[0.8125rem] tabular-nums">
                {tr(lang, `${cur.remainingLabel} 남음`, `${cur.remainingLabel} left`, `剩余${cur.remainingLabel}`)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-paper/20 overflow-hidden">
              <div
                className={`h-full rounded-full ${cur.kind === 'school' ? 'bg-sage-300' : 'bg-accent-300'}`}
                style={{ width: `${cur.progressPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className={`rounded-2xl px-2.5 py-2 ${p.panel}`}>
            <div className="text-[0.8125rem] font-bold">{tr(lang, '지금은 빈 시간', 'Free right now', '现在是空闲时间')}</div>
          </div>
        )}
        <div className={`rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 ${p.panel}`}>
          {data.next ? (
            <>
              <div className="min-w-0 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${data.next.kind === 'school' ? 'bg-sage' : 'bg-accent'}`}
                />
                <span className={`text-[0.625rem] font-bold shrink-0 ${p.sub}`}>{tr(lang, '다음', 'Next', '下一个')}</span>
                <span className="text-[0.6875rem] font-bold truncate">{data.next.title}</span>
              </div>
              <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums">
                {data.next.startTime}
                <span className={`ml-1 ${theme === 'dark' ? 'text-accent-300' : 'text-accent-700'}`}>
                  {tr(lang, `${data.next.startsInLabel} 후`, `in ${data.next.startsInLabel}`, `${data.next.startsInLabel}后`)}
                </span>
              </span>
            </>
          ) : (
            <span className={`text-[0.6875rem] font-semibold ${p.sub}`}>
              {tr(lang, '오늘 남은 수업이 없어요', 'No more classes today', '今天没有剩余课程')}
            </span>
          )}
        </div>
      </div>
    </WidgetFrame>
  );
};

// ===================== 4) Today's timeline =====================

export const TimelineWidget: React.FC<{ data: TimelineWidgetData; theme: WidgetTheme; lang: AppLanguage }> = ({
  data,
  theme,
  lang,
}) => {
  const p = PALETTES[theme];
  type Row =
    | { type: 'item'; key: string; sort: string; item: TimelineWidgetData['items'][number] }
    | { type: 'free'; key: string; sort: string; free: TimelineWidgetData['freeSlots'][number] };
  const rows: Row[] = [
    ...data.items.map((item) => ({ type: 'item' as const, key: item.key, sort: item.startTime, item })),
    ...data.freeSlots.map((free) => ({
      type: 'free' as const,
      key: `free-${free.startTime}`,
      sort: free.startTime,
      free,
    })),
  ].sort((a, b) => a.sort.localeCompare(b.sort));
  // Keep the list focused around "now": drop past rows beyond the last two.
  const firstUpcoming = rows.findIndex((r) => r.type === 'item' && r.item.phase !== 'past');
  const startIdx = firstUpcoming > 2 ? firstUpcoming - 2 : 0;
  const MAX = 9;
  const visible = rows.slice(startIdx, startIdx + MAX);
  const hidden = rows.length - visible.length;

  return (
    <WidgetFrame theme={theme} size="largeTall">
      <WidgetHeader
        p={p}
        icon={<Clock className={`w-3.5 h-3.5 shrink-0 ${p.icon}`} />}
        title={`${tr(lang, '오늘', 'Today', '今天')} · ${data.dateLabel}`}
        right={tr(lang, `빈 시간 ${data.totalFreeLabel}`, `Free ${data.totalFreeLabel}`, `空闲 ${data.totalFreeLabel}`)}
      />
      <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
        {visible.length === 0 && (
          <div className={`text-[0.6875rem] text-center py-6 ${p.muted}`}>
            {tr(lang, '오늘 일정이 없어요', 'Nothing today', '今天没有安排')}
          </div>
        )}
        {visible.map((r) => {
          if (r.type === 'free') {
            return (
              <div
                key={r.key}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg border border-dashed text-[0.625rem] ${
                  theme === 'dark' ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-600'
                }`}
              >
                <span className="font-mono tabular-nums w-[74px] shrink-0">
                  {r.free.startTime}~{r.free.endTime}
                </span>
                <span className="font-semibold">
                  {tr(lang, '빈 시간', 'Free', '空闲')} · {r.free.durationLabel}
                </span>
              </div>
            );
          }
          const it = r.item;
          const bar = it.kind === 'school' ? 'bg-sage' : it.kind === 'academy' ? 'bg-accent' : 'bg-other';
          const isCurrent = it.phase === 'current';
          return (
            <div
              key={r.key}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg ${
                isCurrent ? (theme === 'dark' ? 'bg-slate-800 ring-1 ring-accent-400' : 'bg-surface ring-1 ring-accent') : ''
              } ${it.phase === 'past' ? 'opacity-55' : ''}`}
            >
              <span className={`w-1 self-stretch rounded-full shrink-0 ${it.isCancelled ? 'bg-slate-400' : bar}`} />
              <span className="font-mono text-[0.625rem] tabular-nums w-[66px] shrink-0">
                {it.kind === 'schedule' ? it.startTime : `${it.startTime}~${it.endTime}`}
              </span>
              <div className="min-w-0 flex-1 flex items-center gap-1">
                <span className={`text-[0.5625rem] font-semibold shrink-0 ${p.sub}`}>{it.kindLabel}</span>
                <span className={`text-[0.6875rem] font-bold truncate ${it.isCancelled ? 'line-through opacity-70' : ''}`}>
                  {it.title}
                </span>
                {it.isCancelled && (
                  <span className="px-1 rounded-full text-[0.5rem] font-bold bg-slate-400 text-paper shrink-0">
                    {tr(lang, '휴강', 'Cancelled', '停课')}
                  </span>
                )}
                <StatusPill status={it.status} label={it.statusLabel} dark={theme === 'dark'} />
                {it.note && <StickyNote className={`w-2.5 h-2.5 shrink-0 ${p.sub}`} />}
              </div>
              {isCurrent && (
                <span className={`text-[0.5625rem] font-bold shrink-0 ${theme === 'dark' ? 'text-accent-300' : 'text-accent-700'}`}>
                  {tr(lang, '지금', 'NOW', '现在')}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <div className={`pt-1 text-[0.5625rem] text-right font-mono shrink-0 ${p.sub}`}>
          {tr(lang, `외 ${hidden}개`, `+${hidden} more`, `另有${hidden}项`)}
        </div>
      )}
    </WidgetFrame>
  );
};

// ===================== 5) Monthly calendar =====================

const CATEGORY_DOT: Record<ScheduleCategory, string> = {
  school: 'bg-sage',
  academy: 'bg-accent',
  other: 'bg-other',
};

export const MonthCalendarWidget: React.FC<{ data: MonthCalendarWidgetData; theme: WidgetTheme; lang: AppLanguage }> = ({
  data,
  theme,
  lang,
}) => {
  const p = PALETTES[theme];
  const weeks = data.cells.length / 7;
  const today = data.cells.find((c) => c.isToday);
  return (
    <WidgetFrame theme={theme} size="large">
      <WidgetHeader
        p={p}
        icon={<CalendarDays className={`w-3.5 h-3.5 shrink-0 ${p.icon}`} />}
        title={data.title}
        right={
          <span className="inline-flex items-center gap-1.5 font-sans">
            {(['school', 'academy', 'other'] as ScheduleCategory[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[c]}`} />
                {c === 'school'
                  ? tr(lang, '학교', 'School', '学校')
                  : c === 'academy'
                  ? tr(lang, '학원', 'Academy', '补习班')
                  : tr(lang, '기타', 'Other', '其他')}
              </span>
            ))}
          </span>
        }
      />
      <div className="grid grid-cols-7 text-center shrink-0">
        {data.weekHeader.map((d, i) => (
          <div
            key={i}
            className={`text-[0.5625rem] font-semibold pb-0.5 ${
              i === 0 ? 'text-accent-600' : i === 6 ? 'text-sage-600' : p.sub
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="flex-1 min-h-0 grid grid-cols-7 gap-[2px]"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {data.cells.map((c) => {
          const cats = (['school', 'academy', 'other'] as ScheduleCategory[]).filter((k) => c.counts[k] > 0);
          return (
            <div
              key={c.date}
              title={c.titles.map((t) => t.titleLabel).join(', ')}
              className={`rounded-md flex flex-col items-center justify-center gap-[2px] ${
                c.isToday ? 'bg-accent text-paper' : ''
              } ${!c.isCurrentMonth && !c.isToday ? p.muted : ''}`}
            >
              <span className="font-mono text-[0.625rem] leading-none tabular-nums">{c.dayNum}</span>
              <span className="flex items-center gap-[2px] h-1">
                {cats.map((k) => (
                  <span
                    key={k}
                    className={`w-1 h-1 rounded-full ${c.isToday ? 'bg-paper' : CATEGORY_DOT[k]} ${
                      c.isCurrentMonth ? '' : 'opacity-50'
                    }`}
                  />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div className={`mt-1.5 pt-1.5 border-t text-[0.625rem] flex items-center gap-1.5 min-w-0 shrink-0 ${p.divider}`}>
        <span className={`font-bold shrink-0 ${theme === 'dark' ? 'text-accent-300' : 'text-accent-700'}`}>
          {tr(lang, '오늘', 'Today', '今天')}
        </span>
        <span className="truncate font-semibold">
          {today && today.titles.length > 0
            ? today.titles.map((t) => t.titleLabel).join(' · ')
            : tr(lang, '일정 없음', 'No events', '无日程')}
        </span>
      </div>
    </WidgetFrame>
  );
};

// ===================== Dispatcher =====================

export const HomeWidgetPreview: React.FC<{
  id: HomeWidgetId;
  data: HomeWidgetsData;
  theme: WidgetTheme;
  lang: AppLanguage;
  /** Background opacity 0–1 (default opaque). */
  bgOpacity?: number;
}> = ({ id, data, theme, lang, bgOpacity = 1 }) => (
  <WidgetBgOpacity.Provider value={bgOpacity}>
    <WidgetPreviewBody id={id} data={data} theme={theme} lang={lang} />
  </WidgetBgOpacity.Provider>
);

const WidgetPreviewBody: React.FC<{
  id: HomeWidgetId;
  data: HomeWidgetsData;
  theme: WidgetTheme;
  lang: AppLanguage;
}> = ({ id, data, theme, lang }) => {
  switch (id) {
    case 'weeklySchool':
      return data.weeklySchool ? <WeeklySchoolWidget data={data.weeklySchool} theme={theme} lang={lang} /> : null;
    case 'weeklyAcademy':
      return data.weeklyAcademy ? <WeeklyAcademyWidget data={data.weeklyAcademy} theme={theme} lang={lang} /> : null;
    case 'now':
      return data.now ? <NowWidget data={data.now} theme={theme} lang={lang} /> : null;
    case 'timeline':
      return data.timeline ? <TimelineWidget data={data.timeline} theme={theme} lang={lang} /> : null;
    case 'monthCalendar':
      return data.monthCalendar ? <MonthCalendarWidget data={data.monthCalendar} theme={theme} lang={lang} /> : null;
    default:
      return null;
  }
};
