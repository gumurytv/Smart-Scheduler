import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Users,
  Hand,
  History,
  LayoutList,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Bell,
  BellRing,
  X,
  Copy,
  Camera,
  Upload,
  Download,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  Loader2,
  RotateCcw,
  Clock,
  Globe,
  Type,
  BookOpen,
  Check,
  Smartphone,
  Sun,
  Moon,
  Minus,
  GraduationCap,
  Building2,
  Settings2,
  Tags,
  ScanLine,
  DatabaseBackup,
  type LucideIcon,
  FlaskConical,
  Lock,
  IdCard,
  UserRound,
  PenLine,
  CalendarDays,
  StickyNote,
  Eraser,
  MessageSquareText,
} from 'lucide-react';
import {
  PlannerState,
  DAYS_OF_WEEK,
  DayOfWeek,
  AIExtractedEntry,
  SchoolPeriod,
  AcademyItem,
  AppLanguage,
  SchoolTimeConfig,
  DEFAULT_SCHOOL_TIME_CONFIG,
  DEFAULT_WIDGET_CONFIG,
  MasterTimetable,
  HOME_WIDGET_IDS,
  HomeWidgetId,
  WidgetConfig,
  WidgetFontScale,
  UserProfile,
  TextScale,
  TEXT_SCALES,
  REMINDER_LEADS,
  ReminderConfig,
  ReminderLead,
  DEFAULT_TIMETABLE_LAYOUT,
  TIMETABLE_BLOCK_GROUPS,
  TIMETABLE_FIXED_BLOCKS,
  TimetableBlockGroup,
  TimetableBlockId,
  timetableBlockRank,
} from '../types';
import { isAiTimetableEnabled } from '../utils/featureFlags';
import { API_BASE_URL, isNativeApp } from '../native/androidShell';
import { getPlacedHomeWidgets, pinHomeWidget } from '../native/homeWidgets';
import { RESET_PARTS, ResetMode, ResetPart, resetPlannerParts } from '../utils/appReset';
import { ParsedBackup, parseBackup } from '../utils/backupImport';
import { ImportSheet } from './ImportSheet';
import { GuideSheet } from './GuideSheet';
import { FeedbackPanel } from './FeedbackPanel';
import { exportBackupFile } from '../native/backupFile';
import { APP_VERSION, CHANGELOG } from '../data/changelog';
import { planMakeupReminders, reminderLeadLabel, requestReminderPermission } from '../native/reminders';
import { childFallbackName } from './ChildrenSheet';
import { childName, listChildren } from '../utils/children';
import { SUBJECT_COLORS, SUBJECT_COLOR_KEYS, SubjectColorKey, subjectColor } from '../utils/subjectColors';
import { createInitialPlannerState, formatDateKey, generatePeriodSchedule } from '../data/initialData';
import {
  tr,
  translateDay,
  translateSubject,
  translateSampleText,
} from '../i18n/translations';
import { buildHomeWidgetsData, getWidgetConfig, syncWidgetData } from '../utils/widgetSync';
import { HOME_WIDGET_META, HomeWidgetPreview } from './HomeWidgets';

interface SettingsTabProps {
  state: PlannerState;
  onUpdateState: (updater: (prev: PlannerState) => PlannerState) => void;
  /** A settings card to open and scroll to (e.g. from the 지금 card or the first-run guide), or 'top'. */
  focusSection?: string | null;
  onFocusHandled?: () => void;
  /** Opens the 자녀 선택 sheet (owned by App so the header can open it too). */
  onOpenChildren?: () => void;
  /** Shows the first-run guide again. */
  onReplayOnboarding?: () => void;
}

function minutesToTimeStr(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function timeStrToMinutes(time: string): number {
  const [h, m] = (time || '00:00').split(':').map((v) => Number(v) || 0);
  return h * 60 + m;
}

interface PresetPeriodRow {
  period: number;
  startTime: string;
  endTime: string;
}

/** Build period start/end times from a preset-mode school time config. */
function buildPresetPeriods(config: SchoolTimeConfig, count = config.periodCount): PresetPeriodRow[] {
  const rows: PresetPeriodRow[] = [];
  let cur = timeStrToMinutes(config.firstStart);
  for (let p = 1; p <= count; p++) {
    const end = cur + config.classMinutes;
    rows.push({ period: p, startTime: minutesToTimeStr(cur), endTime: minutesToTimeStr(end) });
    cur = end + (p === config.lunchAfterPeriod ? config.lunchMinutes : config.breakMinutes);
  }
  return rows;
}

/** Vertical scale of the preset preview ruler. */
const PREVIEW_PX_PER_MIN = 0.9;

const WEEKDAYS: DayOfWeek[] = ['월', '화', '수', '목', '금'];

/** Highest school period number across all days of the master timetable. */
function getMaxPeriod(master: MasterTimetable): number {
  let max = 0;
  DAYS_OF_WEEK.forEach((d) => {
    (master[d]?.school || []).forEach((p) => {
      if (p.period > max) max = p.period;
    });
  });
  return max;
}

/**
 * Start/end for a period row. Preset mode → computed from the preset.
 * Custom mode → the first day that has this period, otherwise extrapolated from the previous row.
 */
function resolveRowTimes(
  master: MasterTimetable,
  cfg: SchoolTimeConfig,
  period: number
): { startTime: string; endTime: string } {
  if (cfg.mode === 'preset') {
    const row = buildPresetPeriods(cfg, Math.max(1, period))[Math.max(1, period) - 1];
    return { startTime: row.startTime, endTime: row.endTime };
  }
  for (const d of DAYS_OF_WEEK) {
    const found = master[d]?.school.find((p) => p.period === period);
    if (found) return { startTime: found.startTime, endTime: found.endTime };
  }
  if (period <= 1) {
    return {
      startTime: cfg.firstStart,
      endTime: minutesToTimeStr(timeStrToMinutes(cfg.firstStart) + cfg.classMinutes),
    };
  }
  const prevRow = resolveRowTimes(master, cfg, period - 1);
  const duration = Math.max(5, timeStrToMinutes(prevRow.endTime) - timeStrToMinutes(prevRow.startTime));
  const start = timeStrToMinutes(prevRow.endTime) + cfg.breakMinutes;
  return { startTime: minutesToTimeStr(start), endTime: minutesToTimeStr(start + duration) };
}

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  decLabel: string;
  incLabel: string;
}

/** Pill-shaped "−  value  +" number stepper. */
const Stepper: React.FC<StepperProps> = ({ value, onChange, min, max, step = 1, suffix, decLabel, incLabel }) => (
  <div className="flex items-center h-9 rounded-full bg-paper border border-divider overflow-hidden">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - step))}
      disabled={value <= min}
      aria-label={decLabel}
      className="w-9 h-9 grid place-items-center text-sage-800 hover:bg-sage-100 disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
    >
      <Minus className="w-3.5 h-3.5" strokeWidth={2.75} />
    </button>
    <span className="flex-1 min-w-0 text-center font-mono text-[0.8125rem] text-ink tabular-nums">
      {value}
      {suffix && <span className="ml-0.5 font-sans text-[0.6875rem] font-semibold text-slate-600">{suffix}</span>}
    </span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + step))}
      disabled={value >= max}
      aria-label={incLabel}
      className="w-9 h-9 grid place-items-center text-sage-800 hover:bg-sage-100 disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
    >
      <Plus className="w-3.5 h-3.5" strokeWidth={2.75} />
    </button>
  </div>
);

type SettingsCardId = 'profile' | 'layout' | 'range' | 'school' | 'academy' | 'pool' | 'ai' | 'backup' | 'reminders' | 'widgets' | 'updates' | 'feedback';
const SETTINGS_CARD_IDS: SettingsCardId[] = ['profile', 'layout', 'range', 'school', 'academy', 'pool', 'ai', 'backup', 'reminders', 'widgets', 'updates', 'feedback'];
const OPEN_CARDS_STORAGE_KEY = 'smart-planner.settings.openCards.v1';

function loadOpenCards(): Partial<Record<SettingsCardId, boolean>> {
  try {
    const raw = window.localStorage.getItem(OPEN_CARDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<SettingsCardId, boolean>> = {};
    SETTINGS_CARD_IDS.forEach((id) => {
      if (parsed[id] === true) out[id] = true;
    });
    return out;
  } catch {
    return {};
  }
}

type SettingsCardTone = 'neutral' | 'sage' | 'accent' | 'other';
const CARD_TONES: Record<SettingsCardTone, { icon: string; openRing: string; chevron: string }> = {
  neutral: { icon: 'bg-paper text-ink', openRing: 'ring-1 ring-slate-300', chevron: 'text-slate-600' },
  sage: { icon: 'bg-sage-700 text-paper', openRing: 'ring-1 ring-sage-400', chevron: 'text-sage-800' },
  accent: { icon: 'bg-accent-700 text-paper', openRing: 'ring-1 ring-accent-300', chevron: 'text-accent-800' },
  other: { icon: 'bg-other-600 text-paper', openRing: 'ring-1 ring-other-300', chevron: 'text-other-700' },
};

interface SettingsCardProps {
  id: SettingsCardId;
  open: boolean;
  onToggle: (id: SettingsCardId) => void;
  tone: SettingsCardTone;
  icon: LucideIcon;
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
}

/** Collapsible settings card: icon · title · one-line state summary · chevron. */
const SettingsCard: React.FC<SettingsCardProps> = ({ id, open, onToggle, tone, icon: Icon, title, summary, children }) => {
  const t = CARD_TONES[tone];
  return (
    <section
      id={`settings-card-${id}`}
      className={`bg-surface rounded-2xl shadow-xs overflow-hidden scroll-mt-4 ${open ? t.openRing : ''}`}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`settings-panel-${id}`}
        className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-paper/40"
      >
        <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${t.icon}`}>
          <Icon strokeWidth={2.5} className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[0.8125rem] font-bold text-ink truncate">{title}</span>
          <span className="block text-[0.6875rem] text-slate-600 truncate">{summary}</span>
        </span>
        <ChevronDown
          strokeWidth={2.5}
          className={`w-4 h-4 shrink-0 ${t.chevron} ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={`settings-panel-${id}`} className="border-t border-divider">
          {children}
        </div>
      )}
    </section>
  );
};

interface SectionResetButtonProps {
  lang: AppLanguage;
  label: string;
  onConfirm: () => void;
  confirmText?: string;
  confirmLabel?: string;
  /** Optional second action next to "restore defaults": empty the section completely. */
  onClear?: () => void;
  clearText?: string;
}

/** Per-section "restore defaults" (and optional "clear all") row with an inline (in-page) confirmation step. */
const SectionResetButton: React.FC<SectionResetButtonProps> = ({
  lang,
  label,
  onConfirm,
  confirmText,
  confirmLabel,
  onClear,
  clearText,
}) => {
  const [confirming, setConfirming] = useState<'restore' | 'clear' | null>(null);
  const isClear = confirming === 'clear';
  return (
    <div className="pt-3 border-t border-divider">
      {!confirming ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirming('restore')}
            className="h-8 px-3 rounded-full border border-accent-800 text-accent-800 text-[0.6875rem] font-bold inline-flex items-center gap-1.5 hover:bg-accent-100 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} />
            {label}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => setConfirming('clear')}
              className="h-8 px-3 rounded-full border border-accent-800 text-accent-800 text-[0.6875rem] font-bold inline-flex items-center gap-1.5 hover:bg-accent-100 transition-colors whitespace-nowrap"
            >
              <Eraser className="w-3.5 h-3.5" strokeWidth={2.5} />
              {tr(lang, '모든 설정값 지우기', 'Clear everything', '清除全部设置')}
            </button>
          )}
        </div>
      ) : (
        <div role="alertdialog" className="flex flex-wrap items-center gap-2">
          <p className="flex-1 min-w-[180px] text-[0.6875rem] font-semibold text-accent-900 leading-snug">
            {isClear
              ? clearText ??
                tr(
                  lang,
                  '정말 지울까요? 이 섹션의 내용이 모두 비워져요. 되돌릴 수 없어요.',
                  'Clear everything? This section will be emptied. This cannot be undone.',
                  '确定要清除吗？本部分内容将全部清空，无法撤销。'
                )
              : confirmText ??
                tr(
                  lang,
                  '정말 되돌릴까요? 이 섹션의 설정만 기본값으로 바뀌어요.',
                  'Restore defaults? Only this section’s settings will change.',
                  '确定要恢复吗？只有本部分的设置会恢复为默认值。'
                )}
          </p>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="h-8 px-3 rounded-full border border-divider text-ink text-[0.6875rem] font-semibold hover:bg-slate-100"
            >
              {tr(lang, '취소', 'Cancel', '取消')}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(null);
                if (isClear) onClear?.();
                else onConfirm();
              }}
              className="h-8 px-3 rounded-full bg-accent-800 text-paper text-[0.6875rem] font-bold inline-flex items-center gap-1 hover:bg-accent-900"
            >
              {isClear ? <Eraser className="w-3.5 h-3.5" strokeWidth={2.5} /> : <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} />}
              {isClear ? tr(lang, '지우기', 'Clear', '清除') : confirmLabel ?? tr(lang, '되돌리기', 'Restore', '恢复')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick grade chips (초1…고3). The chip fills only the grade part; the user can keep typing 반.
type SchoolLevel = 'e' | 'm' | 'h';
interface GradeChip {
  key: string;
  level: SchoolLevel;
  n: number;
}
const GRADE_CHIPS: GradeChip[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ key: `e${n}`, level: 'e' as SchoolLevel, n })),
  ...[1, 2, 3].map((n) => ({ key: `m${n}`, level: 'm' as SchoolLevel, n })),
  ...[1, 2, 3].map((n) => ({ key: `h${n}`, level: 'h' as SchoolLevel, n })),
];
const ZH_NUM = ['', '一', '二', '三', '四', '五', '六'];
function gradeChipLabel(c: GradeChip, lang: AppLanguage): string {
  const ko = `${{ e: '초', m: '중', h: '고' }[c.level]}${c.n}`;
  const en = `${{ e: 'E', m: 'M', h: 'H' }[c.level]}${c.n}`;
  const zh = `${{ e: '小', m: '初', h: '高' }[c.level]}${ZH_NUM[c.n]}`;
  return tr(lang, ko, en, zh);
}
function gradeChipFill(c: GradeChip, lang: AppLanguage): string {
  const usGrade = c.level === 'e' ? c.n : c.level === 'm' ? c.n + 6 : c.n + 9;
  const zhLevel = { e: '小学', m: '初', h: '高' }[c.level];
  return tr(lang, `${c.n}학년`, `Grade ${usGrade}`, c.level === 'e' ? `${zhLevel}${ZH_NUM[c.n]}年级` : `${zhLevel}${ZH_NUM[c.n]}`);
}
/** Every possible chip fill text (all languages), longest first — used to swap the grade part but keep 반. */
const ALL_GRADE_FILLS: string[] = Array.from(
  new Set(GRADE_CHIPS.flatMap((c) => (['ko', 'en', 'zh'] as AppLanguage[]).map((l) => gradeChipFill(c, l))))
).sort((a, b) => b.length - a.length);

function profileInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[A-Za-z]/.test(words[0])) {
    return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
  }
  return (Array.from(name.trim())[0] ?? '').toUpperCase();
}

const GroupHeader: React.FC<{ label: string }> = ({ label }) => (
  <h3 className="px-1.5 pt-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</h3>
);

/** "2026-10-15 08:00" → "10/15 08:00" (falls back to the raw string). */
function formatBackupShort(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}:\d{2})/.exec(raw || '');
  if (!m) return raw;
  return `${Number(m[2])}/${Number(m[3])} ${m[4]}`;
}

function createSampleTimetableImageBase64(lang: AppLanguage): string {
  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 460;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(
    tr(
      lang,
      '2학년 3반 주간 시간표 및 방과후 학원 안내',
      'Grade 2 Class 3 Weekly Timetable & After-school Academies',
      '二年级3班 每周课表及课后补习班安排'
    ),
    24,
    42
  );

  const periodLabel = (n: number) => tr(lang, `${n}교시`, `P${n}`, `第${n}节`);
  const cols = [
    tr(lang, '교시', 'Period', '节次'),
    ...(['월', '화', '수', '목', '금'] as DayOfWeek[]).map((d) => translateDay(d, lang)),
  ];
  const rawRows: Array<[string, string[]]> = [
    ['09:00~09:45', ['국어', '수학', '영어', '과학', '수학']],
    ['09:55~10:40', ['수학', '영어', '국어', '한국사', '과학']],
    ['10:50~11:35', ['영어', '과학', '수학', '국어', '체육']],
    ['11:45~12:30', ['사회', '체육', '정보', '영어', '국어']],
    ['13:25~14:10', ['과학', '음악', '미술', '수학', '동아리']],
  ];
  const rows = rawRows.map(([time, subjects], i) => [
    `${periodLabel(i + 1)} (${time})`,
    ...subjects.map((sub) => translateSubject(sub, lang)),
  ]);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;

  const startX = 24;
  const startY = 65;
  const rowH = 38;
  const colWidths = [160, 92, 92, 92, 92, 92];

  let curX = startX;
  cols.forEach((col, cIdx) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(curX, startY, colWidths[cIdx], rowH);
    ctx.strokeRect(curX, startY, colWidths[cIdx], rowH);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(col, curX + 14, startY + 24);
    curX += colWidths[cIdx];
  });

  rows.forEach((r, rIdx) => {
    let x = startX;
    const y = startY + (rIdx + 1) * rowH;
    r.forEach((cellText, cIdx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, colWidths[cIdx], rowH);
      ctx.strokeRect(x, y, colWidths[cIdx], rowH);
      ctx.fillStyle = '#334155';
      ctx.font = cIdx === 0 ? '12px monospace' : lang === 'en' ? 'bold 11px sans-serif' : 'bold 14px sans-serif';
      ctx.fillText(cellText, x + 12, y + 24);
      x += colWidths[cIdx];
    });
  });

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(24, 310, 620, 125);
  ctx.strokeRect(24, 310, 620, 125);

  ctx.fillStyle = '#4f46e5';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    tr(lang, '[방과후 저녁 학원 시간표]', '[After-school Academy Schedule]', '【课后补习班时间表】'),
    40,
    338
  );

  ctx.fillStyle = '#1e293b';
  ctx.font = '14px sans-serif';
  const ts = (sub: string) => translateSubject(sub, lang);
  const dayFull = (d: DayOfWeek) => tr(lang, `${d}요일`, translateDay(d, lang), translateDay(d, lang));
  ctx.fillText(
    `• ${dayFull('월')} 17:00 ~ 19:00 : ${ts('수학학원')}   /   19:30 ~ 21:30 : ${ts('영어학원')}`,
    40,
    368
  );
  ctx.fillText(
    `• ${dayFull('수')} 17:00 ~ 19:00 : ${ts('수학학원')}   /   19:30 ~ 21:00 : ${ts('과학학원')}`,
    40,
    394
  );
  ctx.fillText(`• ${dayFull('토')} 10:00 ~ 12:30 : ${ts('논술학원')}`, 40, 420);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  state,
  onUpdateState,
  focusSection,
  onFocusHandled,
  onOpenChildren,
  onReplayOnboarding,
}) => {
  const lang: AppLanguage = state.language || 'ko';

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  // 업데이트 이력: which version is unfolded (null = the latest)
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  // Accordion open state (all collapsed by default; remembered per device)
  const [openCards, setOpenCards] = useState<Partial<Record<SettingsCardId, boolean>>>(loadOpenCards);
  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_CARDS_STORAGE_KEY, JSON.stringify(openCards));
    } catch {
      /* storage unavailable — keep in memory only */
    }
  }, [openCards]);
  const toggleCard = (id: SettingsCardId) => setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));
  const anyCardOpen = SETTINGS_CARD_IDS.some((id) => openCards[id]);
  const collapseAllCards = () => setOpenCards({});
  const openCardAndScroll = (id: SettingsCardId) => {
    setOpenCards((prev) => ({ ...prev, [id]: true }));
    window.setTimeout(() => {
      document.getElementById(`settings-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  // --- SECTION 0: MY PROFILE (shown on the timetable's "지금" card) ---
  const profile: UserProfile = {
    name: state.profile?.name ?? '',
    school: state.profile?.school ?? '',
    grade: state.profile?.grade ?? '',
  };
  const profileNameRef = useRef<HTMLInputElement | null>(null);
  const profileGradeRef = useRef<HTMLInputElement | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [lastGradeChip, setLastGradeChip] = useState<string | null>(null);
  const profileSavedTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (profileSavedTimer.current) window.clearTimeout(profileSavedTimer.current);
    },
    []
  );
  const flashProfileSaved = () => {
    setProfileSaved(true);
    if (profileSavedTimer.current) window.clearTimeout(profileSavedTimer.current);
    profileSavedTimer.current = window.setTimeout(() => setProfileSaved(false), 1600);
  };
  const updateProfile = (patch: Partial<UserProfile>) => {
    onUpdateState((prev) => ({
      ...prev,
      profile: {
        name: prev.profile?.name ?? '',
        school: prev.profile?.school ?? '',
        grade: prev.profile?.grade ?? '',
        ...patch,
      },
    }));
    flashProfileSaved();
  };
  const applyGradeChip = (chip: GradeChip) => {
    const fill = gradeChipFill(chip, lang);
    let rest = profile.grade.trim();
    const prefix = ALL_GRADE_FILLS.find((f) => rest.startsWith(f));
    if (prefix) rest = rest.slice(prefix.length).trim();
    updateProfile({ grade: rest ? `${fill} ${rest}` : fill });
    setLastGradeChip(chip.key);
    window.setTimeout(() => {
      const el = profileGradeRef.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    }, 0);
  };
  const handleClearProfile = () => {
    onUpdateState((prev) => ({ ...prev, profile: undefined }));
    setLastGradeChip(null);
  };

  // App asks us to open "내 정보" (e.g. tapped from the timetable's 지금 card)
  const onFocusHandledRef = useRef(onFocusHandled);
  useEffect(() => {
    onFocusHandledRef.current = onFocusHandled;
  }, [onFocusHandled]);
  useEffect(() => {
    if (!focusSection) return;
    const card = SETTINGS_CARD_IDS.find((id) => id === focusSection);
    if (card) setOpenCards((prev) => ({ ...prev, [card]: true }));
    const timer = window.setTimeout(() => {
      if (card) {
        document.getElementById(`settings-card-${card}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        document.querySelector('main')?.scrollTo({ top: 0 });
      }
      if (card === 'profile') profileNameRef.current?.focus({ preventScroll: true });
      onFocusHandledRef.current?.();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusSection]);

  // In-page confirmations (no window.confirm)
  const [removePeriodConfirm, setRemovePeriodConfirm] = useState(false);

  // --- SECTION 1: SUBJECT POOL STATE ---
  const [newSchoolSubject, setNewSchoolSubject] = useState('');
  const [newAcademySubject, setNewAcademySubject] = useState('');

  // --- SECTION 2: MASTER TIMETABLE & TIMELINE RANGE STATE ---
  const [selectedMasterDay, setSelectedMasterDay] = useState<DayOfWeek>('월');
  const [copySourceDay, setCopySourceDay] = useState<DayOfWeek>('월');
  const [copyTargetDay, setCopyTargetDay] = useState<DayOfWeek>('화');
  const [masterFeedback, setMasterFeedback] = useState<string | null>(null);
  // 과목 후보군: which subject's colour palette is open
  const [colorPickFor, setColorPickFor] = useState<string | null>(null);
  const setSubjectColor = (subject: string, key: SubjectColorKey | null) => {
    onUpdateState((prev) => {
      const next = { ...(prev.subjectColors || {}) };
      if (key) next[subject] = key;
      else delete next[subject];
      return { ...prev, subjectColors: next };
    });
    setColorPickFor(null);
  };

  // --- 앱 초기화 (top card): pick what to clear ---
  const [isResetSheetOpen, setIsResetSheetOpen] = useState(false);
  const [resetParts, setResetParts] = useState<ResetPart[]>([]);
  const [resetMode, setResetMode] = useState<ResetMode>('empty');
  const [resetConfirming, setResetConfirming] = useState(false);
  // null = auto (show 토/일 columns only when a weekend day has school periods)
  const [showWeekendPref, setShowWeekendPref] = useState<boolean | null>(null);
  const [schoolSheet, setSchoolSheet] = useState<
    { kind: 'cell'; day: DayOfWeek; period: number } | { kind: 'row'; period: number } | null
  >(null);
  const [customSubjectDraft, setCustomSubjectDraft] = useState('');

  // --- SECTION 3: AI TIMETABLE IMAGE RECOGNITION STATE ---
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiPreviewEntries, setAiPreviewEntries] = useState<AIExtractedEntry[]>([]);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [aiMergeSuccess, setAiMergeSuccess] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // --- SECTION 4: BACKUP & RESTORE STATE ---
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);
  const [importDraft, setImportDraft] = useState<{ fileName: string; parsed: ParsedBackup } | null>(null);

  // --- SECTION 5: HOME SCREEN WIDGETS (gallery) ---
  const [isWidgetSheetOpen, setIsWidgetSheetOpen] = useState(false);
  const [reminderDenied, setReminderDenied] = useState(false);
  const reminders = state.reminders ?? { enabled: false, leadMinutes: 60 as ReminderLead };
  const setReminders = (patch: Partial<ReminderConfig>) =>
    onUpdateState((prev) => ({ ...prev, reminders: { ...(prev.reminders ?? { enabled: false, leadMinutes: 60 }), ...patch } }));
  const toggleReminders = async () => {
    if (reminders.enabled) {
      setReminders({ enabled: false });
      return;
    }
    const ok = await requestReminderPermission();
    setReminderDenied(!ok);
    if (ok) setReminders({ enabled: true });
  };
  // Native app: how many of each widget are on the home screen, and the last "홈 화면에 추가" result
  const [placedWidgets, setPlacedWidgets] = useState<Partial<Record<HomeWidgetId, number>>>({});
  const [pinMessage, setPinMessage] = useState<{ id: HomeWidgetId; text: string } | null>(null);
  const refreshPlacedWidgets = () => {
    void getPlacedHomeWidgets().then(setPlacedWidgets);
  };
  useEffect(() => {
    if (!isNativeApp) return;
    refreshPlacedWidgets();
    // The launcher's "add widget" prompt pauses the app; recount when it comes back.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshPlacedWidgets();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  const placedTotal = Object.values(placedWidgets).reduce((a, n) => a + (n ?? 0), 0);
  const handlePinWidget = async (id: HomeWidgetId) => {
    syncWidgetData(state);
    const requested = await pinHomeWidget(id);
    setPinMessage({
      id,
      text: requested
        ? tr(
            lang,
            '홈 화면에 추가할지 묻는 창이 뜨면 「추가」를 눌러 주세요.',
            'When your phone asks, tap "Add" to place the widget.',
            '手机询问时，请点击「添加」。'
          )
        : tr(
            lang,
            `홈 화면 빈 곳을 길게 누른 뒤 「위젯」에서 「틈틈」을 찾아 「${HOME_WIDGET_META[id].name(lang)}」을 추가해 주세요.`,
            `Long-press an empty spot on your home screen, open "Widgets", find "TeumTeum" and add "${HOME_WIDGET_META[id].name(lang)}".`,
            `长按主屏幕空白处，打开「小组件」，找到「TeumTeum」并添加「${HOME_WIDGET_META[id].name(lang)}」。`
          ),
    });
  };

  // 위젯 선택 시트: Esc로 닫기 + 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (!isWidgetSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsWidgetSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isWidgetSheetOpen]);
  const [widgetNow, setWidgetNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setWidgetNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const widgetConfig = getWidgetConfig(state);
  const widgetTheme = widgetConfig.theme;
  const widgetFontScale: WidgetFontScale = widgetConfig.fontScale ?? 'md';
  const widgetPreviewData = buildHomeWidgetsData(state, widgetNow);
  const updateWidgetConfig = (patch: Partial<WidgetConfig>) => {
    onUpdateState((prev) => {
      const base = getWidgetConfig(prev);
      const next: WidgetConfig = { ...base, ...patch };
      const enabledSet = new Set(next.enabled);
      return {
        ...prev,
        widgetConfig: { ...next, enabled: HOME_WIDGET_IDS.filter((id) => enabledSet.has(id)) },
      };
    });
  };

  // --- SCHOOL CLASS-TIME CONFIG (preset vs custom) ---
  const schoolTimeConfig: SchoolTimeConfig = {
    ...DEFAULT_SCHOOL_TIME_CONFIG,
    ...(state.schoolTimeConfig || {}),
  };
  const isPresetMode = schoolTimeConfig.mode === 'preset';
  const presetPreviewRows = buildPresetPeriods(schoolTimeConfig);

  const timelineStartHour = state.timelineConfig?.startHour ?? 8;
  const timelineEndHour = state.timelineConfig?.endHour ?? 24;


  const textScale: TextScale = TEXT_SCALES.includes(state.textScale ?? 100) ? state.textScale ?? 100 : 100;
  const handleSetTextScale = (next: TextScale) => {
    onUpdateState((prev) => ({ ...prev, textScale: next }));
  };

  const handleSetLanguage = (nextLang: AppLanguage) => {
    onUpdateState((prev) => ({
      ...prev,
      language: nextLang,
    }));
  };

  // ================= SECTION 1 HANDLERS =================
  const handleAddSchoolSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSchoolSubject.trim();
    if (!trimmed) return;
    onUpdateState((prev) => {
      if (prev.subjectPool.school.includes(trimmed)) return prev;
      return {
        ...prev,
        subjectPool: {
          ...prev.subjectPool,
          school: [...prev.subjectPool.school, trimmed],
        },
      };
    });
    setNewSchoolSubject('');
  };

  const handleRemoveSchoolSubject = (subj: string) => {
    onUpdateState((prev) => ({
      ...prev,
      subjectPool: {
        ...prev.subjectPool,
        school: prev.subjectPool.school.filter((s) => s !== subj),
      },
    }));
  };

  const handleAddAcademySubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAcademySubject.trim();
    if (!trimmed) return;
    onUpdateState((prev) => {
      if (prev.subjectPool.academy.includes(trimmed)) return prev;
      return {
        ...prev,
        subjectPool: {
          ...prev.subjectPool,
          academy: [...prev.subjectPool.academy, trimmed],
        },
      };
    });
    setNewAcademySubject('');
  };

  const handleRemoveAcademySubject = (acName: string) => {
    onUpdateState((prev) => ({
      ...prev,
      subjectPool: {
        ...prev.subjectPool,
        academy: prev.subjectPool.academy.filter((a) => a !== acName),
      },
    }));
  };

  // ================= SECTION 2 HANDLERS =================
  const showMasterToast = (msg: string) => {
    setMasterFeedback(msg);
    setTimeout(() => setMasterFeedback(null), 2800);
  };

  // ================= SECTION RESETS (only the section's own settings; overrides/attendance/memos/schedules untouched) =================
  const sectionResetLabel = tr(lang, '이 섹션 기본값으로 되돌리기', 'Restore this section’s defaults', '将本部分恢复默认');

  const handleResetTimelineRange = () => {
    onUpdateState((prev) => ({ ...prev, timelineConfig: { startHour: 8, endHour: 24 } }));
    showMasterToast(
      tr(lang, '시간표 표시 범위를 기본값으로 되돌렸어요', 'Timeline range restored to defaults', '时间轴显示范围已恢复默认')
    );
  };

  const handleResetSchoolSection = () => {
    const sample = createInitialPlannerState().masterTimetable;
    onUpdateState((prev) => {
      const nextMaster = { ...prev.masterTimetable } as MasterTimetable;
      DAYS_OF_WEEK.forEach((d) => {
        nextMaster[d] = {
          ...(prev.masterTimetable[d] || { school: [], academy: [] }),
          school: (sample[d]?.school || []).map((p) => ({ ...p })),
        };
      });
      return { ...prev, schoolTimeConfig: { ...DEFAULT_SCHOOL_TIME_CONFIG }, masterTimetable: nextMaster };
    });
    setSchoolSheet(null);
    setRemovePeriodConfirm(false);
    showMasterToast(
      tr(lang, '학교 시간표를 기본값으로 되돌렸어요', 'School timetable restored to defaults', '学校课表已恢复默认')
    );
  };

  const handleResetAcademySection = () => {
    const sample = createInitialPlannerState().masterTimetable;
    onUpdateState((prev) => {
      const nextMaster = { ...prev.masterTimetable } as MasterTimetable;
      DAYS_OF_WEEK.forEach((d) => {
        nextMaster[d] = {
          ...(prev.masterTimetable[d] || { school: [], academy: [] }),
          academy: (sample[d]?.academy || []).map((a) => ({ ...a })),
        };
      });
      return { ...prev, masterTimetable: nextMaster };
    });
    showMasterToast(
      tr(lang, '학원 시간표를 기본값으로 되돌렸어요', 'Academy timetable restored to defaults', '补习班课表已恢复默认')
    );
  };

  const handleResetSubjectPool = () => {
    const sample = createInitialPlannerState().subjectPool;
    onUpdateState((prev) => ({
      ...prev,
      subjectPool: { school: [...sample.school], academy: [...sample.academy] },
    }));
    setNewSchoolSubject('');
    setNewAcademySubject('');
    showMasterToast(
      tr(lang, '과목/수업 설정을 기본값으로 되돌렸어요', 'Subjects restored to defaults', '科目/课程设置已恢复默认')
    );
  };

  // 모든 설정값 지우기: empty the section (school keeps its class times so the grid stays in place)
  const handleClearSchoolSection = () => {
    onUpdateState((prev) => resetPlannerParts(prev, ['school'], 'empty'));
    setSchoolSheet(null);
    setRemovePeriodConfirm(false);
    showMasterToast(tr(lang, '학교 시간표의 과목을 모두 지웠어요', 'All school subjects cleared', '已清除全部学校科目'));
  };

  const handleClearAcademySection = () => {
    onUpdateState((prev) => resetPlannerParts(prev, ['academy'], 'empty'));
    showMasterToast(tr(lang, '학원 시간표를 모두 지웠어요', 'Academy timetable cleared', '已清除补习班课表'));
  };

  const handleClearSubjectPool = () => {
    onUpdateState((prev) => ({ ...prev, subjectPool: { school: [], academy: [] }, subjectColors: undefined }));
    setNewSchoolSubject('');
    setNewAcademySubject('');
    setColorPickFor(null);
    showMasterToast(tr(lang, '과목/수업 목록을 모두 지웠어요', 'All subjects cleared', '已清除全部科目'));
  };

  // 시간표 화면 구성: reorder within a group, show/hide
  const timetableLayout = state.timetableLayout ?? DEFAULT_TIMETABLE_LAYOUT;
  const sortedGroup = (group: TimetableBlockGroup) =>
    [...TIMETABLE_BLOCK_GROUPS[group]].sort(
      (a, b) => timetableBlockRank(timetableLayout, a) - timetableBlockRank(timetableLayout, b)
    );
  const moveTimetableBlock = (group: TimetableBlockGroup, id: TimetableBlockId, dir: -1 | 1) =>
    onUpdateState((prev) => {
      const cur = prev.timetableLayout ?? DEFAULT_TIMETABLE_LAYOUT;
      const order = [...cur.order, ...DEFAULT_TIMETABLE_LAYOUT.order.filter((b) => !cur.order.includes(b))];
      const items = [...TIMETABLE_BLOCK_GROUPS[group]].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const i = items.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= items.length) return prev;
      const ia = order.indexOf(items[i]);
      const ib = order.indexOf(items[j]);
      [order[ia], order[ib]] = [order[ib], order[ia]];
      return { ...prev, timetableLayout: { ...cur, order } };
    });
  const toggleTimetableBlock = (id: TimetableBlockId) =>
    onUpdateState((prev) => {
      const cur = prev.timetableLayout ?? DEFAULT_TIMETABLE_LAYOUT;
      const hidden = cur.hidden.includes(id) ? cur.hidden.filter((b) => b !== id) : [...cur.hidden, id];
      return { ...prev, timetableLayout: { ...cur, hidden } };
    });
  const handleResetTimetableLayout = () => {
    onUpdateState((prev) => ({ ...prev, timetableLayout: undefined }));
    showMasterToast(tr(lang, '시간표 화면 구성을 기본값으로 되돌렸어요', 'Timetable layout restored to defaults', '课表画面布局已恢复默认'));
  };

  const handleResetWidgets = () => {
    onUpdateState((prev) => ({
      ...prev,
      widgetConfig: { ...DEFAULT_WIDGET_CONFIG, enabled: [...DEFAULT_WIDGET_CONFIG.enabled] },
    }));
    showMasterToast(
      tr(lang, '홈 화면 위젯을 기본값으로 되돌렸어요', 'Home screen widgets restored to defaults', '主屏幕小组件已恢复默认')
    );
  };

  const handleUpdateTimelineRange = (newStart: number, newEnd: number) => {
    const validStart = Math.max(0, Math.min(22, newStart));
    const validEnd = Math.max(validStart + 2, Math.min(24, newEnd));
    onUpdateState((prev) => ({
      ...prev,
      timelineConfig: {
        startHour: validStart,
        endHour: validEnd,
      },
    }));
    const startStr = `${String(validStart).padStart(2, '0')}:00`;
    const endStr = `${String(validEnd).padStart(2, '0')}:00`;
    showMasterToast(
      tr(
        lang,
        `일별 시간표 표시 범위가 ${startStr} ~ ${endStr} (${validEnd - validStart}시간)으로 설정되었습니다.`,
        `Daily timeline range set to ${startStr} ~ ${endStr} (${validEnd - validStart} hrs).`,
        `每日时间轴显示范围已设置为 ${startStr} ~ ${endStr}（共 ${validEnd - validStart} 小时）。`
      )
    );
  };

  const updateSchoolTimeConfig = (patch: Partial<SchoolTimeConfig>) => {
    onUpdateState((prev) => {
      const base: SchoolTimeConfig = {
        ...DEFAULT_SCHOOL_TIME_CONFIG,
        ...(prev.schoolTimeConfig || {}),
        ...patch,
      };
      const periodCount = Math.max(1, Math.min(12, Math.round(base.periodCount) || 1));
      const next: SchoolTimeConfig = {
        ...base,
        classMinutes: Math.max(5, Math.min(180, Math.round(base.classMinutes) || 5)),
        breakMinutes: Math.max(0, Math.min(120, Math.round(base.breakMinutes) || 0)),
        lunchMinutes: Math.max(0, Math.min(180, Math.round(base.lunchMinutes) || 0)),
        periodCount,
        lunchAfterPeriod: Math.max(0, Math.min(periodCount, Math.round(base.lunchAfterPeriod) || 0)),
        firstStart: /^\d{2}:\d{2}$/.test(base.firstStart) ? base.firstStart : '09:00',
      };
      return { ...prev, schoolTimeConfig: next };
    });
  };

  const handleApplySchoolTimePresetToAllDays = () => {
    const config = schoolTimeConfig;
    const rows = buildPresetPeriods(config);
    let appliedDays = 0;
    DAYS_OF_WEEK.forEach((day) => {
      if (state.masterTimetable[day]?.school.length) appliedDays += 1;
    });
    onUpdateState((prev) => {
      const nextMaster = { ...prev.masterTimetable };
      const fillSubject = prev.subjectPool.school.includes('자습')
        ? '자습'
        : prev.subjectPool.school[0] || '자습';
      DAYS_OF_WEEK.forEach((day) => {
        const dayData = nextMaster[day];
        if (!dayData || dayData.school.length === 0) return;
        const existing = dayData.school;
        nextMaster[day] = {
          ...dayData,
          school: rows.map((row) => {
            const match = existing.find((p) => p.period === row.period);
            return {
              ...(match || {}),
              period: row.period,
              startTime: row.startTime,
              endTime: row.endTime,
              subject: match?.subject ?? fillSubject,
            };
          }),
        };
      });
      return { ...prev, masterTimetable: nextMaster };
    });
    showMasterToast(
      tr(
        lang,
        `${appliedDays}개 요일의 학교 시간표에 ${config.periodCount}교시 (${config.firstStart} 시작, 수업 ${config.classMinutes}분)가 적용되었습니다.`,
        `Applied ${config.periodCount} periods (from ${config.firstStart}, ${config.classMinutes}-min classes) to ${appliedDays} day(s).`,
        `已将 ${config.periodCount} 节课（${config.firstStart} 开始，每节 ${config.classMinutes} 分钟）应用到 ${appliedDays} 个星期。`
      )
    );
  };

  const handleCopyDayTimetable = () => {
    if (copySourceDay === copyTargetDay) {
      showMasterToast(
        tr(
          lang,
          '복사할 원본 요일과 대상 요일을 다르게 선택해 주세요.',
          'Please select different source and target days.',
          '请选择不同的源星期和目标星期。'
        )
      );
      return;
    }
    onUpdateState((prev) => {
      const sourceData = prev.masterTimetable[copySourceDay];
      const clonedSchool: SchoolPeriod[] = sourceData.school.map((s) => ({ ...s }));
      const clonedAcademy: AcademyItem[] = sourceData.academy.map((a, idx) => ({
        ...a,
        id: `ac-${copyTargetDay}-${Date.now()}-${idx}`,
      }));

      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [copyTargetDay]: {
            school: clonedSchool,
            academy: clonedAcademy,
          },
        },
      };
    });
    showMasterToast(
      tr(
        lang,
        `${copySourceDay}요일 기본 시간표를 ${copyTargetDay}요일로 복사했습니다.`,
        `Copied ${translateDay(copySourceDay, lang)} schedule to ${translateDay(copyTargetDay, lang)}.`,
        `已将${translateDay(copySourceDay, lang)}固定课表复制到${translateDay(copyTargetDay, lang)}。`
      )
    );
  };

  // ================= SCHOOL MASTER GRID (table editor) HANDLERS =================
  const getCfg = (prev: PlannerState): SchoolTimeConfig => ({
    ...DEFAULT_SCHOOL_TIME_CONFIG,
    ...(prev.schoolTimeConfig || {}),
  });

  const updateDaySchool = (
    day: DayOfWeek,
    fn: (school: SchoolPeriod[], prev: PlannerState) => SchoolPeriod[]
  ) => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[day] || { school: [], academy: [] };
      const nextSchool = fn(dayData.school, prev)
        .slice()
        .sort((a, b) => a.period - b.period);
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [day]: { ...dayData, school: nextSchool },
        },
      };
    });
  };

  const handleSetSchoolCell = (day: DayOfWeek, period: number, subject: string) => {
    const clean = subject.trim();
    if (!clean) return;
    updateDaySchool(day, (school, prev) => {
      const idx = school.findIndex((p) => p.period === period);
      if (idx >= 0) return school.map((p, i) => (i === idx ? { ...p, subject: clean } : p));
      return [
        ...school,
        { period, ...resolveRowTimes(prev.masterTimetable, getCfg(prev), period), subject: clean },
      ];
    });
  };

  const handleClearSchoolCell = (day: DayOfWeek, period: number) => {
    updateDaySchool(day, (school) => school.filter((p) => p.period !== period));
  };

  const handleUpdateDayPeriodTime = (
    day: DayOfWeek,
    period: number,
    patch: Partial<Pick<SchoolPeriod, 'startTime' | 'endTime'>>
  ) => {
    updateDaySchool(day, (school) =>
      school.map((p) => (p.period === period ? { ...p, ...patch } : p))
    );
  };

  const handleUpdateRowTimeAllDays = (
    period: number,
    patch: Partial<Pick<SchoolPeriod, 'startTime' | 'endTime'>>
  ) => {
    onUpdateState((prev) => {
      const next = { ...prev.masterTimetable };
      DAYS_OF_WEEK.forEach((d) => {
        const dd = next[d];
        if (!dd || !dd.school.some((p) => p.period === period)) return;
        next[d] = {
          ...dd,
          school: dd.school.map((p) => (p.period === period ? { ...p, ...patch } : p)),
        };
      });
      return { ...prev, masterTimetable: next };
    });
  };

  const handleAddSchoolRow = () => {
    onUpdateState((prev) => {
      const cfg = getCfg(prev);
      const n = getMaxPeriod(prev.masterTimetable) + 1;
      const times = resolveRowTimes(prev.masterTimetable, cfg, n);
      let targets = DAYS_OF_WEEK.filter((d) => (prev.masterTimetable[d]?.school.length ?? 0) > 0);
      if (targets.length === 0) targets = WEEKDAYS;
      const subject = prev.subjectPool.school.includes('자습')
        ? '자습'
        : prev.subjectPool.school[0] || '자습';
      const next = { ...prev.masterTimetable };
      targets.forEach((d) => {
        const dd = next[d] || { school: [], academy: [] };
        next[d] = {
          ...dd,
          school: [...dd.school, { period: n, ...times, subject }].sort((a, b) => a.period - b.period),
        };
      });
      return { ...prev, masterTimetable: next };
    });
  };

  const handleRemoveLastSchoolRow = () => {
    const maxP = getMaxPeriod(state.masterTimetable);
    setRemovePeriodConfirm(false);
    if (maxP === 0) return;
    onUpdateState((prev) => {
      const next = { ...prev.masterTimetable };
      DAYS_OF_WEEK.forEach((d) => {
        const dd = next[d];
        if (!dd) return;
        next[d] = { ...dd, school: dd.school.filter((p) => p.period !== maxP) };
      });
      return { ...prev, masterTimetable: next };
    });
  };

  const handleAddMasterAcademyItem = () => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[selectedMasterDay];
      const newItem: AcademyItem = {
        id: `ac-${selectedMasterDay}-${Date.now()}`,
        startTime: '17:00',
        endTime: '19:00',
        subject: prev.subjectPool.academy[0] || '수학학원',
      };
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [selectedMasterDay]: {
            ...dayData,
            academy: [...dayData.academy, newItem],
          },
        },
      };
    });
  };

  const handleUpdateMasterAcademyItem = (id: string, patch: Partial<AcademyItem>) => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[selectedMasterDay];
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [selectedMasterDay]: {
            ...dayData,
            academy: dayData.academy.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          },
        },
      };
    });
  };

  const handleDeleteMasterAcademyItem = (id: string) => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[selectedMasterDay];
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [selectedMasterDay]: {
            ...dayData,
            academy: dayData.academy.filter((a) => a.id !== id),
          },
        },
      };
    });
  };

  // ================= SECTION 3: AI TIMETABLE IMAGE RECOGNITION HANDLERS =================
  const runAiTimetableAnalysis = async (base64Data: string, mimeType: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAiError(
        tr(
          lang,
          '현재 오프라인 상태입니다. [AI 시간표 이미지 인식] 기능은 인터넷 연결이 필요합니다.',
          'You are currently offline. [AI Timetable Image Recognition] requires an active internet connection.',
          '当前处于离线状态。【AI 课表图片识别】功能需要连接互联网后使用。'
        )
      );
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiMergeSuccess(null);

    try {
      const defaultPeriods =
        state.masterTimetable['월'].school.length > 0
          ? state.masterTimetable['월'].school
          : generatePeriodSchedule(45, []);

      const response = await fetch(`${API_BASE_URL}/api/parse-timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          defaultPeriods,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || tr(lang, 'AI 분석에 실패했습니다.', 'AI analysis failed.', 'AI 分析失败。')
        );
      }

      const rawEntries = Array.isArray(data.entries) ? data.entries : [];
      const mapped: AIExtractedEntry[] = rawEntries.map(
        (item: Partial<AIExtractedEntry>, idx: number) => {
          const validDay = DAYS_OF_WEEK.includes(item.day as DayOfWeek)
            ? (item.day as DayOfWeek)
            : '월';
          const isAcademy = item.type === 'academy';
          const periodNum = isAcademy ? 0 : Number(item.period) || 1;

          let startTime = item.startTime || '09:00';
          let endTime = item.endTime || '09:45';
          if (!isAcademy) {
            const matchedDefault = defaultPeriods.find((p) => p.period === periodNum);
            if (matchedDefault && (!item.startTime || !item.endTime)) {
              startTime = matchedDefault.startTime;
              endTime = matchedDefault.endTime;
            }
          }

          return {
            id: `ai-entry-${Date.now()}-${idx}`,
            day: validDay,
            type: isAcademy ? 'academy' : 'school',
            period: periodNum,
            startTime,
            endTime,
            subject: (item.subject || '자습').trim(),
          };
        }
      );

      setAiSummary(
        (lang === 'ko' && data.summary) ||
          tr(
            lang,
            `총 ${mapped.length}개의 수업/학원 항목이 인식되었습니다.`,
            `Extracted ${mapped.length} school/academy entries.`,
            `共识别出 ${mapped.length} 条学校/补习班课程记录。`
          )
      );
      setAiPreviewEntries(mapped);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : tr(
              lang,
              '시간표 이미지를 분석하는 도중 오류가 발생했습니다.',
              'An error occurred while analyzing the timetable image.',
              '分析课表图片时发生错误。'
            );
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      setUploadedPreviewUrl(resultStr);
      const base64Clean = resultStr.split(',')[1] || '';
      runAiTimetableAnalysis(base64Clean, file.type || 'image/png');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRunSampleImageDemo = () => {
    const base64Clean = createSampleTimetableImageBase64(lang);
    if (!base64Clean) return;
    setUploadedPreviewUrl(`data:image/png;base64,${base64Clean}`);
    runAiTimetableAnalysis(base64Clean, 'image/png');
  };

  const handleUpdatePreviewEntry = (id: string, patch: Partial<AIExtractedEntry>) => {
    setAiPreviewEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  };

  const handleDeletePreviewEntry = (id: string) => {
    setAiPreviewEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleMergeAiPreviewToMaster = () => {
    if (aiPreviewEntries.length === 0) return;

    onUpdateState((prev) => {
      const nextSchoolPool = new Set(prev.subjectPool.school);
      const nextAcademyPool = new Set(prev.subjectPool.academy);
      const nextMaster = { ...prev.masterTimetable };

      DAYS_OF_WEEK.forEach((d) => {
        nextMaster[d] = {
          school: [...nextMaster[d].school.map((s) => ({ ...s }))],
          academy: [...nextMaster[d].academy.map((a) => ({ ...a }))],
        };
      });

      aiPreviewEntries.forEach((entry) => {
        const cleanSubj = entry.subject.trim();
        if (!cleanSubj) return;

        if (entry.type === 'school') {
          nextSchoolPool.add(cleanSubj);
          const daySchool = nextMaster[entry.day].school;
          const existingIdx = daySchool.findIndex((p) => p.period === entry.period);
          const periodObj: SchoolPeriod = {
            period: entry.period || 1,
            startTime: entry.startTime,
            endTime: entry.endTime,
            subject: cleanSubj,
          };
          if (existingIdx >= 0) {
            daySchool[existingIdx] = periodObj;
          } else {
            daySchool.push(periodObj);
            daySchool.sort((a, b) => a.period - b.period);
          }
        } else {
          nextAcademyPool.add(cleanSubj);
          const dayAcademy = nextMaster[entry.day].academy;
          const dupIdx = dayAcademy.findIndex(
            (a) => a.startTime === entry.startTime && a.subject === cleanSubj
          );
          const acObj: AcademyItem = {
            id: `ac-ai-${entry.day}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            startTime: entry.startTime,
            endTime: entry.endTime,
            subject: cleanSubj,
          };
          if (dupIdx >= 0) {
            dayAcademy[dupIdx] = acObj;
          } else {
            dayAcademy.push(acObj);
          }
        }
      });

      return {
        ...prev,
        subjectPool: {
          school: Array.from(nextSchoolPool),
          academy: Array.from(nextAcademyPool),
        },
        masterTimetable: nextMaster,
      };
    });

    setAiMergeSuccess(
      tr(
        lang,
        `총 ${aiPreviewEntries.length}개 항목이 기본 시간표 및 과목 후보군에 성공적으로 병합되었습니다!`,
        `Successfully merged ${aiPreviewEntries.length} items into your master timetable and subject pool!`,
        `已成功将 ${aiPreviewEntries.length} 个项目合并到固定课表及候选科目库中！`
      )
    );
    setAiPreviewEntries([]);
  };

  // ================= SECTION 4: BACKUP & RESTORE HANDLERS =================
  const handleExportBackupJson = async () => {
    const now = new Date();
    const ymd = formatDateKey(now).replace(/-/g, '');
    const timestamp = `${formatDateKey(now)} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const exportState: PlannerState = {
      ...state,
      backupMeta: {
        lastBackupDate: timestamp,
      },
    };
    const fileName = `teumteum_backup_${ymd}.json`;

    try {
      const result = await exportBackupFile(
        fileName,
        JSON.stringify(exportState, null, 2),
        tr(lang, '백업 파일 보내기 · 저장하기', 'Send or save the backup', '发送或保存备份文件')
      );
      if (result === 'cancelled') return;
      onUpdateState((prev) => ({ ...prev, backupMeta: { lastBackupDate: timestamp } }));
      setBackupFeedback({
        type: 'success',
        message:
          result === 'shared'
            ? tr(
                lang,
                `${fileName} 파일을 보냈어요. 다시 보내거나 저장하려면 한 번 더 눌러 주세요.`,
                `Sent ${fileName}. Tap again to send or save it somewhere else.`,
                `已发送 ${fileName}。如需再次发送或保存，请再点一次。`
              )
            : tr(
                lang,
                `${fileName} 파일이 저장되었습니다.`,
                `Saved backup file: ${fileName}`,
                `备份文件 ${fileName} 已保存。`
              ),
      });
    } catch (err) {
      console.warn('Backup export failed:', err);
      setBackupFeedback({
        type: 'error',
        message: tr(lang, '백업 파일을 만들지 못했어요. 다시 시도해 주세요.', 'Could not create the backup file. Please try again.', '无法创建备份文件，请重试。'),
      });
    }
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBackup(String(reader.result ?? ''));
      if (!parsed) {
        setBackupFeedback({
          type: 'error',
          message: tr(
            lang,
            '틈틈 백업 파일이 아니에요. 「데이터 내보내기」로 만든 .json 파일을 골라 주세요.',
            'Not a TeumTeum backup. Pick a .json file made with “Export Backup”.',
            '这不是 TeumTeum 备份文件，请选择用「导出备份」生成的 .json 文件。'
          ),
        });
        return;
      }
      setBackupFeedback(null);
      setImportDraft({ fileName: file.name, parsed });
    };
    reader.onerror = () =>
      setBackupFeedback({
        type: 'error',
        message: tr(lang, '파일을 읽는 중 오류가 발생했습니다.', 'Failed to read file.', '读取文件时出错。'),
      });
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Derived data for the school table / academy card ---
  const academyDayData = state.masterTimetable[selectedMasterDay] || { school: [], academy: [] };
  const totalAcademyCount = DAYS_OF_WEEK.reduce(
    (sum, d) => sum + (state.masterTimetable[d]?.academy.length ?? 0),
    0
  );
  const hasWeekendSchool = (['토', '일'] as DayOfWeek[]).some(
    (d) => (state.masterTimetable[d]?.school.length ?? 0) > 0
  );
  const showWeekend = showWeekendPref ?? hasWeekendSchool;
  const gridDays: DayOfWeek[] = showWeekend ? DAYS_OF_WEEK : WEEKDAYS;
  const maxSchoolPeriod = getMaxPeriod(state.masterTimetable);
  const schoolRows = Array.from({ length: maxSchoolPeriod }, (_, i) => i + 1);
  const periodLabel = (n: number) => tr(lang, `${n}교시`, `P${n}`, `第${n}节`);
  const getRowInfo = (period: number) => {
    const entries: Array<{ day: DayOfWeek; p: SchoolPeriod }> = [];
    DAYS_OF_WEEK.forEach((d) => {
      const p = state.masterTimetable[d]?.school.find((x) => x.period === period);
      if (p) entries.push({ day: d, p });
    });
    const ref = entries[0]?.p;
    const times = ref
      ? { startTime: ref.startTime, endTime: ref.endTime }
      : resolveRowTimes(state.masterTimetable, schoolTimeConfig, period);
    const mismatch = entries.some(
      (e) => e.p.startTime !== times.startTime || e.p.endTime !== times.endTime
    );
    return { entries, times, mismatch };
  };
  const sheetCell =
    schoolSheet?.kind === 'cell'
      ? state.masterTimetable[schoolSheet.day]?.school.find((p) => p.period === schoolSheet.period)
      : undefined;
  const presetHasLunch =
    schoolTimeConfig.lunchAfterPeriod > 0 &&
    schoolTimeConfig.lunchAfterPeriod < schoolTimeConfig.periodCount &&
    schoolTimeConfig.lunchMinutes > 0;
  const presetEndTime =
    presetPreviewRows[presetPreviewRows.length - 1]?.endTime ?? schoolTimeConfig.firstStart;

  // --- One-line summaries shown on collapsed cards ---
  const schoolSummary = isPresetMode
    ? tr(
        lang,
        `프리셋 · ${schoolTimeConfig.periodCount}교시 · ${schoolTimeConfig.firstStart} 시작`,
        `Preset · ${schoolTimeConfig.periodCount} periods · from ${schoolTimeConfig.firstStart}`,
        `预设 · ${schoolTimeConfig.periodCount}节 · ${schoolTimeConfig.firstStart} 开始`
      )
    : tr(
        lang,
        `직접 입력 · ${maxSchoolPeriod}교시`,
        `Custom · ${maxSchoolPeriod} periods`,
        `自定义 · ${maxSchoolPeriod}节`
      );
  const academyDaysUsed = DAYS_OF_WEEK.filter((d) => (state.masterTimetable[d]?.academy.length ?? 0) > 0).length;
  const academySummary =
    totalAcademyCount > 0
      ? tr(
          lang,
          `주 ${totalAcademyCount}개 수업 · ${academyDaysUsed}개 요일`,
          `${totalAcademyCount} classes/week · ${academyDaysUsed} days`,
          `每周 ${totalAcademyCount} 节 · ${academyDaysUsed} 天`
        )
      : tr(lang, '등록된 학원 없음', 'No academy classes yet', '尚未登记补习班');
  const aiEnabled = isAiTimetableEnabled();
  const aiSummaryLine = aiLoading
    ? tr(lang, '이미지 분석 중…', 'Analyzing image…', '正在分析图片…')
    : aiPreviewEntries.length > 0
    ? tr(
        lang,
        `검수 대기 ${aiPreviewEntries.length}건`,
        `${aiPreviewEntries.length} items to review`,
        `待核对 ${aiPreviewEntries.length} 条`
      )
    : tr(lang, '사진 한 장으로 시간표 자동 입력', 'Fill your timetable from a photo', '一张照片自动录入课表');
  const lastBackup = state.backupMeta?.lastBackupDate;
  const backupSummary = lastBackup
    ? tr(
        lang,
        `마지막 백업 ${formatBackupShort(lastBackup)}`,
        `Last backup ${formatBackupShort(lastBackup)}`,
        `上次备份 ${formatBackupShort(lastBackup)}`
      )
    : tr(lang, '백업 기록 없음', 'Never backed up', '暂无备份记录');

  return (
    <div className="space-y-4">
      {/* ===== HERO: 설정 헤더 + 요약 통계 + 언어 전환 ===== */}
      <section data-tour="settings-top" className="bg-surface rounded-2xl shadow-xs p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-12 h-12 rounded-2xl bg-accent-700 text-paper grid place-items-center shrink-0">
              <Settings2 strokeWidth={2.5} className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[1.25rem] font-bold text-ink leading-tight">{tr(lang, '설정', 'Settings', '设置')}</h2>
              <p className="text-[0.75rem] text-slate-600 leading-snug">
                {tr(
                  lang,
                  '시간표 · 데이터 · 위젯을 한곳에서 관리해요',
                  'Manage timetables, data and widgets in one place',
                  '在这里统一管理课表、数据与小组件'
                )}
              </p>
            </div>
          </div>
          {anyCardOpen && (
            <button
              type="button"
              onClick={collapseAllCards}
              className="h-8 px-3 rounded-full border border-divider bg-paper text-[0.6875rem] font-semibold text-slate-700 inline-flex items-center gap-1 hover:bg-slate-100 shrink-0"
            >
              <ChevronsDownUp strokeWidth={2.5} className="w-3.5 h-3.5" />
              {tr(lang, '모두 접기', 'Collapse all', '全部收起')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                key: 'subjects',
                value: state.subjectPool.school.length,
                label: tr(lang, '학교 과목', 'Subjects', '学校科目'),
                tone: 'text-sage-700',
                card: 'pool' as SettingsCardId,
              },
              {
                key: 'academy',
                value: totalAcademyCount,
                label: tr(lang, '주간 학원', 'Academy/wk', '每周补习'),
                tone: 'text-accent-700',
                card: 'academy' as SettingsCardId,
              },
              {
                key: 'widgets',
                value: isNativeApp ? placedTotal : HOME_WIDGET_IDS.length,
                label: isNativeApp
                  ? tr(lang, '홈 화면 위젯', 'On home', '主屏幕小组件')
                  : tr(lang, '위젯 종류', 'Widgets', '小组件种类'),
                tone: 'text-other-700',
                card: 'widgets' as SettingsCardId,
              },
            ]
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => openCardAndScroll(s.card)}
              className="rounded-xl bg-paper px-3 py-2.5 text-left hover:bg-slate-100 transition-colors min-w-0"
            >
              <span className={`block font-mono text-[1.375rem] leading-none tabular-nums ${s.tone}`}>{s.value}</span>
              <span className="block mt-1 text-[0.6875rem] font-semibold text-slate-600 truncate">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Globe strokeWidth={2.5} className="w-3.5 h-3.5 text-accent-700" />
            <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '언어', 'Language', '语言')}</span>
          </div>
          <div
            role="radiogroup"
            aria-label={tr(lang, '앱 표시 언어', 'App language', '应用显示语言')}
            className="grid grid-cols-3 gap-1 p-1 rounded-full bg-paper border border-divider"
          >
            {(
              [
                { code: 'ko', label: '한국어', htmlLang: 'ko' },
                { code: 'en', label: 'English', htmlLang: 'en' },
                { code: 'zh', label: '中文', htmlLang: 'zh' },
              ] as Array<{ code: AppLanguage; label: string; htmlLang: string }>
            ).map((item) => {
              const isSelected = lang === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  lang={item.htmlLang}
                  onClick={() => handleSetLanguage(item.code)}
                  className={`h-9 rounded-full text-[0.8125rem] font-bold inline-flex items-center justify-center gap-1 transition-colors ${
                    isSelected ? 'bg-accent-700 text-paper shadow-xs' : 'text-ink hover:bg-slate-100'
                  }`}
                >
                  {isSelected && <Check strokeWidth={3} className="w-3.5 h-3.5" />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 글자 크기 — larger text for easier reading. Text is rem-based, so this scales it app-wide. */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Type strokeWidth={2.5} className="w-3.5 h-3.5 text-accent-700" />
            <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '글자 크기', 'Text size', '字体大小')}</span>
          </div>
          <div
            role="radiogroup"
            aria-label={tr(lang, '앱 글자 크기', 'App text size', '应用字体大小')}
            className="grid grid-cols-4 gap-1 p-1 rounded-[20px] bg-paper border border-divider"
          >
            {TEXT_SCALES.map((scale, i) => {
              const isSelected = textScale === scale;
              const label = [
                tr(lang, '기본', 'Default', '默认'),
                tr(lang, '크게', 'Large', '大'),
                tr(lang, '더 크게', 'Larger', '较大'),
                tr(lang, '최대', 'Max', '最大'),
              ][i];
              return (
                <button
                  key={scale}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSetTextScale(scale)}
                  className={`min-h-[52px] py-1.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    isSelected ? 'bg-accent-700 text-paper shadow-xs' : 'text-ink hover:bg-slate-100'
                  }`}
                >
                  {/* Fixed px sample so each option shows its own size, whatever is selected */}
                  <span aria-hidden="true" className="font-bold leading-none" style={{ fontSize: `${(16 * scale) / 100}px` }}>
                    {tr(lang, '가', 'A', '字')}
                  </span>
                  <span className="text-[0.6875rem] font-semibold leading-tight text-center whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[0.6875rem] text-slate-600 leading-snug">
            {tr(
              lang,
              `지금 글자 크기 ${textScale}% · 앱 전체 글자가 함께 커져요.`,
              `Text size ${textScale}% · applies to the whole app.`,
              `当前字体 ${textScale}% · 整个应用的文字都会一起变大。`
            )}
          </p>
        </div>

        {/* 자녀 선택: one planner per child */}
        {(() => {
          const kids = listChildren(state);
          const names = kids.map((c, i) => childName(c.data, i, childFallbackName(lang)));
          const active = Math.max(0, kids.findIndex((c) => c.isActive));
          return (
            <button
              type="button"
              onClick={onOpenChildren}
              className="w-full rounded-2xl bg-paper px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-100"
            >
              <span className="w-9 h-9 rounded-xl bg-accent-700 text-paper grid place-items-center shrink-0">
                <Users strokeWidth={2.5} className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[0.8125rem] font-bold text-ink">
                  {tr(lang, '자녀 선택', 'Children', '选择孩子')}
                  {kids.length > 1 && (
                    <span className="ml-1.5 text-accent-700">
                      {tr(lang, `지금 ${names[active]}`, `now ${names[active]}`, `当前 ${names[active]}`)}
                    </span>
                  )}
                </span>
                <span className="block text-[0.6875rem] text-slate-600 truncate">
                  {kids.length > 1
                    ? names.join(' · ')
                    : tr(lang, '자녀가 여럿이면 자녀별로 따로 관리해요', 'Several children? Keep a planner for each', '有多个孩子时可分别管理')}
                </span>
              </span>
              <span className="h-8 px-3 rounded-full border border-divider text-[0.6875rem] font-bold text-ink inline-flex items-center gap-1 shrink-0">
                {kids.length > 1 ? tr(lang, '바꾸기', 'Switch', '切换') : <><Plus className="w-3.5 h-3.5" />{tr(lang, '추가', 'Add', '添加')}</>}
              </span>
            </button>
          );
        })()}

        {/* 사용 가이드: by bottom menu, or the setup order */}
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="w-full rounded-2xl bg-paper px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-100"
        >
          <span className="w-9 h-9 rounded-xl bg-sage-700 text-paper grid place-items-center shrink-0">
            <BookOpen strokeWidth={2.5} className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[0.8125rem] font-bold text-ink">{tr(lang, '사용 가이드', 'User guide', '使用指南')}</span>
            <span className="block text-[0.6875rem] text-slate-600 truncate">
              {tr(lang, '메뉴별 기능 · 처음 설정 순서', 'Features by menu · setup steps', '按菜单功能 · 初次设置步骤')}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        </button>

        {onReplayOnboarding && (
          <button
            type="button"
            onClick={onReplayOnboarding}
            className="w-full rounded-2xl bg-paper px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-100"
          >
            <span className="w-9 h-9 rounded-xl bg-accent-700 text-paper grid place-items-center shrink-0">
              <Hand strokeWidth={2.5} className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[0.8125rem] font-bold text-ink">{tr(lang, '처음 사용 안내', 'First-run guide', '初次使用指南')}</span>
              <span className="block text-[0.6875rem] text-slate-600 truncate">
                {tr(lang, '화면 설명과 처음 설정을 한 단계씩 다시 보기', 'Screens and setup, one step at a time', '逐步重看画面说明和初次设置')}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        )}

        {/* 앱 초기화: choose which parts to clear */}
        <button
          type="button"
          onClick={() => {
            setResetParts([]);
            setResetMode('empty');
            setResetConfirming(false);
            setIsResetSheetOpen(true);
          }}
          className="w-full h-10 rounded-full border-[1.5px] border-accent-800 text-accent-800 text-[0.75rem] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-100"
        >
          <Eraser strokeWidth={2.5} className="w-3.5 h-3.5" />
          {tr(lang, '앱 초기화 · 항목 골라서 지우기', 'Reset app · choose what to clear', '重置应用 · 选择要清除的内容')}
        </button>
      </section>

      {/* ===== 내 정보 (profile shown on the timetable's 지금 card) ===== */}
      <SettingsCard
        id="profile"
        open={!!openCards.profile}
        onToggle={toggleCard}
        tone="sage"
        icon={IdCard}
        title={tr(lang, '내 정보', 'My profile', '我的信息')}
        summary={
          [profile.name, profile.school, profile.grade].map((v) => v.trim()).filter(Boolean).join(' · ') ||
          tr(lang, '이름·학교·학년을 입력해 주세요', 'Add your name, school and grade', '请填写姓名、学校和年级')
        }
      >
        <div className="p-3.5 space-y-3.5">
          {/* Live preview of the 지금 card identity row */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.6875rem] font-bold text-slate-600">
                {tr(lang, '시간표 「지금」 카드 미리보기', 'Preview on the timetable “Now” card', '课表「现在」卡片预览')}
              </span>
              <span
                aria-live="polite"
                className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold text-sage-800 transition-opacity ${
                  profileSaved ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <Check strokeWidth={3} className="w-3.5 h-3.5" />
                {profileSaved ? tr(lang, '저장됨', 'Saved', '已保存') : ''}
              </span>
            </div>
            {(() => {
              const name = profile.name.trim();
              const school = profile.school.trim();
              const grade = profile.grade.trim();
              const initials = profileInitials(name);
              return (
                <div className="bg-ink text-paper rounded-[24px] p-4 flex items-center gap-3" aria-hidden="true">
                  <span className="w-12 h-12 rounded-full bg-sage-700 text-paper grid place-items-center shrink-0 ring-2 ring-paper/30 ring-offset-2 ring-offset-ink text-[1.125rem] font-bold">
                    {initials || <UserRound className="w-5 h-5" strokeWidth={2.5} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[0.75rem] font-semibold text-paper/80 truncate">
                      {(() => {
                        const hour = new Date().getHours();
                        return hour < 12
                          ? tr(lang, '좋은 아침이에요,', 'Good morning,', '早上好，')
                          : hour < 18
                          ? tr(lang, '좋은 오후예요,', 'Good afternoon,', '下午好，')
                          : tr(lang, '좋은 저녁이에요,', 'Good evening,', '晚上好，');
                      })()}
                    </span>
                    <span className="block text-[1.25rem] leading-tight font-bold text-paper truncate">
                      {name
                        ? tr(lang, `${name} 님`, name, name)
                        : tr(lang, '이름', 'Your name', '姓名')}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center gap-1 min-w-0 h-6 px-2.5 rounded-full bg-paper/15 text-paper text-[0.6875rem] font-bold">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{school || tr(lang, '학교', 'School', '学校')}</span>
                      </span>
                      <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-paper/15 text-paper text-[0.6875rem] font-bold whitespace-nowrap shrink-0 max-w-[45%]">
                        <span className="truncate">{grade || tr(lang, '학년', 'Grade', '年级')}</span>
                      </span>
                    </span>
                  </span>
                  <PenLine className="w-4 h-4 text-paper/60 shrink-0 self-start mt-1" strokeWidth={2.5} />
                </div>
              );
            })()}
          </div>

          {/* Fields */}
          <div className="space-y-2.5">
            <label className="block space-y-1">
              <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '이름', 'Name', '姓名')}</span>
              <input
                ref={profileNameRef}
                type="text"
                value={profile.name}
                maxLength={30}
                autoComplete="name"
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder={tr(lang, '예: 김민준', 'e.g. Minjun Kim', '例如：金敏俊')}
                className="w-full h-10 px-4 rounded-full bg-paper border border-divider text-[0.875rem] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '학교', 'School', '学校')}</span>
              <input
                type="text"
                value={profile.school}
                maxLength={40}
                autoComplete="organization"
                onChange={(e) => updateProfile({ school: e.target.value })}
                placeholder={tr(lang, '예: 한빛중학교', 'e.g. Hanbit Middle School', '例如：韩光中学')}
                className="w-full h-10 px-4 rounded-full bg-paper border border-divider text-[0.875rem] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </label>
            <div className="space-y-1">
              <label htmlFor="settings-profile-grade" className="block text-[0.75rem] font-bold text-ink">
                {tr(lang, '학년·반', 'Grade & class', '年级·班级')}
              </label>
              <input
                id="settings-profile-grade"
                ref={profileGradeRef}
                type="text"
                value={profile.grade}
                maxLength={30}
                onChange={(e) => {
                  setLastGradeChip(null);
                  updateProfile({ grade: e.target.value });
                }}
                placeholder={tr(lang, '예: 2학년 3반', 'e.g. Grade 8, Class 3', '例如：初二 3班')}
                className="w-full h-10 px-4 rounded-full bg-paper border border-divider text-[0.875rem] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
              <div
                role="group"
                aria-label={tr(lang, '학년 빠른 선택', 'Quick grade pick', '快速选择年级')}
                className="flex flex-wrap gap-1.5 pt-1"
              >
                {GRADE_CHIPS.map((chip) => {
                  const active = lastGradeChip === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyGradeChip(chip)}
                      className={`h-7 min-w-[40px] px-2.5 rounded-full text-[0.6875rem] font-bold transition-colors ${
                        active
                          ? 'bg-sage-700 text-paper'
                          : chip.level === 'e'
                            ? 'bg-paper border border-divider text-ink hover:bg-slate-100'
                            : chip.level === 'm'
                              ? 'bg-paper border border-sage-300 text-sage-800 hover:bg-sage-100'
                              : 'bg-paper border border-accent-300 text-accent-800 hover:bg-accent-100'
                      }`}
                    >
                      {gradeChipLabel(chip, lang)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[0.6875rem] text-slate-600 leading-snug">
                {tr(
                  lang,
                  '학년을 고른 뒤 반을 이어서 입력할 수 있어요. 정보는 이 기기에만 저장돼요.',
                  'Pick a grade, then type your class after it. Saved on this device only.',
                  '选好年级后可以继续输入班级。信息只保存在本设备上。'
                )}
              </p>
            </div>
          </div>

          {(profile.name || profile.school || profile.grade) && (
            <SectionResetButton
              lang={lang}
              label={tr(lang, '내 정보 지우기', 'Clear my profile', '清除我的信息')}
              confirmText={tr(
                lang,
                '이름·학교·학년을 모두 지울까요?',
                'Clear your name, school and grade?',
                '要清除姓名、学校和年级吗？'
              )}
              confirmLabel={tr(lang, '지우기', 'Clear', '清除')}
              onConfirm={handleClearProfile}
            />
          )}
        </div>
      </SettingsCard>

      {/* ===== GROUP: 시간표 ===== */}
      <div className="space-y-2">
        <GroupHeader label={tr(lang, '시간표', 'Timetable', '课表')} />

        <SettingsCard
          id="layout"
          open={!!openCards.layout}
          onToggle={toggleCard}
          tone="neutral"
          icon={LayoutList}
          title={tr(lang, '시간표 화면 구성', 'Timetable layout', '课表画面布局')}
          summary={
            timetableLayout.hidden.length > 0
              ? tr(lang, `순서 설정 · ${timetableLayout.hidden.length}개 숨김`, `Custom order · ${timetableLayout.hidden.length} hidden`, `自定义顺序 · 隐藏 ${timetableLayout.hidden.length} 个`)
              : tr(lang, '시간표 메뉴의 칸 순서와 표시', 'Order and visibility of timetable sections', '课表菜单板块的顺序与显示')
          }
        >
          <div className="p-4 space-y-4">
            <p className="text-[0.6875rem] text-slate-600 leading-relaxed">
              {tr(
                lang,
                '↑↓로 순서를 바꾸고, 스위치로 칸을 숨기거나 보여줘요. 일별·주간·월별 선택과 날짜 칸은 항상 시간표 위에 있어요.',
                'Use ↑↓ to reorder and the switch to hide or show. The day/week/month and date controls always stay above the timetable.',
                '用 ↑↓ 调整顺序，用开关隐藏或显示。日/周/月和日期选择始终位于课表上方。'
              )}
            </p>
            {(
              [
                ['screen', tr(lang, '시간표 화면', 'Timetable screen', '课表画面')],
                ['daily', tr(lang, '일별 보기', 'Day view', '日视图')],
                ['weekly', tr(lang, '주간 보기', 'Week view', '周视图')],
              ] as Array<[TimetableBlockGroup, string]>
            ).map(([group, groupLabel]) => {
              const meta: Record<TimetableBlockId, [string, string]> = {
                now: [tr(lang, '「지금」 카드', '“Now” card', '「现在」卡片'), tr(lang, '시계 · 지금 수업 · 오늘 보강', 'Clock, current class, today’s makeups', '时钟 · 当前课程 · 今日补课')],
                main: [tr(lang, '시간표', 'Timetable', '课表'), tr(lang, '일별·주간·월별 보기', 'Day, week and month views', '日/周/月视图')],
                daySummary: [tr(lang, '하루 한눈에', 'Day at a glance', '一天概览'), tr(lang, '시간 막대 · 합계 · 겹침 경고', 'Time bar, totals, overlaps', '时间条 · 合计 · 冲突提醒')],
                dayDetail: [tr(lang, '타임라인 · 목록', 'Timeline · list', '时间轴 · 列表'), tr(lang, '그날 수업과 일정', 'The day’s classes and events', '当天课程与日程')],
                weekSchool: [tr(lang, '학교 시간표', 'School timetable', '学校课表'), tr(lang, '월~금 교시 표', 'Mon–Fri periods', '周一至周五课节表')],
                weekAcademy: [tr(lang, '학원', 'Academies', '补习班'), tr(lang, '월~일 학원 수업', 'Mon–Sun classes', '周一至周日补习班')],
              };
              const items = sortedGroup(group);
              return (
                <div key={group} className="space-y-1.5">
                  <span className="text-[0.75rem] font-bold text-ink">{groupLabel}</span>
                  {items.map((id, idx) => {
                    const fixed = TIMETABLE_FIXED_BLOCKS.includes(id);
                    const visible = fixed || !timetableLayout.hidden.includes(id);
                    const [label, hint] = meta[id];
                    return (
                      <div
                        key={id}
                        className={`rounded-2xl bg-paper px-3 py-2 flex items-center gap-2 ${visible ? '' : 'opacity-60'}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-surface text-[0.6875rem] font-mono text-slate-700 grid place-items-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[0.8125rem] font-bold text-ink truncate">{label}</span>
                          <span className="block text-[0.6875rem] text-slate-600 truncate">{hint}</span>
                        </span>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveTimetableBlock(group, id, -1)}
                          aria-label={tr(lang, `${label} 위로`, `Move ${label} up`, `${label} 上移`)}
                          className="w-8 h-8 rounded-full grid place-items-center text-ink hover:bg-surface disabled:opacity-25 shrink-0"
                        >
                          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => moveTimetableBlock(group, id, 1)}
                          aria-label={tr(lang, `${label} 아래로`, `Move ${label} down`, `${label} 下移`)}
                          className="w-8 h-8 rounded-full grid place-items-center text-ink hover:bg-surface disabled:opacity-25 shrink-0"
                        >
                          <ArrowDown className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        {fixed ? (
                          <span className="w-12 text-center text-[0.625rem] font-bold text-slate-500 shrink-0">
                            {tr(lang, '항상', 'Always', '始终')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={visible}
                            aria-label={tr(lang, `${label} 보이기`, `Show ${label}`, `显示${label}`)}
                            onClick={() => toggleTimetableBlock(id)}
                            className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${visible ? 'bg-accent-700' : 'bg-slate-300'}`}
                          >
                            <span className={`block w-6 h-6 rounded-full bg-paper shadow-xs transition-transform ${visible ? 'translate-x-5' : ''}`} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <SectionResetButton lang={lang} label={sectionResetLabel} onConfirm={handleResetTimetableLayout} />
          </div>
        </SettingsCard>

        <SettingsCard
          id="range"
          open={!!openCards.range}
          onToggle={toggleCard}
          tone="neutral"
          icon={Clock}
          title={tr(lang, '시간표 표시 범위', 'Timeline Display Range', '时间轴显示范围')}
          summary={
            <>
              <span className="font-mono tabular-nums">
                {String(timelineStartHour).padStart(2, '0')}:00–{String(timelineEndHour).padStart(2, '0')}:00
              </span>
              {' · '}
              {tr(
                lang,
                `하루 ${timelineEndHour - timelineStartHour}시간`,
                `${timelineEndHour - timelineStartHour} hrs/day`,
                `每天 ${timelineEndHour - timelineStartHour} 小时`
              )}
            </>
          }
        >
          <div className="p-4 space-y-3">
            <p className="text-[0.6875rem] text-slate-600">
              {tr(
                lang,
                '[시간표 > 일별 상세 보기]의 타임라인 표와 빈 시간 계산에 적용할 하루의 시작 시각과 종료 시각을 선택하세요.',
                'Choose the start and end hours displayed on the Daily Timeline and used for free-time calculation.',
                '选择应用于【课程表 > 每日详情】时间轴视图及空闲时间计算的每日起止时间。'
              )}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="block text-[0.6875rem] font-medium text-slate-600">
                  {tr(lang, '하루 시작 시간', 'Start Hour', '开始时间')}
                </span>
                <select
                  value={timelineStartHour}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    const adjustedEnd =
                      timelineEndHour <= nextStart + 1 ? Math.min(24, nextStart + 2) : timelineEndHour;
                    handleUpdateTimelineRange(nextStart, adjustedEnd);
                  }}
                  className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                >
                  {[5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-[0.6875rem] font-medium text-slate-600">
                  {tr(lang, '하루 종료 시간', 'End Hour', '结束时间')}
                </span>
                <select
                  value={timelineEndHour}
                  onChange={(e) => handleUpdateTimelineRange(timelineStartHour, Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                >
                  {[16, 17, 18, 19, 20, 21, 22, 23, 24]
                    .filter((h) => h >= timelineStartHour + 2)
                    .map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { s: 6, e: 24, label: tr(lang, '얼리버드 (06~24시)', 'Early (06-24h)', '早鸟 (06~24时)') },
                  { s: 8, e: 24, label: tr(lang, '기본 (08~24시)', 'Default (08-24h)', '默认 (08~24时)') },
                  { s: 8, e: 22, label: tr(lang, '표준 (08~22시)', 'Compact (08-22h)', '紧凑 (08~22时)') },
                ] as Array<{ s: number; e: number; label: string }>
              ).map((p) => (
                <button
                  key={`${p.s}-${p.e}`}
                  type="button"
                  onClick={() => handleUpdateTimelineRange(p.s, p.e)}
                  className={`h-[30px] px-3 rounded-full text-[0.6875rem] font-semibold border transition-colors ${
                    timelineStartHour === p.s && timelineEndHour === p.e
                      ? 'bg-ink text-paper border-transparent'
                      : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <SectionResetButton lang={lang} label={sectionResetLabel} onConfirm={handleResetTimelineRange} />
          </div>
        </SettingsCard>

        <SettingsCard
          id="pool"
          open={!!openCards.pool}
          onToggle={toggleCard}
          tone="neutral"
          icon={Tags}
          title={tr(lang, '과목/수업 설정', 'Subjects & classes', '科目/课程设置')}
          summary={tr(
            lang,
            `학교 ${state.subjectPool.school.length}개 · 학원 ${state.subjectPool.academy.length}개`,
            `${state.subjectPool.school.length} school · ${state.subjectPool.academy.length} academy`,
            `学校 ${state.subjectPool.school.length} 个 · 补习班 ${state.subjectPool.academy.length} 个`
          )}
        >
          <div className="p-4 space-y-4">
            <p className="text-[0.6875rem] text-slate-600 leading-relaxed">
              {tr(
                lang,
                '시간표를 수정할 때 빠른 선택 버튼으로 나타나는 학교 과목과 학원 목록이에요. 이름 앞 동그라미를 누르면 과목마다 색을 정할 수 있고, 시간표에 그 색으로 표시돼요.',
                'Subjects and academies offered when editing timetables. Tap the circle before a name to give it a colour; timetables show it in that colour.',
                '修改课表时作为快捷按钮显示的学校科目与补习班列表。点击名称前的圆点可为科目设置颜色，课表会以该颜色显示。'
              )}
            </p>
            {/* School Subject Pool */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-sage-800">
                  {tr(
                    lang,
                    `학교 과목 후보군 (${state.subjectPool.school.length}종)`,
                    `School Subjects (${state.subjectPool.school.length})`,
                    `学校候选科目 (${state.subjectPool.school.length}种)`
                  )}
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {state.subjectPool.school.map((subj) => (
                  <span
                    key={subj}
                    className="inline-flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full bg-sage-100 text-sage-800 text-[0.6875rem] font-semibold"
                    style={
                      subjectColor(state.subjectColors, subj)
                        ? { backgroundColor: subjectColor(state.subjectColors, subj)!.bg, color: subjectColor(state.subjectColors, subj)!.fg }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setColorPickFor(colorPickFor === subj ? null : subj)}
                      aria-label={tr(lang, `${subj} 색상 고르기`, `Colour for ${translateSubject(subj, lang)}`, `为${translateSubject(subj, lang)}选择颜色`)}
                      aria-expanded={colorPickFor === subj}
                      className={`w-4 h-4 rounded-full border-2 border-paper shrink-0 ${colorPickFor === subj ? 'ring-2 ring-ink' : ''}`}
                      style={{ backgroundColor: subjectColor(state.subjectColors, subj)?.dot ?? 'transparent', borderStyle: subjectColor(state.subjectColors, subj) ? 'solid' : 'dashed' }}
                    />
                    {translateSubject(subj, lang)}
                    <button
                      type="button"
                      onClick={() => handleRemoveSchoolSubject(subj)}
                      className="text-sage-600 hover:text-accent-800"
                      aria-label={tr(
                        lang,
                        `${subj} 삭제`,
                        `Delete ${translateSubject(subj, lang)}`,
                        `删除${translateSubject(subj, lang)}`
                      )}
                    >
                      <X className="w-3 h-3" strokeWidth={2.75} />
                    </button>
                  </span>
                ))}
              </div>
              {colorPickFor && state.subjectPool.school.includes(colorPickFor) && (
                <div className="rounded-2xl bg-paper p-2.5 space-y-2">
                  <div className="text-[0.6875rem] font-bold text-ink">
                    {tr(lang, `「${translateSubject(colorPickFor, lang)}」 색상`, `Colour for ${translateSubject(colorPickFor, lang)}`, `「${translateSubject(colorPickFor, lang)}」的颜色`)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECT_COLOR_KEYS.map((key) => {
                      const c = SUBJECT_COLORS[key];
                      const active = state.subjectColors?.[colorPickFor] === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSubjectColor(colorPickFor, key)}
                          aria-label={key}
                          aria-pressed={active}
                          className={`w-8 h-8 rounded-full grid place-items-center ${active ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
                          style={{ backgroundColor: c.bg, border: `3px solid ${c.dot}` }}
                        >
                          {active && <Check strokeWidth={3.5} className="w-3.5 h-3.5" style={{ color: c.fg }} />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSubjectColor(colorPickFor, null)}
                      className="h-8 px-3 rounded-full border border-dashed border-slate-400 text-[0.6875rem] font-bold text-slate-700"
                    >
                      {tr(lang, '기본색', 'Default', '默认')}
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleAddSchoolSubject} className="flex gap-2">
                <input
                  type="text"
                  placeholder={tr(
                    lang,
                    '새 학교 과목 입력 (예: 제2외국어, 진로)',
                    'Add new school subject (e.g. Physics, Spanish)',
                    '输入新学校科目（如：物理、第二外语）'
                  )}
                  value={newSchoolSubject}
                  onChange={(e) => setNewSchoolSubject(e.target.value)}
                  className="flex-1 min-w-0 h-9 px-3 rounded-full border border-divider bg-paper text-xs font-medium text-ink placeholder:text-slate-600 focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-full bg-sage-700 text-paper text-xs font-bold inline-flex items-center gap-1 hover:bg-sage-800 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> {tr(lang, '추가', 'Add', '添加')}
                </button>
              </form>
            </div>

            {/* Academy Subject Pool */}
            <div className="space-y-2.5 pt-3 border-t border-divider">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-accent-800">
                  {tr(
                    lang,
                    `학원 후보군 (${state.subjectPool.academy.length}종)`,
                    `Academies (${state.subjectPool.academy.length})`,
                    `补习班候选库 (${state.subjectPool.academy.length}家)`
                  )}
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {state.subjectPool.academy.map((acName) => (
                  <span
                    key={acName}
                    className="inline-flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[0.6875rem] font-semibold"
                    style={
                      subjectColor(state.subjectColors, acName)
                        ? { backgroundColor: subjectColor(state.subjectColors, acName)!.bg, color: subjectColor(state.subjectColors, acName)!.fg }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setColorPickFor(colorPickFor === acName ? null : acName)}
                      aria-label={tr(lang, `${acName} 색상 고르기`, `Colour for ${translateSubject(acName, lang)}`, `为${translateSubject(acName, lang)}选择颜色`)}
                      aria-expanded={colorPickFor === acName}
                      className={`w-4 h-4 rounded-full border-2 border-paper shrink-0 ${colorPickFor === acName ? 'ring-2 ring-ink' : ''}`}
                      style={{ backgroundColor: subjectColor(state.subjectColors, acName)?.dot ?? 'transparent', borderStyle: subjectColor(state.subjectColors, acName) ? 'solid' : 'dashed' }}
                    />
                    {translateSubject(acName, lang)}
                    <button
                      type="button"
                      onClick={() => handleRemoveAcademySubject(acName)}
                      className="text-accent-600 hover:text-accent-900"
                      aria-label={tr(
                        lang,
                        `${acName} 삭제`,
                        `Delete ${translateSubject(acName, lang)}`,
                        `删除${translateSubject(acName, lang)}`
                      )}
                    >
                      <X className="w-3 h-3" strokeWidth={2.75} />
                    </button>
                  </span>
                ))}
              </div>
              {colorPickFor && state.subjectPool.academy.includes(colorPickFor) && (
                <div className="rounded-2xl bg-paper p-2.5 space-y-2">
                  <div className="text-[0.6875rem] font-bold text-ink">
                    {tr(lang, `「${translateSubject(colorPickFor, lang)}」 색상`, `Colour for ${translateSubject(colorPickFor, lang)}`, `「${translateSubject(colorPickFor, lang)}」的颜色`)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBJECT_COLOR_KEYS.map((key) => {
                      const c = SUBJECT_COLORS[key];
                      const active = state.subjectColors?.[colorPickFor] === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSubjectColor(colorPickFor, key)}
                          aria-label={key}
                          aria-pressed={active}
                          className={`w-8 h-8 rounded-full grid place-items-center ${active ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
                          style={{ backgroundColor: c.bg, border: `3px solid ${c.dot}` }}
                        >
                          {active && <Check strokeWidth={3.5} className="w-3.5 h-3.5" style={{ color: c.fg }} />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSubjectColor(colorPickFor, null)}
                      className="h-8 px-3 rounded-full border border-dashed border-slate-400 text-[0.6875rem] font-bold text-slate-700"
                    >
                      {tr(lang, '기본색', 'Default', '默认')}
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleAddAcademySubject} className="flex gap-2">
                <input
                  type="text"
                  placeholder={tr(
                    lang,
                    '새 학원명 입력 (예: 피아노학원, 국어학원)',
                    'Add new academy (e.g. Piano Academy)',
                    '输入新补习班名称（如：钢琴班、语文班）'
                  )}
                  value={newAcademySubject}
                  onChange={(e) => setNewAcademySubject(e.target.value)}
                  className="flex-1 min-w-0 h-9 px-3 rounded-full border border-divider bg-paper text-xs font-medium text-ink placeholder:text-slate-600 focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-full bg-accent-700 text-paper text-xs font-bold inline-flex items-center gap-1 hover:bg-accent-800 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> {tr(lang, '추가', 'Add', '添加')}
                </button>
              </form>
            </div>

            <SectionResetButton
              lang={lang}
              label={sectionResetLabel}
              onConfirm={handleResetSubjectPool}
              onClear={handleClearSubjectPool}
              clearText={tr(
                lang,
                '학교 과목과 학원 목록, 과목 색상을 모두 지워요. 시간표에 넣은 과목은 그대로예요.',
                'Removes every school subject, academy and colour from the list. Timetables keep their subjects.',
                '将清除所有学校科目、补习班和颜色。课表中已填的科目保留。'
              )}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          id="school"
          open={!!openCards.school}
          onToggle={toggleCard}
          tone="sage"
          icon={GraduationCap}
          title={tr(lang, '학교 시간표', 'School Timetable', '学校课表')}
          summary={schoolSummary}
        >
          <div className="p-4 space-y-5">
            {/* STEP A: class times */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sage-700 text-paper font-mono text-[0.6875rem] grid place-items-center shrink-0">
                  1
                </span>
                <span className="text-xs font-bold text-ink">
                  {tr(lang, '수업 시간 정하기', 'Class Times', '设定上课时间')}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label={tr(lang, '수업 시간 설정 방식', 'Class time setup mode', '上课时间设置方式')}
                className="grid grid-cols-2 p-1 rounded-full bg-paper gap-1"
              >
                {(
                  [
                    { mode: 'preset', label: tr(lang, '프리셋으로 자동 계산', 'Auto (Preset)', '按预设自动计算') },
                    { mode: 'custom', label: tr(lang, '교시별 직접 입력', 'Set Each Period', '逐节自定义') },
                  ] as Array<{ mode: SchoolTimeConfig['mode']; label: string }>
                ).map((opt) => {
                  const active = schoolTimeConfig.mode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => updateSchoolTimeConfig({ mode: opt.mode })}
                      className={`h-8 rounded-full text-[0.6875rem] font-bold transition-colors ${
                        active ? 'bg-sage-700 text-paper' : 'text-ink hover:bg-sage-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {isPresetMode ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { min: 40, label: tr(lang, '초등 (40분)', 'Elem (40m)', '小学 (40分)') },
                        { min: 45, label: tr(lang, '중등 (45분)', 'Middle (45m)', '初中 (45分)') },
                        { min: 50, label: tr(lang, '고등 (50분)', 'High (50m)', '高中 (50分)') },
                      ] as Array<{ min: number; label: string }>
                    ).map((q) => (
                      <button
                        key={q.min}
                        type="button"
                        onClick={() => updateSchoolTimeConfig({ classMinutes: q.min })}
                        className={`h-[30px] px-3 rounded-full text-[0.6875rem] font-semibold border transition-colors ${
                          schoolTimeConfig.classMinutes === q.min
                            ? 'bg-sage-700 text-paper border-transparent'
                            : 'border-divider text-ink hover:bg-sage-100 hover:border-sage-300'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                    <label className="space-y-1">
                      <span className="block text-[0.6875rem] font-medium text-slate-600">
                        {tr(lang, '첫 수업 시작', 'First Class Starts', '第一节开始')}
                      </span>
                      <input
                        type="time"
                        value={schoolTimeConfig.firstStart}
                        onChange={(e) => e.target.value && updateSchoolTimeConfig({ firstStart: e.target.value })}
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:border-sage"
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="block text-[0.6875rem] font-medium text-slate-600">
                        {tr(lang, '교시 수', 'Periods', '节数')}
                      </span>
                      <Stepper
                        value={schoolTimeConfig.periodCount}
                        min={1}
                        max={12}
                        suffix={tr(lang, '교시', '', '节')}
                        onChange={(v) => updateSchoolTimeConfig({ periodCount: v })}
                        decLabel={tr(lang, '교시 수 줄이기', 'Fewer periods', '减少节数')}
                        incLabel={tr(lang, '교시 수 늘리기', 'More periods', '增加节数')}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[0.6875rem] font-medium text-slate-600">
                        {tr(lang, '수업 시간', 'Class Length', '每节时长')}
                      </span>
                      <Stepper
                        value={schoolTimeConfig.classMinutes}
                        min={5}
                        max={180}
                        step={5}
                        suffix={tr(lang, '분', 'min', '分')}
                        onChange={(v) => updateSchoolTimeConfig({ classMinutes: v })}
                        decLabel={tr(lang, '수업 시간 줄이기', 'Shorter classes', '缩短上课时长')}
                        incLabel={tr(lang, '수업 시간 늘리기', 'Longer classes', '延长上课时长')}
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[0.6875rem] font-medium text-slate-600">
                        {tr(lang, '쉬는 시간', 'Break', '课间休息')}
                      </span>
                      <Stepper
                        value={schoolTimeConfig.breakMinutes}
                        min={0}
                        max={120}
                        step={5}
                        suffix={tr(lang, '분', 'min', '分')}
                        onChange={(v) => updateSchoolTimeConfig({ breakMinutes: v })}
                        decLabel={tr(lang, '쉬는 시간 줄이기', 'Shorter breaks', '缩短课间')}
                        incLabel={tr(lang, '쉬는 시간 늘리기', 'Longer breaks', '延长课间')}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <span className="block text-[0.6875rem] font-medium text-slate-600">
                        {tr(lang, '점심시간', 'Lunch Length', '午休时长')}
                      </span>
                      <Stepper
                        value={schoolTimeConfig.lunchMinutes}
                        min={0}
                        max={180}
                        step={5}
                        suffix={tr(lang, '분', 'min', '分')}
                        onChange={(v) => updateSchoolTimeConfig({ lunchMinutes: v })}
                        decLabel={tr(lang, '점심시간 줄이기', 'Shorter lunch', '缩短午休')}
                        incLabel={tr(lang, '점심시간 늘리기', 'Longer lunch', '延长午休')}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[0.6875rem] font-medium text-slate-600">
                      {tr(lang, '점심은 언제?', 'Lunch comes after', '午休位置')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, ...Array.from({ length: Math.max(0, schoolTimeConfig.periodCount - 1) }, (_, i) => i + 1)].map(
                        (n) => {
                          const current =
                            schoolTimeConfig.lunchAfterPeriod >= schoolTimeConfig.periodCount
                              ? 0
                              : schoolTimeConfig.lunchAfterPeriod;
                          const active = current === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => updateSchoolTimeConfig({ lunchAfterPeriod: n })}
                              className={`h-[30px] px-3 rounded-full text-[0.6875rem] font-semibold border transition-colors ${
                                active
                                  ? n === 0
                                    ? 'bg-ink text-paper border-transparent'
                                    : 'bg-accent-200 text-accent-900 border-transparent'
                                  : 'border-divider text-ink hover:bg-slate-100'
                              }`}
                            >
                              {n === 0
                                ? tr(lang, '없음', 'None', '无')
                                : tr(lang, `${n}교시 후`, `After P${n}`, `第${n}节后`)}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Live visual preview: vertical time ruler */}
                  <div className="rounded-xl bg-paper p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.6875rem] font-bold text-slate-600">
                        {tr(lang, '미리보기', 'Preview', '预览')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-sage-100 text-sage-900 text-[0.6875rem] font-bold">
                        {tr(
                          lang,
                          `${schoolTimeConfig.periodCount}교시 · ${schoolTimeConfig.firstStart} 시작 · ${presetEndTime} 종료`,
                          `${schoolTimeConfig.periodCount} periods · ${schoolTimeConfig.firstStart} start · ${presetEndTime} end`,
                          `${schoolTimeConfig.periodCount}节 · ${schoolTimeConfig.firstStart} 开始 · ${presetEndTime} 结束`
                        )}
                      </span>
                    </div>
                    <div>
                      {presetPreviewRows.map((row, idx) => {
                        const isLast = idx === presetPreviewRows.length - 1;
                        const lunchHere = presetHasLunch && row.period === schoolTimeConfig.lunchAfterPeriod;
                        const gapMin = lunchHere ? schoolTimeConfig.lunchMinutes : schoolTimeConfig.breakMinutes;
                        const gapEnd = minutesToTimeStr(timeStrToMinutes(row.endTime) + gapMin);
                        return (
                          <React.Fragment key={row.period}>
                            <div className="flex gap-2">
                              <div className="w-10 shrink-0 text-right text-[0.6875rem] font-mono text-slate-600 tabular-nums leading-none pt-1">
                                {row.startTime}
                              </div>
                              <div className="flex-1 min-w-0 border-l-2 border-sage-300 pl-2">
                                <div
                                  style={{ height: Math.max(30, schoolTimeConfig.classMinutes * PREVIEW_PX_PER_MIN) }}
                                  className="rounded-xl bg-sage-200 text-sage-900 px-2.5 flex items-center justify-between gap-2"
                                >
                                  <span className="text-[0.6875rem] font-bold">{periodLabel(row.period)}</span>
                                  <span className="text-[0.6875rem] font-mono tabular-nums">
                                    {row.startTime}–{row.endTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {!isLast &&
                              (lunchHere ? (
                                <div className="flex gap-2">
                                  <div className="w-10 shrink-0 text-right text-[0.6875rem] font-mono text-accent-700 tabular-nums leading-none pt-1.5">
                                    {row.endTime}
                                  </div>
                                  <div className="flex-1 min-w-0 border-l-2 border-accent-300 pl-2 py-1">
                                    <div
                                      style={{ height: Math.max(28, gapMin * PREVIEW_PX_PER_MIN) }}
                                      className="rounded-xl bg-accent-100 border border-dashed border-accent-300 text-accent-800 px-2.5 flex items-center justify-between gap-2"
                                    >
                                      <span className="text-[0.6875rem] font-bold">
                                        {tr(lang, `점심 ${gapMin}분`, `Lunch ${gapMin} min`, `午休 ${gapMin} 分钟`)}
                                      </span>
                                      <span className="text-[0.6875rem] font-mono tabular-nums">
                                        {row.endTime}–{gapEnd}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <div className="w-10 shrink-0" />
                                  <div
                                    className="flex-1 min-w-0 border-l-2 border-dotted border-slate-300 pl-2 flex items-center"
                                    style={{ height: gapMin > 0 ? Math.max(18, gapMin * PREVIEW_PX_PER_MIN) : 6 }}
                                  >
                                    {gapMin > 0 && (
                                      <span className="text-[0.6875rem] text-slate-600">
                                        {tr(lang, `쉬는 시간 ${gapMin}분`, `Break ${gapMin} min`, `课间 ${gapMin} 分钟`)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </React.Fragment>
                        );
                      })}
                      <div className="flex gap-2 pt-1">
                        <div className="w-10 shrink-0 text-right text-[0.6875rem] font-mono font-bold text-ink tabular-nums">
                          {presetEndTime}
                        </div>
                        <span className="text-[0.6875rem] font-semibold text-slate-600">
                          {tr(lang, '하교', 'School ends', '放学')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplySchoolTimePresetToAllDays}
                    className="w-full h-10 rounded-full bg-accent-700 text-paper text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-800"
                  >
                    <Check className="w-4 h-4" />
                    {tr(lang, '모든 요일에 적용', 'Apply to All Days', '应用到所有星期')}
                  </button>
                  <p className="text-[0.6875rem] text-slate-600 text-center">
                    {tr(
                      lang,
                      '기존 과목은 교시 순서대로 유지되며, 학교 수업이 없는 요일(예: 토·일)은 건너뜁니다.',
                      'Existing subjects are kept by period order; days without school periods (e.g. Sat/Sun) are skipped.',
                      '现有科目按节次顺序保留；没有学校课程的星期（如周六、周日）将被跳过。'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[0.6875rem] text-slate-600 px-3 py-2 rounded-xl bg-paper">
                    {tr(
                      lang,
                      '아래 표에서 왼쪽 교시 칸을 누르면 그 교시의 시작·종료 시간을 바꿀 수 있어요. 요일마다 다르게 정할 수도 있습니다.',
                      'Tap a period label on the left of the table below to change its start/end time — for all days or a single day.',
                      '点击下方表格左侧的节次即可修改该节的开始与结束时间，也可按星期分别设置。'
                    )}
                  </p>

                  {/* 점심시간 (custom mode): shown on the daily timetable of school days */}
                  {(() => {
                    const lunch = schoolTimeConfig.customLunch ?? { enabled: false, start: '12:30', end: '13:20' };
                    const invalid = lunch.enabled && lunch.end <= lunch.start;
                    const setLunch = (patch: Partial<typeof lunch>) =>
                      updateSchoolTimeConfig({ customLunch: { ...lunch, ...patch } });
                    return (
                      <div className="rounded-2xl bg-paper p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[0.8125rem] font-bold text-ink">🍱 {tr(lang, '점심시간', 'Lunch break', '午休时间')}</div>
                            <div className="text-[0.6875rem] text-slate-600">
                              {tr(
                                lang,
                                '학교 수업이 있는 날 시간표에 점심시간으로 표시돼요',
                                'Shown on the timetable of school days',
                                '在有课的日子里显示为午休时间'
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={lunch.enabled}
                            onClick={() => setLunch({ enabled: !lunch.enabled })}
                            className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${lunch.enabled ? 'bg-sage-700' : 'bg-slate-300'}`}
                          >
                            <span
                              className={`block w-6 h-6 rounded-full bg-paper shadow-xs transition-transform ${
                                lunch.enabled ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        </div>
                        {lunch.enabled && (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={lunch.start}
                              onChange={(e) => e.target.value && setLunch({ start: e.target.value })}
                              aria-label={tr(lang, '점심 시작', 'Lunch starts', '午休开始')}
                              className="flex-1 min-w-0 h-10 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-sage-500"
                            />
                            <span className="text-sm font-bold text-slate-500">–</span>
                            <input
                              type="time"
                              value={lunch.end}
                              onChange={(e) => e.target.value && setLunch({ end: e.target.value })}
                              aria-label={tr(lang, '점심 끝', 'Lunch ends', '午休结束')}
                              className="flex-1 min-w-0 h-10 px-3 rounded-full border border-divider bg-surface text-[0.875rem] font-mono text-ink outline-none focus:border-sage-500"
                            />
                          </div>
                        )}
                        {invalid && (
                          <p className="text-[0.6875rem] font-semibold text-accent-800">
                            {tr(lang, '끝나는 시간이 시작보다 늦어야 해요', 'End must be after start', '结束时间须晚于开始时间')}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* STEP B: weekly subject table */}
            <div className="space-y-2.5 pt-4 border-t border-divider">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sage-700 text-paper font-mono text-[0.6875rem] grid place-items-center shrink-0">
                    2
                  </span>
                  <span className="text-xs font-bold text-ink">
                    {tr(lang, '요일별 과목 표', 'Weekly Subject Table', '每周科目表')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWeekendPref(!showWeekend)}
                  aria-pressed={showWeekend}
                  className={`h-7 px-2.5 rounded-full text-[0.6875rem] font-semibold border transition-colors ${
                    showWeekend
                      ? 'bg-sage-100 text-sage-900 border-transparent'
                      : 'border-divider text-ink hover:bg-slate-100'
                  }`}
                >
                  {showWeekend
                    ? tr(lang, '토·일 숨기기', 'Hide Sat/Sun', '隐藏周六日')
                    : tr(lang, '+ 토·일 보기', '+ Sat/Sun', '+ 显示周六日')}
                </button>
              </div>
              <p className="text-[0.6875rem] text-slate-600">
                {tr(
                  lang,
                  '칸을 눌러 과목을 고르세요. 빈 칸(+)을 누르면 그 요일에 해당 교시가 생깁니다.',
                  'Tap a cell to pick a subject. Tapping an empty cell (+) adds that period to the day.',
                  '点击单元格选择科目。点击空白单元格（+）会为该星期添加此节课。'
                )}
              </p>

              {schoolRows.length === 0 ? (
                <div className="rounded-xl bg-paper px-3 py-5 text-center space-y-2">
                  <p className="text-[0.6875rem] text-slate-600">
                    {tr(
                      lang,
                      '아직 등록된 교시가 없습니다. 첫 교시를 추가해 보세요.',
                      'No periods yet. Add the first period to start.',
                      '尚未登记任何节次，请先添加第一节课。'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddSchoolRow}
                    className="h-8 px-3 rounded-full bg-sage-700 text-paper text-[0.6875rem] font-bold inline-flex items-center gap-1 hover:bg-sage-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tr(lang, '교시 추가', 'Add Period', '添加节次')}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-paper overflow-x-auto">
                  <table className="w-full text-center border-collapse table-fixed min-w-[300px]">
                    <thead>
                      <tr className="border-b border-divider">
                        <th className="w-[62px] py-2 px-1 text-[0.6875rem] font-semibold text-slate-600 border-r border-divider">
                          {tr(lang, '교시', 'Per', '课时')}
                        </th>
                        {gridDays.map((d) => (
                          <th key={d} className="py-2 px-0.5 text-xs font-bold text-ink">
                            {translateDay(d, lang)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider text-xs">
                      {schoolRows.map((periodNum) => {
                        const info = getRowInfo(periodNum);
                        return (
                          <tr key={periodNum}>
                            <td className="p-0 border-r border-divider">
                              <button
                                type="button"
                                onClick={() => setSchoolSheet({ kind: 'row', period: periodNum })}
                                className="w-full px-1 py-1.5 flex flex-col items-center leading-tight hover:bg-sage-100 transition-colors"
                                aria-label={tr(
                                  lang,
                                  `${periodNum}교시 시간 편집`,
                                  `Edit period ${periodNum} time`,
                                  `编辑第${periodNum}节时间`
                                )}
                              >
                                <span className="text-[0.6875rem] font-bold text-sage-800 inline-flex items-center gap-0.5">
                                  {periodLabel(periodNum)}
                                  {info.mismatch && (
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-accent-400"
                                      title={tr(lang, '요일별 시간이 다름', 'Times differ by day', '各星期时间不同')}
                                    />
                                  )}
                                </span>
                                <span className="text-[0.6875rem] font-mono text-slate-600 tabular-nums">
                                  {info.times.startTime}
                                </span>
                                <span className="text-[0.6875rem] font-mono text-slate-600 tabular-nums">
                                  {info.times.endTime}
                                </span>
                              </button>
                            </td>
                            {gridDays.map((d) => {
                              const cell = state.masterTimetable[d]?.school.find((p) => p.period === periodNum);
                              return (
                                <td key={d} className="p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomSubjectDraft('');
                                      setSchoolSheet({ kind: 'cell', day: d, period: periodNum });
                                    }}
                                    className={`w-full h-11 rounded-lg px-0.5 transition-colors ${
                                      cell
                                        ? cell.subject === '자습'
                                          ? 'bg-slate-200 text-ink hover:bg-slate-300'
                                          : subjectColor(state.subjectColors, cell.subject)
                                          ? 'font-semibold hover:brightness-95'
                                          : 'bg-sage-100 text-sage-900 font-semibold hover:bg-sage-200'
                                        : 'text-slate-400 hover:bg-sage-100 hover:text-sage-700'
                                    }`}
                                    style={(() => {
                                      const c = cell && cell.subject !== '자습' ? subjectColor(state.subjectColors, cell.subject) : undefined;
                                      return c ? { backgroundColor: c.bg, color: c.fg } : undefined;
                                    })()}
                                    aria-label={tr(
                                      lang,
                                      `${d}요일 ${periodNum}교시`,
                                      `${translateDay(d, lang)} period ${periodNum}`,
                                      `${translateDay(d, lang)}第${periodNum}节`
                                    )}
                                  >
                                    {cell ? (
                                      <span className="block truncate text-[0.6875rem]">
                                        {cell.subject
                                          ? translateSubject(cell.subject, lang)
                                          : tr(lang, '(없음)', '(none)', '（无）')}
                                      </span>
                                    ) : (
                                      <Plus className="w-3 h-3 mx-auto" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {schoolRows.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddSchoolRow}
                    className="flex-1 h-8 rounded-full bg-sage-100 text-sage-900 text-[0.6875rem] font-bold inline-flex items-center justify-center gap-1 hover:bg-sage-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tr(lang, `${maxSchoolPeriod + 1}교시 추가`, `Add P${maxSchoolPeriod + 1}`, `添加第${maxSchoolPeriod + 1}节`)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemovePeriodConfirm(true)}
                    aria-expanded={removePeriodConfirm}
                    className="flex-1 h-8 rounded-full border border-divider text-ink text-[0.6875rem] font-semibold inline-flex items-center justify-center gap-1 hover:bg-slate-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    {tr(lang, `${maxSchoolPeriod}교시 삭제`, `Remove P${maxSchoolPeriod}`, `删除第${maxSchoolPeriod}节`)}
                  </button>
                </div>
              )}

              {removePeriodConfirm && schoolRows.length > 0 && (
                <div role="alert" className="rounded-xl bg-accent-100 px-3 py-2.5 space-y-2">
                  <p className="text-[0.75rem] font-semibold text-accent-900">
                    {tr(
                      lang,
                      `모든 요일에서 ${maxSchoolPeriod}교시를 삭제할까요?`,
                      `Remove period ${maxSchoolPeriod} from every day?`,
                      `要从所有星期中删除第${maxSchoolPeriod}节吗？`
                    )}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRemovePeriodConfirm(false)}
                      className="flex-1 h-8 rounded-full border border-divider bg-paper text-ink text-[0.6875rem] font-semibold hover:bg-slate-100"
                    >
                      {tr(lang, '취소', 'Cancel', '取消')}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLastSchoolRow}
                      className="flex-1 h-8 rounded-full bg-accent-800 text-paper text-[0.6875rem] font-bold hover:bg-accent-900"
                    >
                      {tr(lang, '삭제', 'Remove', '删除')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Copy whole day (school + academy) */}
            <div className="space-y-1.5 pt-4 border-t border-divider">
              <div className="flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs font-bold text-ink">
                  {tr(lang, '요일 통째로 복사', 'Copy a Whole Day', '整天复制')}
                </span>
              </div>
              <p className="text-[0.6875rem] text-slate-600">
                {tr(
                  lang,
                  '원본 요일의 학교 과목과 학원 일정을 모두 대상 요일에 덮어씁니다.',
                  'Overwrites the target day with BOTH the school periods and academy classes of the source day.',
                  '将源星期的学校课程和补习班安排全部覆盖到目标星期。'
                )}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={copySourceDay}
                  onChange={(e) => setCopySourceDay(e.target.value as DayOfWeek)}
                  className="h-9 px-3 rounded-full border border-divider bg-paper text-xs font-semibold text-ink focus:outline-none focus:border-accent"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {translateDay(d, lang)} {tr(lang, '원본', 'From', '源')}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-slate-400">→</span>
                <select
                  value={copyTargetDay}
                  onChange={(e) => setCopyTargetDay(e.target.value as DayOfWeek)}
                  className="h-9 px-3 rounded-full border border-divider bg-paper text-xs font-semibold text-ink focus:outline-none focus:border-accent"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {translateDay(d, lang)} {tr(lang, '대상', 'To', '目标')}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCopyDayTimetable}
                  className="flex-1 h-9 px-3 rounded-full border border-divider bg-transparent text-ink text-xs font-semibold inline-flex items-center justify-center gap-1 hover:bg-slate-100 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" /> {tr(lang, '복사', 'Copy', '复制')}
                </button>
              </div>
            </div>

            <SectionResetButton
              lang={lang}
              label={sectionResetLabel}
              onConfirm={handleResetSchoolSection}
              onClear={handleClearSchoolSection}
              clearText={tr(
                lang,
                '모든 요일·교시의 과목과 날짜별 변경을 지워요. 수업 시간 설정은 남아요. 되돌릴 수 없어요.',
                'Clears every subject and day-by-day change. Class times stay. This cannot be undone.',
                '将清除所有科目和按日期的变更，上课时间保留。无法撤销。'
              )}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          id="academy"
          open={!!openCards.academy}
          onToggle={toggleCard}
          tone="accent"
          icon={Building2}
          title={tr(lang, '학원 시간표', 'Academy Timetable', '补习班课表')}
          summary={academySummary}
        >
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((d) => {
                const count = state.masterTimetable[d]?.academy.length ?? 0;
                const active = selectedMasterDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedMasterDay(d)}
                    className={`h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      active ? 'bg-accent-700 text-paper' : 'bg-paper text-ink hover:bg-accent-100'
                    }`}
                  >
                    <span className="text-xs font-bold leading-none">{translateDay(d, lang)}</span>
                    <span
                      className={`text-[0.6875rem] font-mono leading-none tabular-nums ${
                        active ? 'text-accent-100' : count > 0 ? 'text-accent-700' : 'text-slate-400'
                      }`}
                    >
                      {count > 0 ? count : '·'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent-800">
                {tr(
                  lang,
                  `${selectedMasterDay}요일 학원 (${academyDayData.academy.length}건)`,
                  `${translateDay(selectedMasterDay, lang)} academies (${academyDayData.academy.length})`,
                  `${translateDay(selectedMasterDay, lang)}补习班 (${academyDayData.academy.length}项)`
                )}
              </span>
            </div>

            {academyDayData.academy.length === 0 ? (
              <p className="text-[0.6875rem] text-slate-600 py-3 text-center rounded-xl bg-paper">
                {tr(
                  lang,
                  '이 요일에 등록된 기본 학원 일정이 없습니다.',
                  'No default academy classes on this day.',
                  '当天没有登记固定补习班课程。'
                )}
              </p>
            ) : (
              <div className="space-y-1.5">
                {academyDayData.academy
                  .slice()
                  .sort((a, b) => timeStrToMinutes(a.startTime) - timeStrToMinutes(b.startTime))
                  .map((ac) => (
                    <div
                      key={ac.id}
                      className="px-2.5 py-2 rounded-xl bg-paper border-l-4 border-accent-300 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <select
                          value={ac.subject}
                          onChange={(e) => handleUpdateMasterAcademyItem(ac.id, { subject: e.target.value })}
                          className="flex-1 h-8 px-2.5 rounded-full border border-divider bg-surface text-xs font-semibold text-accent-900 min-w-0 focus:outline-none focus:border-accent"
                        >
                          {!state.subjectPool.academy.includes(ac.subject) && (
                            <option value={ac.subject}>{translateSubject(ac.subject, lang)}</option>
                          )}
                          {state.subjectPool.academy.map((aName) => (
                            <option key={aName} value={aName}>
                              {translateSubject(aName, lang)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteMasterAcademyItem(ac.id)}
                          className="p-1.5 text-slate-600 hover:text-accent-800 shrink-0"
                          aria-label={tr(lang, '삭제', 'Delete', '删除')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={ac.startTime}
                          aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
                          onChange={(e) => handleUpdateMasterAcademyItem(ac.id, { startTime: e.target.value })}
                          className="flex-1 min-w-0 h-8 px-2 rounded-full border border-divider bg-surface text-xs font-mono text-ink focus:outline-none focus:border-accent"
                        />
                        <span className="text-xs text-slate-400">~</span>
                        <input
                          type="time"
                          value={ac.endTime}
                          aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                          onChange={(e) => handleUpdateMasterAcademyItem(ac.id, { endTime: e.target.value })}
                          className="flex-1 min-w-0 h-8 px-2 rounded-full border border-divider bg-surface text-xs font-mono text-ink focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddMasterAcademyItem}
              className="w-full h-9 rounded-full border border-dashed border-accent-300 text-accent-800 text-[0.6875rem] font-bold inline-flex items-center justify-center gap-1 hover:bg-accent-100"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr(
                lang,
                `${selectedMasterDay}요일에 학원 추가`,
                `Add academy on ${translateDay(selectedMasterDay, lang)}`,
                `在${translateDay(selectedMasterDay, lang)}添加补习班`
              )}
            </button>

            <SectionResetButton
              lang={lang}
              label={sectionResetLabel}
              onConfirm={handleResetAcademySection}
              onClear={handleClearAcademySection}
              clearText={tr(
                lang,
                '모든 학원 수업과 보강·휴강 기록을 지워요. 되돌릴 수 없어요.',
                'Removes every academy class, makeup and cancellation. This cannot be undone.',
                '将删除所有补习班课程及补课、停课记录。无法撤销。'
              )}
            />
          </div>
        </SettingsCard>

      </div>

      {/* School table editor bottom sheet */}
      {schoolSheet && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/50 flex items-end justify-center"
          onClick={() => setSchoolSheet(null)}
        >
          <div
            className="w-full max-w-md bg-paper rounded-t-[28px] px-4 pt-3 pb-6 max-h-[85vh] overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto" />

            {schoolSheet.kind === 'cell' ? (
              (() => {
                const { day, period } = schoolSheet;
                const rowTimes = sheetCell
                  ? { startTime: sheetCell.startTime, endTime: sheetCell.endTime }
                  : isPresetMode
                  ? resolveRowTimes(state.masterTimetable, schoolTimeConfig, period)
                  : getRowInfo(period).times;
                const pick = (subject: string) => {
                  handleSetSchoolCell(day, period, subject);
                  setSchoolSheet(null);
                };
                return (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[0.8125rem] font-bold text-ink">
                          {tr(
                            lang,
                            `${day}요일 ${period}교시`,
                            `${translateDay(day, lang)} · Period ${period}`,
                            `${translateDay(day, lang)} 第${period}节`
                          )}
                        </h3>
                        <p className="text-[0.6875rem] font-mono text-slate-600 tabular-nums">
                          {rowTimes.startTime}–{rowTimes.endTime}
                          {!sheetCell && (
                            <span className="ml-1.5 font-sans text-sage-700">
                              {tr(lang, '(새로 추가)', '(new)', '（新增）')}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchoolSheet(null)}
                        className="w-8 h-8 rounded-full grid place-items-center text-slate-600 hover:bg-slate-200"
                        aria-label={tr(lang, '닫기', 'Close', '关闭')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-[0.6875rem] font-medium text-slate-600">
                        {tr(lang, '과목 선택', 'Pick a subject', '选择科目')}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {state.subjectPool.school.map((s) => {
                          const active = sheetCell?.subject === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => pick(s)}
                              className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors ${
                                active
                                  ? 'bg-sage-700 text-paper'
                                  : 'bg-sage-100 text-sage-900 hover:bg-sage-200'
                              }`}
                            >
                              {translateSubject(s, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customSubjectDraft.trim()) pick(customSubjectDraft);
                      }}
                    >
                      <input
                        type="text"
                        value={customSubjectDraft}
                        onChange={(e) => setCustomSubjectDraft(e.target.value)}
                        placeholder={tr(lang, '직접 입력 (예: 진로)', 'Type a subject (e.g. Career)', '自行输入（如：生涯规划）')}
                        className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-xs font-medium text-ink placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sage"
                      />
                      <button
                        type="submit"
                        disabled={!customSubjectDraft.trim()}
                        className="h-9 px-3 rounded-full bg-sage-700 text-paper text-xs font-bold hover:bg-sage-800 disabled:opacity-40 shrink-0"
                      >
                        {tr(lang, '적용', 'Set', '应用')}
                      </button>
                    </form>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => pick('자습')}
                        className="flex-1 h-9 rounded-full bg-slate-200 text-ink text-xs font-semibold hover:bg-slate-300"
                      >
                        {tr(lang, '자습', 'Self-Study', '自习')}
                      </button>
                      {sheetCell && (
                        <button
                          type="button"
                          onClick={() => {
                            handleClearSchoolCell(day, period);
                            setSchoolSheet(null);
                          }}
                          className="flex-1 h-9 rounded-full border border-divider text-accent-800 text-xs font-semibold inline-flex items-center justify-center gap-1 hover:bg-accent-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {tr(lang, '비우기 (이 교시 없음)', 'Clear (no class)', '清空（无此节）')}
                        </button>
                      )}
                    </div>

                    {sheetCell && !isPresetMode && (
                      <div className="space-y-1.5 pt-3 border-t border-divider">
                        <span className="block text-[0.6875rem] font-medium text-slate-600">
                          {tr(
                            lang,
                            `${day}요일만 시간 바꾸기`,
                            `Change time for ${translateDay(day, lang)} only`,
                            `仅修改${translateDay(day, lang)}的时间`
                          )}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={sheetCell.startTime}
                            aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
                            onChange={(e) =>
                              e.target.value && handleUpdateDayPeriodTime(day, period, { startTime: e.target.value })
                            }
                            className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                          />
                          <span className="text-xs text-slate-400">~</span>
                          <input
                            type="time"
                            value={sheetCell.endTime}
                            aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                            onChange={(e) =>
                              e.target.value && handleUpdateDayPeriodTime(day, period, { endTime: e.target.value })
                            }
                            className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                          />
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              (() => {
                const { period } = schoolSheet;
                const info = getRowInfo(period);
                return (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[0.8125rem] font-bold text-ink">
                          {tr(lang, `${period}교시 시간`, `Period ${period} Time`, `第${period}节时间`)}
                        </h3>
                        <p className="text-[0.6875rem] text-slate-600">
                          {tr(
                            lang,
                            `${info.entries.length}개 요일에 있는 교시`,
                            `Used on ${info.entries.length} day(s)`,
                            `${info.entries.length} 个星期有此节`
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchoolSheet(null)}
                        className="w-8 h-8 rounded-full grid place-items-center text-slate-600 hover:bg-slate-200"
                        aria-label={tr(lang, '닫기', 'Close', '关闭')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {isPresetMode ? (
                      <div className="space-y-2.5">
                        <div className="rounded-xl bg-sage-100 px-3 py-2.5 flex items-center justify-between">
                          <span className="text-xs font-bold text-sage-900">{periodLabel(period)}</span>
                          <span className="text-[0.8125rem] font-mono text-sage-900 tabular-nums">
                            {info.times.startTime}–{info.times.endTime}
                          </span>
                        </div>
                        <p className="text-[0.6875rem] text-slate-600">
                          {tr(
                            lang,
                            '프리셋 모드에서는 시간이 자동 계산됩니다. 교시마다 직접 바꾸려면 직접 입력 모드로 전환하세요.',
                            'In preset mode times are calculated automatically. Switch to custom mode to edit each period.',
                            '预设模式下时间自动计算。如需逐节修改，请切换到自定义模式。'
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => updateSchoolTimeConfig({ mode: 'custom' })}
                          className="w-full h-9 rounded-full bg-sage-700 text-paper text-xs font-bold hover:bg-sage-800"
                        >
                          {tr(lang, '교시별 직접 입력으로 전환', 'Switch to custom times', '切换为逐节自定义')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <span className="block text-[0.6875rem] font-medium text-slate-600">
                            {tr(lang, '모든 요일 한 번에', 'All days at once', '所有星期统一')}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="time"
                              value={info.times.startTime}
                              aria-label={tr(lang, '시작 시간', 'Start time', '开始时间')}
                              onChange={(e) =>
                                e.target.value && handleUpdateRowTimeAllDays(period, { startTime: e.target.value })
                              }
                              className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                            />
                            <span className="text-xs text-slate-400">~</span>
                            <input
                              type="time"
                              value={info.times.endTime}
                              aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                              onChange={(e) =>
                                e.target.value && handleUpdateRowTimeAllDays(period, { endTime: e.target.value })
                              }
                              className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[0.8125rem] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                            />
                          </div>
                          {info.mismatch && (
                            <p className="text-[0.6875rem] text-accent-800">
                              {tr(
                                lang,
                                '요일마다 시간이 달라요. 여기서 바꾸면 모든 요일이 같은 시간으로 맞춰집니다.',
                                'Times differ by day. Changing here aligns every day to the same time.',
                                '各星期时间不同。在此修改将统一所有星期的时间。'
                              )}
                            </p>
                          )}
                        </div>

                        {info.entries.length > 0 && (
                          <details className="rounded-xl bg-surface px-3 py-2" open={info.mismatch}>
                            <summary className="text-[0.6875rem] font-bold text-ink cursor-pointer">
                              {tr(lang, '요일별 시간', 'Per-day times', '按星期设置时间')}
                            </summary>
                            <div className="space-y-1.5 pt-2">
                              {info.entries.map(({ day, p }) => (
                                <div key={day} className="flex items-center gap-1.5">
                                  <span className="w-8 text-xs font-bold text-sage-800 shrink-0">
                                    {translateDay(day, lang)}
                                  </span>
                                  <input
                                    type="time"
                                    value={p.startTime}
                                    aria-label={tr(lang, `${day}요일 시작 시간`, `${translateDay(day, lang)} start`, `${translateDay(day, lang)}开始时间`)}
                                    onChange={(e) =>
                                      e.target.value && handleUpdateDayPeriodTime(day, period, { startTime: e.target.value })
                                    }
                                    className="flex-1 min-w-0 h-8 px-2 rounded-full bg-paper text-xs font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                                  />
                                  <span className="text-xs text-slate-400">~</span>
                                  <input
                                    type="time"
                                    value={p.endTime}
                                    aria-label={tr(lang, `${day}요일 종료 시간`, `${translateDay(day, lang)} end`, `${translateDay(day, lang)}结束时间`)}
                                    onChange={(e) =>
                                      e.target.value && handleUpdateDayPeriodTime(day, period, { endTime: e.target.value })
                                    }
                                    className="flex-1 min-w-0 h-8 px-2 rounded-full bg-paper text-xs font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                                  />
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {masterFeedback && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-32px)] max-w-[420px] px-4 py-2.5 rounded-2xl bg-ink text-paper text-xs font-semibold shadow-lg"
        >
          {masterFeedback}
        </div>
      )}

      {/* ===== GROUP: 데이터 ===== */}
      <div className="space-y-2">
        <GroupHeader label={tr(lang, '데이터', 'Data', '数据')} />

        <SettingsCard
          id="ai"
          open={!!openCards.ai}
          onToggle={toggleCard}
          tone="other"
          icon={ScanLine}
          title={tr(lang, 'AI 시간표 이미지 인식', 'AI Timetable Recognition', 'AI 课表图片识别')}
          summary={aiEnabled ? aiSummaryLine : tr(lang, '실험 기능 · 곧 공개 예정', 'Experimental · coming soon', '实验功能 · 即将推出')}
        >
          {!aiEnabled ? (
            <div className="p-4 space-y-4">
              <div className="rounded-xl bg-other-100 border border-other-300 p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-other-800">
                  <FlaskConical className="w-4 h-4" strokeWidth={2.75} />
                  <span className="text-[0.8125rem] font-bold">
                    {tr(lang, '실험 기능 · 곧 공개 예정', 'Experimental · Coming soon', '实验功能 · 即将推出')}
                  </span>
                </div>
                <p className="text-[0.75rem] text-other-800 leading-relaxed">
                  {tr(
                    lang,
                    '시간표 사진 한 장으로 요일·교시·과목과 학원 일정을 자동으로 채워 주는 기능이에요. 지금은 비공개 테스트 중이라 정식 출시 후에 쓸 수 있어요.',
                    'Fill in your days, periods, subjects and academy classes from a single timetable photo. It is in private testing and will open after the official release.',
                    '只需一张课表照片，即可自动填入星期、节次、科目和补习班日程。目前处于内部测试中，正式发布后即可使用。'
                  )}
                </p>
              </div>

              <ol className="space-y-2">
                {[
                  {
                    icon: Camera,
                    title: tr(lang, '사진 찍기', 'Take a photo', '拍照'),
                    body: tr(lang, '가정통신문·칠판·손글씨 시간표를 찍거나 올려요.', 'Snap or upload a printed, blackboard or handwritten timetable.', '拍摄或上传通知单、黑板或手写课表。'),
                  },
                  {
                    icon: ScanLine,
                    title: tr(lang, 'AI가 읽기', 'AI reads it', 'AI 识别'),
                    body: tr(lang, '요일·교시·과목·학원 시간을 뽑아 표로 보여 줘요.', 'It extracts days, periods, subjects and academy times into a table.', '提取星期、节次、科目和补习班时间并以表格显示。'),
                  },
                  {
                    icon: Check,
                    title: tr(lang, '확인하고 합치기', 'Review and merge', '核对并合并'),
                    body: tr(lang, '틀린 곳을 고친 뒤 기본 시간표에 합쳐요.', 'Fix anything it got wrong, then merge into your timetable.', '修改错误后合并到固定课表。'),
                  },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-paper px-3 py-2.5">
                    <span className="w-8 h-8 rounded-full bg-surface text-slate-700 grid place-items-center shrink-0">
                      <step.icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.8125rem] font-bold text-ink">
                        <span className="font-mono text-slate-500 mr-1">{i + 1}</span>
                        {step.title}
                      </span>
                      <span className="block text-[0.75rem] text-slate-600 leading-relaxed">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="grid grid-cols-1 gap-2" aria-disabled="true">
                <button
                  type="button"
                  disabled
                  className="w-full min-h-[56px] px-4 rounded-xl border-[1.5px] border-dashed border-slate-300 bg-paper/60 text-slate-500 text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  {tr(lang, '사진으로 시간표 인식 · 준비 중', 'Recognize from photo · In preparation', '照片识别课表 · 准备中')}
                </button>
              </div>
              <p className="text-[0.6875rem] text-slate-600 text-center">
                {tr(
                  lang,
                  '지금은 [학교 시간표] 표에서 칸을 눌러 직접 입력할 수 있어요.',
                  'For now, tap the cells in the [School timetable] table to enter it yourself.',
                  '目前可在【学校课表】表格中点击格子手动输入。'
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="mx-4 mt-4 rounded-xl bg-other-100 border border-other-300 px-3 py-2 flex items-center gap-1.5 text-other-800">
                <FlaskConical className="w-3.5 h-3.5 shrink-0" strokeWidth={2.75} />
                <span className="text-[0.6875rem] font-semibold">
                  {tr(
                    lang,
                    '실험 기능 · 테스트 모드로 켜져 있어요. 결과를 꼭 확인한 뒤 합쳐 주세요.',
                    'Experimental · enabled in test mode. Please review results before merging.',
                    '实验功能 · 已在测试模式下开启。合并前请仔细核对结果。'
                  )}
                </span>
              </div>
          <div className="p-4 space-y-4">
            <p className="text-[0.6875rem] text-slate-600 leading-relaxed">
              {tr(
                lang,
                '가정통신문·칠판·손글씨 시간표 사진을 AI가 분석해요. 결과를 표에서 확인·수정한 뒤 기본 시간표에 합칠 수 있어요.',
                'AI reads photos of printed, blackboard or handwritten timetables. Review and edit the result, then merge it into your timetable.',
                'AI 会分析通知单、黑板或手写课表照片。可在表格中核对修改后合并到固定课表。'
              )}
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => imageInputRef.current?.click()}
                className="w-full min-h-[64px] px-4 py-5 rounded-xl border-[1.5px] border-dashed border-other-400 bg-other-100 text-other-800 text-xs font-bold flex items-center justify-center gap-2 hover:bg-other-200 disabled:opacity-60 active:scale-98 transition-all"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tr(
                      lang,
                      'Gemini AI가 시간표 이미지를 정밀 분석 중입니다...',
                      'Gemini AI is analyzing your timetable image...',
                      'Gemini AI 正在精准解析课表图片...'
                    )}
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    {tr(
                      lang,
                      '카메라로 시간표 촬영 또는 이미지 업로드',
                      'Take Photo or Upload Timetable Image',
                      '拍摄课表照片或上传图片'
                    )}
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={handleRunSampleImageDemo}
                className="w-full min-h-[40px] px-3 py-2 rounded-full bg-transparent text-ink border border-divider text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100 disabled:opacity-60"
              >
                <Upload className="w-3.5 h-3.5" />
                {tr(
                  lang,
                  '샘플 가정통신문 시간표 이미지로 AI 인식 즉시 체험하기',
                  'Try Instant Demo with Sample Timetable Image',
                  '使用示例课表图片立即体验 AI 自动识别'
                )}
              </button>
            </div>

            {uploadedPreviewUrl && (
              <div className="rounded-xl overflow-hidden bg-paper p-2">
                <img
                  src={uploadedPreviewUrl}
                  alt={tr(lang, '업로드한 시간표 미리보기', 'Uploaded timetable preview', '已上传的课表预览')}
                  referrerPolicy="no-referrer"
                  className="max-h-44 mx-auto object-contain rounded-lg"
                />
              </div>
            )}

            {aiError && (
              <div className="p-3.5 rounded-xl bg-accent-100 border border-accent-300 flex items-start gap-2 text-xs text-accent-900">
                <AlertCircle className="w-4 h-4 text-accent-800 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}

            {aiMergeSuccess && (
              <div className="p-3.5 rounded-xl bg-sage-100 border border-sage-300 flex items-start gap-2 text-xs font-bold text-sage-900">
                <CheckCircle2 className="w-4 h-4 text-sage-700 shrink-0 mt-0.5" />
                <span>{aiMergeSuccess}</span>
              </div>
            )}

            {aiPreviewEntries.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-divider">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-ink">
                      {tr(
                        lang,
                        `AI 추출 결과 검수 표 (${aiPreviewEntries.length}건)`,
                        `Editable AI Preview Table (${aiPreviewEntries.length} items)`,
                        `AI 识别结果核对表 (${aiPreviewEntries.length}条)`
                      )}
                    </h3>
                    {aiSummary && (
                      <p className="text-[0.6875rem] text-slate-600 mt-0.5">{aiSummary}</p>
                    )}
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto border border-divider rounded-xl divide-y divide-divider">
                  {aiPreviewEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2.5 bg-paper flex items-center gap-1.5 flex-wrap text-xs"
                    >
                      <select
                        value={entry.day}
                        onChange={(e) =>
                          handleUpdatePreviewEntry(entry.id, {
                            day: e.target.value as DayOfWeek,
                          })
                        }
                        className="h-8 px-2 rounded-full border border-divider bg-surface font-bold text-ink"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d}>
                            {translateDay(d, lang)}
                          </option>
                        ))}
                      </select>

                      <select
                        value={entry.type}
                        onChange={(e) =>
                          handleUpdatePreviewEntry(entry.id, {
                            type: e.target.value as 'school' | 'academy',
                            period: e.target.value === 'academy' ? 0 : 1,
                          })
                        }
                        className={`h-8 px-2.5 rounded-full border font-bold ${
                          entry.type === 'school'
                            ? 'bg-sage-100 border-sage-300 text-sage-800'
                            : 'bg-accent-100 border-accent-300 text-accent-800'
                        }`}
                      >
                        <option value="school">{tr(lang, '학교', 'School', '学校')}</option>
                        <option value="academy">{tr(lang, '학원', 'Academy', '补习班')}</option>
                      </select>

                      {entry.type === 'school' && (
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={entry.period}
                          onChange={(e) =>
                            handleUpdatePreviewEntry(entry.id, {
                              period: Number(e.target.value) || 1,
                            })
                          }
                          className="w-12 h-8 px-1.5 rounded-full border border-divider bg-surface text-center font-mono"
                          title={tr(lang, '교시', 'Period', '节次')}
                          aria-label={tr(lang, '교시', 'Period', '节次')}
                        />
                      )}

                      <input
                        type="time"
                        value={entry.startTime}
                        onChange={(e) =>
                          handleUpdatePreviewEntry(entry.id, {
                            startTime: e.target.value,
                          })
                        }
                        className="w-22 h-8 px-1.5 rounded-full border border-divider bg-surface font-mono"
                      />
                      <span className="text-slate-400">~</span>
                      <input
                        type="time"
                        value={entry.endTime}
                        onChange={(e) =>
                          handleUpdatePreviewEntry(entry.id, {
                            endTime: e.target.value,
                          })
                        }
                        className="w-22 h-8 px-1.5 rounded-full border border-divider bg-surface font-mono"
                      />

                      <input
                        type="text"
                        value={entry.subject}
                        onChange={(e) =>
                          handleUpdatePreviewEntry(entry.id, {
                            subject: e.target.value,
                          })
                        }
                        className="flex-1 min-w-[90px] h-8 px-2.5 rounded-full border border-divider bg-surface font-bold text-ink focus:outline-none focus:border-accent"
                      />

                      <button
                        type="button"
                        onClick={() => handleDeletePreviewEntry(entry.id)}
                        className="p-1 text-slate-600 hover:text-accent-800"
                        aria-label={tr(lang, '삭제', 'Delete', '删除')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleMergeAiPreviewToMaster}
                  className="w-full min-h-[40px] py-2 px-4 rounded-full bg-accent-700 text-paper text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-accent-800"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {tr(
                    lang,
                    '검수 완료 · 기존 시간표에 병합하기',
                    'Confirm & Merge into Master Timetable',
                    '核对完成 · 合并到现有课表'
                  )}
                </button>
              </div>
            )}
          </div>
            </>
          )}
        </SettingsCard>

        <SettingsCard
          id="backup"
          open={!!openCards.backup}
          onToggle={toggleCard}
          tone="neutral"
          icon={DatabaseBackup}
          title={tr(lang, '백업 · 복원', 'Backup & Restore', '备份与恢复')}
          summary={backupSummary}
        >
          <div className="p-4 space-y-4">
            <p className="text-[0.6875rem] text-slate-600 leading-relaxed">
              {tr(
                lang,
                '플래너 전체를 JSON 파일로 보관해요. 불러올 때는 원하는 항목만 골라 적용할 수 있고, 친구·가족이 보낸 파일도 쓸 수 있어요.',
                'Keep the whole planner as a JSON file. When importing, pick just the parts you want — files from friends or family work too.',
                '将整个规划器保存为 JSON 文件。导入时可只选择需要的内容，也可以使用朋友或家人发来的文件。'
              )}
            </p>
            <div className="px-3.5 py-2.5 rounded-xl bg-paper flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
              <span className="text-[0.75rem] font-semibold text-slate-600 whitespace-nowrap">
                {tr(lang, '마지막 백업', 'Last backup', '上次备份')}
              </span>
              <span className="text-[0.8125rem] font-mono text-ink tabular-nums whitespace-nowrap">
                {state.backupMeta.lastBackupDate ||
                  tr(lang, '백업 기록 없음', 'Never backed up', '暂无备份记录')}
              </span>
            </div>

            {backupFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                  backupFeedback.type === 'success'
                    ? 'bg-sage-100 border-sage-300 text-sage-900'
                    : 'bg-accent-100 border-accent-300 text-accent-900'
                }`}
              >
                {backupFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-sage-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-accent-800 shrink-0 mt-0.5" />
                )}
                <span>{backupFeedback.message}</span>
              </div>
            )}

            <input
              ref={restoreFileInputRef}
              type="file"
              // In the app, files received by messenger often have no JSON type, so don't filter there
              accept={isNativeApp ? undefined : '.json,application/json'}
              onChange={handleImportBackupJson}
              className="hidden"
            />

            {/* Stacked full-width buttons so the labels stay on one line at large text sizes */}
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => void handleExportBackupJson()}
                className="min-h-[44px] px-4 py-2 rounded-full bg-accent-700 text-paper text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-accent-800"
              >
                <Download className="w-4 h-4 shrink-0" />
                {isNativeApp
                  ? tr(lang, '데이터 내보내기 (보내기·저장)', 'Export (send or save)', '导出（发送·保存）')
                  : tr(lang, '데이터 내보내기 (저장)', 'Export Backup (.json)', '导出备份文件')}
              </button>

              <button
                type="button"
                onClick={() => restoreFileInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-full bg-transparent text-ink border border-divider text-[0.8125rem] font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-slate-100"
              >
                <FileUp className="w-4 h-4 shrink-0" />
                {tr(lang, '데이터 불러오기 (복원)', 'Import Backup (.json)', '导入恢复数据')}
              </button>
            </div>
            {isNativeApp && (
              <p className="text-[0.6875rem] text-slate-600 leading-snug">
                {tr(
                  lang,
                  '「보내기·저장」을 누르면 공유 창이 떠요. 카카오톡·메일로 바로 보내거나, 「내 파일」·드라이브를 골라 저장하세요. 받은 사람은 「데이터 불러오기」로 그 파일을 열면 돼요.',
                  'Export opens the share sheet: send it via a messenger or email, or pick Files / Drive to save it. The other person opens it with “Import”.',
                  '点「导出」会打开分享窗口：可直接通过聊天软件或邮件发送，或选择「我的文件」/云端硬盘保存。对方用「导入」打开即可。'
                )}
              </p>
            )}

          </div>
        </SettingsCard>
      </div>

      {/* ===== GROUP: 앱 ===== */}
      <div className="space-y-2">
        <GroupHeader label={tr(lang, '앱', 'App', '应用')} />

        <SettingsCard
          id="reminders"
          open={!!openCards.reminders}
          onToggle={toggleCard}
          tone="accent"
          icon={BellRing}
          title={tr(lang, '보강 알림', 'Makeup reminders', '补课提醒')}
          summary={
            reminders.enabled
              ? tr(lang, `켜짐 · ${reminderLeadLabel(reminders.leadMinutes, lang)}`, `On · ${reminderLeadLabel(reminders.leadMinutes, lang)}`, `已开启 · ${reminderLeadLabel(reminders.leadMinutes, lang)}`)
              : tr(lang, '꺼짐 · 보강·특강 전에 휴대폰 알림', 'Off · a phone alert before each makeup', '已关闭 · 补课前手机提醒')
          }
        >
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[0.875rem] font-bold text-ink">{tr(lang, '보강·특강 알림 받기', 'Remind me of makeups', '接收补课提醒')}</div>
                <div className="text-[0.6875rem] text-slate-600 leading-snug">
                  {tr(
                    lang,
                    '시간표에 등록한 보강·특강 시작 전에 휴대폰으로 알려줘요',
                    'A phone notification before each makeup/special class you add',
                    '在已登记的补课/特讲开始前发送手机通知'
                  )}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reminders.enabled}
                aria-label={tr(lang, '보강 알림', 'Makeup reminders', '补课提醒')}
                onClick={() => void toggleReminders()}
                className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${reminders.enabled ? 'bg-accent-700' : 'bg-slate-300'}`}
              >
                <span className={`block w-6 h-6 rounded-full bg-paper shadow-xs transition-transform ${reminders.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {reminderDenied && (
              <p role="alert" className="rounded-xl bg-accent-100 border border-accent-300 px-3 py-2 text-[0.75rem] font-semibold text-accent-900 leading-snug">
                {tr(
                  lang,
                  '알림 권한이 꺼져 있어요. 휴대폰 설정 → 애플리케이션 → 틈틈 → 알림에서 허용한 뒤 다시 켜 주세요.',
                  'Notifications are blocked. Allow them in phone Settings → Apps → TeumTeum → Notifications, then try again.',
                  '通知权限已关闭。请在手机设置 → 应用 → TeumTeum → 通知中允许后再开启。'
                )}
              </p>
            )}

            <div className={`space-y-1.5 ${reminders.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
              <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '언제 알려줄까요?', 'When?', '何时提醒？')}</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr(lang, '알림 시간', 'Reminder time', '提醒时间')}>
                {REMINDER_LEADS.map((lead) => (
                  <button
                    key={lead}
                    type="button"
                    role="radio"
                    aria-checked={reminders.leadMinutes === lead}
                    onClick={() => setReminders({ leadMinutes: lead })}
                    className={`h-9 px-3.5 rounded-full text-[0.8125rem] font-bold ${
                      reminders.leadMinutes === lead ? 'bg-accent-700 text-paper' : 'bg-paper text-ink hover:bg-slate-100'
                    }`}
                  >
                    {reminderLeadLabel(lead, lang)}
                  </button>
                ))}
              </div>
            </div>

            {reminders.enabled && (() => {
              const next = planMakeupReminders(state).slice(0, 3);
              return (
                <div className="rounded-2xl bg-paper p-3 space-y-1.5">
                  <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '다가오는 알림', 'Coming up', '即将提醒')}</span>
                  {next.length === 0 ? (
                    <p className="text-[0.75rem] text-slate-600">
                      {tr(lang, '예정된 보강·특강이 없어요. 시간표에서 「보강/특강 추가」로 등록해 보세요.', 'No upcoming makeups. Add one with “Add makeup” on the timetable.', '暂无补课安排。可在课表中用「添加补课/特讲」登记。')}
                    </p>
                  ) : (
                    next.map((r) => (
                      <div key={r.id} className="flex items-start gap-2">
                        <Bell className="w-3.5 h-3.5 text-accent-700 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[0.75rem] font-bold text-ink truncate">{r.title}</div>
                          <div className="text-[0.6875rem] text-slate-600 truncate">
                            {tr(lang, '알림', 'Alert', '提醒')} {formatDateKey(r.at).slice(5).replace('-', '/')}{' '}
                            {String(r.at.getHours()).padStart(2, '0')}:{String(r.at.getMinutes()).padStart(2, '0')} · {r.body}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })()}

            <p className="text-[0.6875rem] text-slate-600 leading-snug">
              {isNativeApp
                ? tr(
                    lang,
                    '보강을 추가·수정·취소하면 알림도 바로 바뀌어요. 자녀가 여럿이면 모든 자녀의 보강을 알려줘요. 배터리 절약 상태에서는 몇 분 늦게 올 수 있어요.',
                    'Reminders update as soon as you add, change or cancel a makeup, for every child. Battery saving may delay them by a few minutes.',
                    '新增、修改或取消补课后提醒会立即更新，所有孩子的补课都会提醒。省电模式下可能延迟几分钟。'
                  )
                : tr(lang, '알림은 안드로이드 앱에서 와요. 웹 미리보기에서는 설정만 저장돼요.', 'Reminders arrive in the Android app; the web preview only saves the setting.', '提醒仅在安卓应用中发送，网页预览只保存设置。')}
            </p>
          </div>
        </SettingsCard>

        <SettingsCard
          id="widgets"
          open={!!openCards.widgets}
          onToggle={toggleCard}
          tone="other"
          icon={Smartphone}
          title={tr(lang, '홈 화면 위젯', 'Home Screen Widgets', '主屏幕小组件')}
          summary={
            !isNativeApp
              ? tr(
                  lang,
                  `안드로이드 앱에서 사용 · 미리보기 ${HOME_WIDGET_IDS.length}종`,
                  `In the Android app · ${HOME_WIDGET_IDS.length} previews`,
                  `安卓应用中可用 · ${HOME_WIDGET_IDS.length} 种预览`
                )
              : placedTotal > 0
              ? tr(
                  lang,
                  `홈 화면에 ${placedTotal}개 · 총 ${HOME_WIDGET_IDS.length}종`,
                  `${placedTotal} on home screen · ${HOME_WIDGET_IDS.length} kinds`,
                  `主屏幕上 ${placedTotal} 个 · 共 ${HOME_WIDGET_IDS.length} 种`
                )
              : tr(
                  lang,
                  `위젯 ${HOME_WIDGET_IDS.length}종 · 홈 화면에 추가해 보세요`,
                  `${HOME_WIDGET_IDS.length} widgets · add one to your home screen`,
                  `${HOME_WIDGET_IDS.length} 种小组件 · 添加到主屏幕吧`
                )
          }
        >
          <div className="p-4 space-y-3">
            <p className="rounded-2xl bg-other-100 text-other-800 px-3.5 py-3 text-[0.75rem] font-semibold leading-snug">
              {isNativeApp
                ? tr(
                    lang,
                    '원하는 위젯을 홈 화면에 추가하세요. 위젯 테마(밝게/어둡게)와 글자 크기도 여기서 바꿀 수 있어요.',
                    'Add the widgets you like to your home screen. You can also change their theme and text size here.',
                    '把喜欢的小组件添加到主屏幕。也可以在这里更改主题和字体大小。'
                  )
                : tr(
                    lang,
                    '홈 화면 위젯은 안드로이드 앱에서 쓸 수 있어요. 여기서는 모양을 미리 볼 수 있어요.',
                    'Home-screen widgets work in the Android app. Here you can preview them.',
                    '主屏幕小组件需在安卓应用中使用，这里可以先预览样式。'
                  )}
            </p>

            <button
              type="button"
              onClick={() => {
                setPinMessage(null);
                refreshPlacedWidgets();
                setIsWidgetSheetOpen(true);
              }}
              className="w-full h-12 rounded-full bg-accent-700 text-paper text-[0.875rem] font-bold inline-flex items-center justify-center gap-2 hover:bg-accent-800 shadow-xs"
            >
              <Smartphone className="w-4 h-4" strokeWidth={2.75} />
              {isNativeApp
                ? tr(lang, '위젯 보기 · 추가하기', 'Browse & add widgets', '浏览并添加小组件')
                : tr(lang, '위젯 미리보기', 'Preview widgets', '预览小组件')}
            </button>

            <SectionResetButton lang={lang} label={sectionResetLabel} onConfirm={handleResetWidgets} />
          </div>
        </SettingsCard>

        <SettingsCard
          id="updates"
          open={!!openCards.updates}
          onToggle={toggleCard}
          tone="neutral"
          icon={History}
          title={tr(lang, '업데이트 이력', 'Update history', '更新记录')}
          summary={tr(lang, `지금 버전 ${APP_VERSION}`, `Current version ${APP_VERSION}`, `当前版本 ${APP_VERSION}`)}
        >
          <div className="p-4 space-y-2">
            {CHANGELOG.map((entry, i) => {
              const open = openVersion === null ? i === 0 : openVersion === entry.version;
              return (
                <div key={entry.version} className="rounded-2xl bg-paper overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenVersion(open ? '' : entry.version)}
                    aria-expanded={open}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2 text-left hover:bg-slate-100"
                  >
                    <span className="font-mono text-[0.875rem] font-bold text-ink tabular-nums">v{entry.version}</span>
                    {i === 0 && (
                      <span className="px-1.5 py-px rounded-full bg-accent-700 text-paper text-[0.625rem] font-bold">
                        {tr(lang, '최신', 'Latest', '最新')}
                      </span>
                    )}
                    <span className="flex-1" />
                    <span className="text-[0.6875rem] text-slate-600 tabular-nums">{entry.date.replace(/-/g, '.')}</span>
                    {open ? (
                      <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                  </button>
                  {open && (
                    <ul className="px-3.5 pb-3 space-y-1.5">
                      {entry.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-[0.75rem] text-slate-700 leading-[1.5] break-keep">
                          <span className="w-1.5 h-1.5 mt-[0.45rem] rounded-full bg-accent shrink-0" aria-hidden="true" />
                          <span>{tr(lang, item.ko, item.en, item.zh)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard
          id="feedback"
          open={!!openCards.feedback}
          onToggle={toggleCard}
          tone="accent"
          icon={MessageSquareText}
          title={tr(lang, '의견 보내기', 'Send feedback', '发送意见')}
          summary={tr(lang, '불편한 점 · 바라는 기능 알려 주기', 'Problems or ideas', '不便之处或希望的功能')}
        >
          <FeedbackPanel lang={lang} />
        </SettingsCard>
      </div>

      {importDraft && (
        <ImportSheet
          lang={lang}
          fileName={importDraft.fileName}
          parsed={importDraft.parsed}
          state={state}
          onUpdateState={onUpdateState}
          onClose={() => setImportDraft(null)}
          onDone={(message) => {
            setImportDraft(null);
            setBackupFeedback({ type: 'success', message });
          }}
        />
      )}

      {isGuideOpen && (
        <GuideSheet
          lang={lang}
          onClose={() => setIsGuideOpen(false)}
          onGo={(target) => {
            setIsGuideOpen(false);
            if (target === 'top') {
              document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              openCardAndScroll(target);
            }
          }}
        />
      )}

      {/* 앱 초기화 시트 */}
      {isResetSheetOpen && (() => {
        const filledSchool = DAYS_OF_WEEK.reduce(
          (n, d) => n + (state.masterTimetable[d]?.school || []).filter((p) => p.subject.trim()).length,
          0
        );
        const academyCount = DAYS_OF_WEEK.reduce((n, d) => n + (state.masterTimetable[d]?.academy || []).length, 0);
        const memoCount = Object.values(state.memos).filter((m) => m.content.trim()).length;
        const parts: Record<ResetPart, { icon: LucideIcon; tone: string; label: string; detail: string }> = {
          school: {
            icon: GraduationCap,
            tone: 'bg-sage-700',
            label: tr(lang, '학교 시간표', 'School timetable', '学校课表'),
            detail: tr(lang, `과목 ${filledSchool}칸 · 날짜별 변경 포함`, `${filledSchool} periods · incl. daily changes`, `${filledSchool} 节 · 含每日变更`),
          },
          academy: {
            icon: Building2,
            tone: 'bg-accent-700',
            label: tr(lang, '학원 시간표', 'Academy timetable', '补习班课表'),
            detail: tr(lang, `수업 ${academyCount}개 · 보강·휴강 포함`, `${academyCount} classes · incl. makeups`, `${academyCount} 节课 · 含补课停课`),
          },
          schedules: {
            icon: CalendarDays,
            tone: 'bg-other-600',
            label: tr(lang, '일정', 'Schedule', '日程'),
            detail: tr(lang, `일정 ${state.schedules.length}개`, `${state.schedules.length} events`, `${state.schedules.length} 个日程`),
          },
          attendance: {
            icon: CheckCircle2,
            tone: 'bg-sage-600',
            label: tr(lang, '출석 기록', 'Attendance', '出勤记录'),
            detail: tr(
              lang,
              `${Object.keys(state.attendance).length}일 기록 · 보강 목록 포함`,
              `${Object.keys(state.attendance).length} days · incl. makeups`,
              `${Object.keys(state.attendance).length} 天记录 · 含补课`
            ),
          },
          memos: {
            icon: StickyNote,
            tone: 'bg-accent-600',
            label: tr(lang, '메모', 'Memos', '备忘录'),
            detail: tr(lang, `메모 ${memoCount}개`, `${memoCount} memos`, `${memoCount} 条备忘`),
          },
          profile: {
            icon: IdCard,
            tone: 'bg-sage-800',
            label: tr(lang, '내 정보', 'My profile', '我的信息'),
            detail: profile.name.trim() || tr(lang, '이름·학교·학년', 'Name, school, grade', '姓名、学校、年级'),
          },
          settings: {
            icon: Settings2,
            tone: 'bg-slate-600',
            label: tr(lang, '앱 설정', 'App settings', '应用设置'),
            detail: tr(
              lang,
              '과목 후보·수업 시간·표시 범위·글자 크기·위젯 (언어는 유지)',
              'Subjects, class times, range, text size, widgets (language kept)',
              '候选科目、上课时间、显示范围、字体、小组件（保留语言）'
            ),
          },
        };
        const allOn = resetParts.length === RESET_PARTS.length;
        const togglePart = (part: ResetPart) => {
          setResetConfirming(false);
          setResetParts((prev) => (prev.includes(part) ? prev.filter((x) => x !== part) : [...prev, part]));
        };
        const applyReset = () => {
          onUpdateState((prev) => resetPlannerParts(prev, resetParts, resetMode));
          if (resetParts.includes('profile')) setLastGradeChip(null);
          setIsResetSheetOpen(false);
          showMasterToast(
            resetMode === 'sample'
              ? tr(lang, `${resetParts.length}개 항목을 예시 데이터로 되돌렸어요`, `${resetParts.length} item(s) restored to sample data`, `已将 ${resetParts.length} 项恢复为示例数据`)
              : tr(lang, `${resetParts.length}개 항목을 초기화했어요`, `${resetParts.length} item(s) cleared`, `已清除 ${resetParts.length} 项`)
          );
        };
        return (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
            onClick={() => setIsResetSheetOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={tr(lang, '앱 초기화', 'Reset app', '重置应用')}
          >
            <div
              className="w-full max-w-md max-h-[92vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 pt-2.5 pb-3 border-b border-divider space-y-2.5 shrink-0">
                <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[1rem] font-bold text-ink">{tr(lang, '앱 초기화', 'Reset app', '重置应用')}</h3>
                    <p className="text-[0.6875rem] text-slate-600">
                      {tr(lang, '지울 항목을 고르세요. 되돌릴 수 없어요.', 'Pick what to clear. This cannot be undone.', '请选择要清除的内容，无法撤销。')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResetSheetOpen(false)}
                    aria-label={tr(lang, '닫기', 'Close', '关闭')}
                    className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirming(false);
                    setResetParts(allOn ? [] : [...RESET_PARTS]);
                  }}
                  className="h-8 px-3 rounded-full border border-divider bg-paper text-[0.75rem] font-bold text-ink inline-flex items-center gap-1.5 hover:bg-slate-100"
                >
                  <Check strokeWidth={3} className="w-3.5 h-3.5" />
                  {allOn ? tr(lang, '모두 해제', 'Clear selection', '全部取消') : tr(lang, '모두 선택', 'Select all', '全选')}
                </button>

                {RESET_PARTS.map((part) => {
                  const meta = parts[part];
                  const Icon = meta.icon;
                  const on = resetParts.includes(part);
                  return (
                    <button
                      key={part}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => togglePart(part)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                        on ? 'bg-accent-100 ring-2 ring-accent-600' : 'bg-surface hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 text-paper ${meta.tone}`}>
                        <Icon strokeWidth={2.5} className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[0.875rem] font-bold text-ink">{meta.label}</span>
                        <span className="block text-[0.6875rem] text-slate-600 truncate">{meta.detail}</span>
                      </span>
                      <span
                        className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 border-2 ${
                          on ? 'bg-accent-700 border-accent-700 text-paper' : 'border-slate-400 bg-paper'
                        }`}
                      >
                        {on && <Check strokeWidth={3.5} className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}

                <div className="pt-2 space-y-1.5">
                  <span className="text-[0.75rem] font-bold text-ink">{tr(lang, '초기화 방식', 'How to reset', '重置方式')}</span>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-surface" role="radiogroup">
                    {(
                      [
                        ['empty', tr(lang, '빈 상태로', 'Empty', '清空'), tr(lang, '내용을 모두 지워요', 'Remove everything', '全部删除')],
                        ['sample', tr(lang, '예시 데이터로', 'Sample data', '示例数据'), tr(lang, '처음 예시로 되돌려요', 'Back to the examples', '恢复为示例')],
                      ] as Array<[ResetMode, string, string]>
                    ).map(([mode, label, hint]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={resetMode === mode}
                        onClick={() => {
                          setResetConfirming(false);
                          setResetMode(mode);
                        }}
                        className={`rounded-xl px-2 py-2 text-center transition-colors ${
                          resetMode === mode ? 'bg-accent-700 text-paper' : 'text-ink hover:bg-slate-100'
                        }`}
                      >
                        <span className="block text-[0.8125rem] font-bold">{label}</span>
                        <span className={`block text-[0.625rem] ${resetMode === mode ? 'text-paper/80' : 'text-slate-600'}`}>{hint}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-slate-600 leading-snug">
                    {tr(
                      lang,
                      '지우기 전에 「데이터 → 백업 · 복원」에서 내보내 두면 나중에 되살릴 수 있어요.',
                      'Export a backup first (Data → Backup & Restore) if you may want it back.',
                      '清除前可在「数据 → 备份与恢复」中导出，以便日后恢复。'
                    )}
                  </p>
                </div>
              </div>

              <div className="px-4 pt-3 pb-5 border-t border-divider shrink-0 space-y-2">
                {resetConfirming && (
                  <p role="alert" className="rounded-xl bg-accent-100 border border-accent-300 px-3 py-2 text-[0.75rem] font-semibold text-accent-900 leading-snug">
                    {tr(
                      lang,
                      `선택한 ${resetParts.length}개 항목을 정말 ${resetMode === 'sample' ? '예시 데이터로 되돌릴까요' : '지울까요'}? 되돌릴 수 없어요.`,
                      `Really ${resetMode === 'sample' ? 'restore sample data for' : 'clear'} ${resetParts.length} item(s)? This cannot be undone.`,
                      `确定要${resetMode === 'sample' ? '将所选 ' + resetParts.length + ' 项恢复为示例数据' : '清除所选 ' + resetParts.length + ' 项'}吗？无法撤销。`
                    )}
                  </p>
                )}
                <button
                  type="button"
                  disabled={resetParts.length === 0}
                  onClick={() => (resetConfirming ? applyReset() : setResetConfirming(true))}
                  className="w-full h-12 rounded-full bg-accent-800 text-paper text-[0.875rem] font-bold inline-flex items-center justify-center gap-2 hover:bg-accent-900 disabled:opacity-40"
                >
                  <RotateCcw strokeWidth={2.5} className="w-4 h-4" />
                  {resetParts.length === 0
                    ? tr(lang, '초기화할 항목을 고르세요', 'Pick something to reset', '请选择要重置的内容')
                    : resetConfirming
                    ? tr(lang, '네, 초기화할게요', 'Yes, reset', '确认重置')
                    : tr(lang, `선택한 ${resetParts.length}개 초기화`, `Reset ${resetParts.length} item(s)`, `重置所选 ${resetParts.length} 项`)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 위젯 시트: 테마·글자 크기 + 위젯별 미리보기와 "홈 화면에 추가" */}
      {isWidgetSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
          onClick={() => setIsWidgetSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={tr(lang, '홈 화면 위젯', 'Home screen widgets', '主屏幕小组件')}
        >
          <div
            className="w-full max-w-md max-h-[92vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-2.5 pb-3 border-b border-divider space-y-2.5 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[1rem] font-bold text-ink">
                    {tr(lang, '홈 화면 위젯', 'Home screen widgets', '主屏幕小组件')}
                  </h3>
                  <p className="text-[0.6875rem] text-slate-600">
                    {isNativeApp
                      ? tr(
                          lang,
                          '테마와 글자 크기는 모든 위젯에 함께 적용돼요',
                          'Theme and text size apply to every widget',
                          '主题和字体大小会应用到所有小组件'
                        )
                      : tr(lang, '안드로이드 앱에서 추가할 수 있어요', 'Add them in the Android app', '可在安卓应用中添加')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWidgetSheetOpen(false)}
                  aria-label={tr(lang, '닫기', 'Close', '关闭')}
                  className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 위젯 테마 */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-semibold text-slate-600">
                  {tr(lang, '위젯 테마', 'Widget theme', '小组件主题')}
                </span>
                <div
                  className="inline-flex rounded-full border border-divider overflow-hidden shrink-0"
                  role="group"
                  aria-label={tr(lang, '위젯 테마', 'Widget theme', '小组件主题')}
                >
                  {(['light', 'dark'] as const).map((th) => (
                    <button
                      key={th}
                      type="button"
                      aria-pressed={widgetTheme === th}
                      onClick={() => updateWidgetConfig({ theme: th })}
                      className={`h-[30px] px-2.5 text-[0.6875rem] font-semibold flex items-center gap-1 transition-colors ${
                        widgetTheme === th ? 'bg-accent-700 text-paper' : 'text-ink hover:bg-slate-100'
                      }`}
                    >
                      {th === 'light' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                      {th === 'light' ? tr(lang, '밝은 테마', 'Light', '浅色') : tr(lang, '어두운 테마', 'Dark', '深色')}
                    </button>
                  ))}
                </div>
              </div>

              {/* 위젯 글자 크기 */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-semibold text-slate-600">
                  {tr(lang, '위젯 글자 크기', 'Widget text size', '小组件字体大小')}
                </span>
                <div
                  className="inline-flex rounded-full border border-divider overflow-hidden shrink-0"
                  role="radiogroup"
                  aria-label={tr(lang, '위젯 글자 크기', 'Widget text size', '小组件字体大小')}
                >
                  {(
                    [
                      ['sm', tr(lang, '작게', 'S', '小')],
                      ['md', tr(lang, '보통', 'M', '中')],
                      ['lg', tr(lang, '크게', 'L', '大')],
                      ['xl', tr(lang, '아주 크게', 'XL', '特大')],
                    ] as Array<[WidgetFontScale, string]>
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={widgetFontScale === key}
                      onClick={() => updateWidgetConfig({ fontScale: key })}
                      className={`h-[30px] px-2.5 text-[0.6875rem] font-semibold whitespace-nowrap transition-colors ${
                        widgetFontScale === key ? 'bg-accent-700 text-paper' : 'text-ink hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {HOME_WIDGET_IDS.map((id) => {
                const meta = HOME_WIDGET_META[id];
                const placed = placedWidgets[id] ?? 0;
                return (
                  <div key={id} className={`rounded-2xl p-3 space-y-3 bg-paper/60 ${placed > 0 ? 'ring-2 ring-sage-400' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[0.8125rem] font-bold text-ink">{meta.name(lang)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-surface text-[0.6875rem] font-mono text-slate-700">
                            {meta.sizeLabel(lang)}
                          </span>
                          {placed > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 text-[0.6875rem] font-bold inline-flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {tr(lang, `홈 화면에 ${placed}개`, `${placed} on home`, `主屏幕 ${placed} 个`)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[0.6875rem] text-slate-600">{meta.description(lang)}</p>
                      </div>
                      {isNativeApp ? (
                        <button
                          type="button"
                          onClick={() => void handlePinWidget(id)}
                          className="h-8 px-3 rounded-full bg-accent-700 text-paper hover:bg-accent-800 text-[0.6875rem] font-bold shrink-0 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Plus className="w-3 h-3" />
                          {tr(lang, '홈 화면에 추가', 'Add to Home', '添加到主屏幕')}
                        </button>
                      ) : (
                        <span className="h-8 px-3 rounded-full bg-other-100 text-other-800 text-[0.6875rem] font-bold shrink-0 inline-flex items-center whitespace-nowrap">
                          {tr(lang, '앱에서 가능', 'In the app', '应用内可用')}
                        </span>
                      )}
                    </div>

                    {/* 스마트폰 홈 화면 배경 프레임 + 위젯 미리보기 */}
                    <div
                      data-widget-preview={id}
                      className={`p-3 rounded-2xl transition-colors ${widgetTheme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/60'}`}
                    >
                      <HomeWidgetPreview
                        id={id}
                        data={widgetPreviewData}
                        theme={widgetTheme}
                        lang={lang}
                      />
                    </div>
                    {pinMessage?.id === id && (
                      <p aria-live="polite" className="rounded-xl bg-sage-100 text-sage-800 px-3 py-2 text-[0.75rem] font-semibold leading-snug">
                        {pinMessage.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-4 pt-3 pb-5 border-t border-divider shrink-0">
              <button
                type="button"
                onClick={() => setIsWidgetSheetOpen(false)}
                className="w-full h-12 rounded-full bg-ink text-paper text-[0.875rem] font-bold hover:bg-slate-800"
              >
                {tr(lang, '닫기', 'Close', '关闭')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
