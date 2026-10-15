import React, { useState, useRef } from 'react';
import {
  Plus,
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
  Loader2,
  RotateCcw,
  Clock,
  Globe,
  BookOpen,
  Sparkles,
  Check,
  Smartphone,
  Sun,
  Moon,
  Minus,
  GraduationCap,
  Building2,
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
  MasterTimetable,
} from '../types';
import { formatDateKey, generatePeriodSchedule } from '../data/initialData';
import {
  tr,
  translateDay,
  translateSubject,
  translateSampleText,
  USER_GUIDE_TOPICS,
} from '../i18n/translations';
import { buildWidgetSyncPayload, syncWidgetData } from '../utils/widgetSync';

interface SettingsTabProps {
  state: PlannerState;
  onUpdateState: (updater: (prev: PlannerState) => PlannerState) => void;
  onResetSampleData: () => void;
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
    <span className="flex-1 min-w-0 text-center font-mono text-[13px] text-ink tabular-nums">
      {value}
      {suffix && <span className="ml-0.5 font-sans text-[10px] font-semibold text-slate-500">{suffix}</span>}
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

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLocalizedDate(dateKey: string, day: DayOfWeek | string, lang: AppLanguage): string {
  const [, mm, dd] = (dateKey || '').split('-').map((v) => Number(v));
  const dayLabel = translateDay(day, lang);
  if (!mm || !dd) return `${dateKey} (${dayLabel})`;
  return tr(
    lang,
    `${mm}월 ${dd}일 (${dayLabel})`,
    `${MONTHS_EN[mm - 1]} ${dd} (${dayLabel})`,
    `${mm}月${dd}日 (${dayLabel})`
  );
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
  onResetSampleData,
}) => {
  const lang: AppLanguage = state.language || 'ko';

  // Selected interactive guide topic (default to first topic so user immediately sees step-by-step instructions)
  const [selectedGuideId, setSelectedGuideId] = useState<string>(USER_GUIDE_TOPICS[0].id);
  const [isGuideExpanded, setIsGuideExpanded] = useState<boolean>(true);

  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });

  const toggleSection = (idx: number) => {
    setOpenSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // --- SECTION 1: SUBJECT POOL STATE ---
  const [newSchoolSubject, setNewSchoolSubject] = useState('');
  const [newAcademySubject, setNewAcademySubject] = useState('');

  // --- SECTION 2: MASTER TIMETABLE & TIMELINE RANGE STATE ---
  const [selectedMasterDay, setSelectedMasterDay] = useState<DayOfWeek>('월');
  const [copySourceDay, setCopySourceDay] = useState<DayOfWeek>('월');
  const [copyTargetDay, setCopyTargetDay] = useState<DayOfWeek>('화');
  const [masterFeedback, setMasterFeedback] = useState<string | null>(null);
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

  // --- SECTION 5: HOME SCREEN WIDGET PREVIEW STATE ---
  const [widgetTheme, setWidgetTheme] = useState<'light' | 'dark'>('light');
  const [widgetSyncToast, setWidgetSyncToast] = useState<string | null>(null);
  const widgetPayload = buildWidgetSyncPayload(state);
  const activeSchoolClasses = widgetPayload.schoolTimetable.filter(
    (s) => !s.isCancelled && s.subject.trim() !== ''
  );
  const activeAcademyClasses = widgetPayload.academyTimetable.filter(
    (a) => !a.isCancelled
  );

  // --- SCHOOL CLASS-TIME CONFIG (preset vs custom) ---
  const schoolTimeConfig: SchoolTimeConfig = {
    ...DEFAULT_SCHOOL_TIME_CONFIG,
    ...(state.schoolTimeConfig || {}),
  };
  const isPresetMode = schoolTimeConfig.mode === 'preset';
  const presetPreviewRows = buildPresetPeriods(schoolTimeConfig);

  const timelineStartHour = state.timelineConfig?.startHour ?? 8;
  const timelineEndHour = state.timelineConfig?.endHour ?? 24;

  const activeGuideTopic =
    USER_GUIDE_TOPICS.find((g) => g.id === selectedGuideId) || USER_GUIDE_TOPICS[0];

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
    if (maxP === 0) return;
    const ok = window.confirm(
      tr(
        lang,
        `모든 요일에서 ${maxP}교시를 삭제할까요?`,
        `Remove period ${maxP} from every day?`,
        `要从所有星期中删除第${maxP}节吗？`
      )
    );
    if (!ok) return;
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

      const response = await fetch('/api/parse-timetable', {
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
  const handleExportBackupJson = () => {
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

    onUpdateState(() => exportState);

    const blob = new Blob([JSON.stringify(exportState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart_student_planner_backup_${ymd}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setBackupFeedback({
      type: 'success',
      message: tr(
        lang,
        `smart_student_planner_backup_${ymd}.json 파일이 저장되었습니다.`,
        `Saved backup file: smart_student_planner_backup_${ymd}.json`,
        `备份文件 smart_student_planner_backup_${ymd}.json 已保存。`
      ),
    });
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);

        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !parsed.subjectPool ||
          !Array.isArray(parsed.subjectPool.school) ||
          !Array.isArray(parsed.subjectPool.academy) ||
          !parsed.masterTimetable ||
          !Array.isArray(parsed.schedules) ||
          typeof parsed.attendance !== 'object' ||
          typeof parsed.memos !== 'object'
        ) {
          throw new Error(
            tr(
              lang,
              '유효한 스마트 플래너 백업 JSON 파일 형식이 아닙니다.',
              'Invalid Smart Planner backup JSON file format.',
              '无效的智能规划器备份 JSON 文件格式。'
            )
          );
        }

        const now = new Date();
        const timestamp = `${formatDateKey(now)} ${String(now.getHours()).padStart(
          2,
          '0'
        )}:${String(now.getMinutes()).padStart(2, '0')}`;

        onUpdateState((prev) => ({
          language: parsed.language || prev.language || 'ko',
          subjectPool: parsed.subjectPool,
          masterTimetable: parsed.masterTimetable,
          dailyOverrides: parsed.dailyOverrides || {},
          schedules: parsed.schedules,
          attendance: parsed.attendance,
          memos: parsed.memos,
          backupMeta: {
            lastBackupDate: parsed.backupMeta?.lastBackupDate || timestamp,
          },
          timelineConfig: parsed.timelineConfig || {
            startHour: 8,
            endHour: 24,
          },
          schoolTimeConfig: parsed.schoolTimeConfig || prev.schoolTimeConfig,
        }));

        setBackupFeedback({
          type: 'success',
          message: tr(
            lang,
            '백업 파일 검증이 완료되어 모든 시간표·일정·출석·메모 데이터가 100% 복원되었습니다!',
            'Backup verified! All timetable, schedule, attendance, and memo data restored 100%.',
            '备份文件验证通过，所有课表、日程、出勤及备忘数据已 100% 恢复！'
          ),
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : tr(lang, '파일을 읽는 중 오류가 발생했습니다.', 'Failed to read file.', '读取文件时出错。');
        setBackupFeedback({
          type: 'error',
          message: msg,
        });
      }
    };
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

  return (
    <div className="space-y-4">
      {/* TOP BAR 1: LANGUAGE SWITCHER (한국어 / English / 中文) */}
      <section className="bg-surface rounded-2xl px-3.5 py-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center text-accent shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-ink">
                {tr(lang, '앱 표시 언어 설정 (Language)', 'App Language Settings', '应用显示语言设置 (Language)')}
              </h2>
              <p className="text-[11px] text-slate-600">
                {tr(
                  lang,
                  '선택 즉시 앱의 모든 메뉴·과목·가이드가 해당 언어로 전환됩니다.',
                  'Instantly switches all menus, subjects, and guides to the selected language.',
                  '点击后立即将应用内所有菜单、科目及使用指南切换为所选语言。'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="inline-flex rounded-full border border-divider overflow-hidden">
          {(
            [
              { code: 'ko', label: '한국어', sub: tr(lang, '한국어', 'Korean', '韩语') },
              { code: 'en', label: 'English', sub: tr(lang, '영어', 'English', '英语') },
              { code: 'zh', label: '中文', sub: tr(lang, '중국어', 'Chinese', '中文') },
            ] as Array<{ code: AppLanguage; label: string; sub: string }>
          ).map((item) => {
            const isSelected = lang === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => handleSetLanguage(item.code)}
                className={`h-[30px] px-3 text-[11px] font-semibold transition-colors flex items-center justify-center ${
                  isSelected
                    ? 'bg-accent text-paper'
                    : 'bg-transparent text-ink hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  {isSelected && <Check className="w-3 h-3 stroke-[2.75]" />}
                  <span>{item.label}</span>
                </div>
                <span className="sr-only">
                  {item.sub}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TOP BAR 2: INTERACTIVE STEP-BY-STEP APP USER GUIDE */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsGuideExpanded((prev) => !prev)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent text-paper flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[13px] font-bold text-ink">
                  {tr(
                    lang,
                    '스마트 플래너 핵심 기능 & 단계별 사용 가이드',
                    'Interactive Feature & Step-by-Step Guide',
                    '智能规划器核心功能与分步使用指南'
                  )}
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-accent text-paper text-[9px] font-bold">
                  {tr(lang, '가이드', 'GUIDE', '指南')}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                {tr(
                  lang,
                  '원하는 주요 기능을 터치하면 구체적인 설정·사용 스텝(Step 1~3)을 안내합니다.',
                  'Select any feature below to view detailed step-by-step instructions.',
                  '点击下方任意核心功能，即可查看具体的设置与操作步骤（Step 1~3）。'
                )}
              </p>
            </div>
          </div>
          {isGuideExpanded ? (
            <ChevronUp className="w-4 h-4 text-accent-700 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-accent-700 shrink-0" />
          )}
        </button>

        {isGuideExpanded && (
          <div className="p-3.5 space-y-2.5">
            {/* 6 Major Feature Selector Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {USER_GUIDE_TOPICS.map((topic, idx) => {
                const isSelected = topic.id === selectedGuideId;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedGuideId(topic.id)}
                    className={`h-[34px] px-2 rounded-full text-center transition-colors flex items-center justify-center gap-1 min-w-0 ${
                      isSelected
                        ? 'bg-accent text-paper'
                        : 'bg-paper text-ink hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0 flex items-baseline gap-1">
                      <div
                        className={`hidden sm:block text-[10px] font-mono ${
                          isSelected ? 'text-accent-200' : 'text-accent'
                        }`}
                      >
                        0{idx + 1}
                      </div>
                      <div className="text-xs font-semibold truncate">
                        {tr(lang, topic.badge.ko, topic.badge.en, topic.badge.zh)}
                      </div>
                    </div>
                    <ChevronDown
                      className={`hidden ${
                        isSelected ? 'text-paper -rotate-90' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Selected Feature Step-by-Step Walkthrough Card */}
            <div className="p-3 rounded-xl bg-paper space-y-2.5">
              <div className="space-y-1 border-b border-divider pb-2.5">
                <span className="inline-block px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold">
                  {tr(
                    lang,
                    activeGuideTopic.badge.ko,
                    activeGuideTopic.badge.en,
                    activeGuideTopic.badge.zh
                  )}
                </span>
                <h3 className="text-xs font-bold text-ink">
                  {tr(
                    lang,
                    activeGuideTopic.title.ko,
                    activeGuideTopic.title.en,
                    activeGuideTopic.title.zh
                  )}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {tr(
                    lang,
                    activeGuideTopic.summary.ko,
                    activeGuideTopic.summary.en,
                    activeGuideTopic.summary.zh
                  )}
                </p>
              </div>

              {/* Concrete Steps */}
              <div className="space-y-1.5">
                {activeGuideTopic.steps.map((st, sIdx) => (
                  <div key={sIdx} className="flex items-start gap-2">
                    <span className="flex-none w-[18px] h-[18px] mt-px rounded-full bg-accent text-paper font-mono text-[10px] grid place-items-center">
                      {sIdx + 1}
                    </span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="text-xs font-bold text-ink">
                        {tr(lang, st.stepTitle.ko, st.stepTitle.en, st.stepTitle.zh)}
                      </div>
                      <p className="text-xs text-slate-700 leading-[1.45] break-keep">
                        {tr(lang, st.stepDesc.ko, st.stepDesc.en, st.stepDesc.zh)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tip Box */}
              <div className="px-2.5 py-2 rounded bg-sage-100 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-sage-700 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-sage-900 leading-relaxed">
                  <strong className="font-bold mr-1">{tr(lang, '팁:', 'TIP:', '提示：')}</strong>
                  {tr(
                    lang,
                    activeGuideTopic.tip.ko,
                    activeGuideTopic.tip.en,
                    activeGuideTopic.tip.zh
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 1: 과목 후보군(Subject Pool) 설정 */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(1)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                '1. 과목 후보군 (Subject Pool) 설정',
                '1. Subject & Academy Pool Setup',
                '1. 候选科目库 (Subject Pool) 设置'
              )}
            </h2>
            <p className="text-[11px] text-slate-600">
              {tr(
                lang,
                '시간표 터치 수정 시 버튼으로 나타날 학교 과목 및 학원 후보군',
                'School subjects and academies shown as quick-select buttons when editing timetables',
                '点击课表修改时作为快捷按钮显示的学校科目与补习班候选列表'
              )}
            </p>
          </div>
          {openSections[1] ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openSections[1] && (
          <div className="p-4 space-y-5">
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
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-sage-100 text-sage-800 text-[11px] font-semibold"
                  >
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
                  className="flex-1 min-w-0 h-9 px-3 rounded-full border border-divider bg-paper text-xs font-medium text-ink placeholder:text-slate-500 focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-full bg-sage text-paper text-xs font-bold inline-flex items-center gap-1 hover:bg-sage-700 shrink-0"
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
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold"
                  >
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
                  className="flex-1 min-w-0 h-9 px-3 rounded-full border border-divider bg-paper text-xs font-medium text-ink placeholder:text-slate-500 focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-full bg-accent text-paper text-xs font-bold inline-flex items-center gap-1 hover:bg-accent-600 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> {tr(lang, '추가', 'Add', '添加')}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: 시간표 표시 범위 (하루 시작·종료 시간) — neutral */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(2)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-paper text-ink flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-bold text-ink">
                {tr(lang, '2. 시간표 표시 범위', '2. Timeline Display Range', '2. 时间轴显示范围')}
              </h2>
              <p className="text-[11px] text-slate-600">
                {tr(
                  lang,
                  '일별 타임라인에 보일 하루 시작·종료 시간',
                  'Start and end hours shown on the daily timeline',
                  '每日时间轴显示的开始与结束时间'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-ink text-paper text-[11px] font-mono tabular-nums">
              {String(timelineStartHour).padStart(2, '0')}–{String(timelineEndHour).padStart(2, '0')}
            </span>
            {openSections[2] ? (
              <ChevronUp className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-600" />
            )}
          </div>
        </button>

        {openSections[2] && (
          <div className="p-4 space-y-3">
            <p className="text-[11px] text-slate-600">
              {tr(
                lang,
                '[시간표 > 일별 상세 보기]의 타임라인 표와 빈 시간 계산에 적용할 하루의 시작 시각과 종료 시각을 선택하세요.',
                'Choose the start and end hours displayed on the Daily Timeline and used for free-time calculation.',
                '选择应用于【课程表 > 每日详情】时间轴视图及空闲时间计算的每日起止时间。'
              )}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">
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
                  className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                >
                  {[5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-600">
                  {tr(lang, '하루 종료 시간', 'End Hour', '结束时间')}
                </span>
                <select
                  value={timelineEndHour}
                  onChange={(e) => handleUpdateTimelineRange(timelineStartHour, Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
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
                  className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                    timelineStartHour === p.s && timelineEndHour === p.e
                      ? 'bg-ink text-paper border-transparent'
                      : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: 학교 시간표 설정 (sage) */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(3)}
          className="w-full px-3.5 py-3 bg-sage-100 flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sage text-paper flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-bold text-sage-900">
                {tr(lang, '3. 학교 시간표 설정', '3. School Timetable Setup', '3. 学校课表设置')}
              </h2>
              <p className="text-[11px] text-sage-800">
                {tr(
                  lang,
                  '수업 시간(교시) 정하기 → 요일별 과목 표 채우기',
                  'Set class times (periods) → fill in the weekly subject table',
                  '设定上课时间（节次）→ 填写每周科目表'
                )}
              </p>
            </div>
          </div>
          {openSections[3] ? (
            <ChevronUp className="w-4 h-4 text-sage-800 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-sage-800 shrink-0" />
          )}
        </button>

        {openSections[3] && (
          <div className="p-4 space-y-5">
            {/* STEP A: class times */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sage text-paper font-mono text-[10px] grid place-items-center shrink-0">
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
                      className={`h-8 rounded-full text-[11px] font-bold transition-colors ${
                        active ? 'bg-sage text-paper' : 'text-ink hover:bg-sage-100'
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
                        className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                          schoolTimeConfig.classMinutes === q.min
                            ? 'bg-sage text-paper border-transparent'
                            : 'border-divider text-ink hover:bg-sage-100 hover:border-sage-300'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '첫 수업 시작', 'First Class Starts', '第一节开始')}
                      </span>
                      <input
                        type="time"
                        value={schoolTimeConfig.firstStart}
                        onChange={(e) => e.target.value && updateSchoolTimeConfig({ firstStart: e.target.value })}
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-sage"
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
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
                      <span className="block text-[11px] font-medium text-slate-600">
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
                      <span className="block text-[11px] font-medium text-slate-600">
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
                      <span className="block text-[11px] font-medium text-slate-600">
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
                    <span className="block text-[11px] font-medium text-slate-600">
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
                              className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border transition-colors ${
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
                      <span className="text-[11px] font-bold text-slate-600">
                        {tr(lang, '미리보기', 'Preview', '预览')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-sage-100 text-sage-900 text-[10px] font-bold">
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
                              <div className="w-10 shrink-0 text-right text-[10px] font-mono text-slate-500 tabular-nums leading-none pt-1">
                                {row.startTime}
                              </div>
                              <div className="flex-1 min-w-0 border-l-2 border-sage-300 pl-2">
                                <div
                                  style={{ height: Math.max(30, schoolTimeConfig.classMinutes * PREVIEW_PX_PER_MIN) }}
                                  className="rounded-xl bg-sage-200 text-sage-900 px-2.5 flex items-center justify-between gap-2"
                                >
                                  <span className="text-[11px] font-bold">{periodLabel(row.period)}</span>
                                  <span className="text-[11px] font-mono tabular-nums">
                                    {row.startTime}–{row.endTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {!isLast &&
                              (lunchHere ? (
                                <div className="flex gap-2">
                                  <div className="w-10 shrink-0 text-right text-[10px] font-mono text-accent-700 tabular-nums leading-none pt-1.5">
                                    {row.endTime}
                                  </div>
                                  <div className="flex-1 min-w-0 border-l-2 border-accent-300 pl-2 py-1">
                                    <div
                                      style={{ height: Math.max(28, gapMin * PREVIEW_PX_PER_MIN) }}
                                      className="rounded-xl bg-accent-100 border border-dashed border-accent-300 text-accent-800 px-2.5 flex items-center justify-between gap-2"
                                    >
                                      <span className="text-[11px] font-bold">
                                        {tr(lang, `점심 ${gapMin}분`, `Lunch ${gapMin} min`, `午休 ${gapMin} 分钟`)}
                                      </span>
                                      <span className="text-[10px] font-mono tabular-nums">
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
                                      <span className="text-[10px] text-slate-500">
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
                        <div className="w-10 shrink-0 text-right text-[10px] font-mono font-bold text-ink tabular-nums">
                          {presetEndTime}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600">
                          {tr(lang, '하교', 'School ends', '放学')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplySchoolTimePresetToAllDays}
                    className="w-full h-10 rounded-full bg-accent text-paper text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-600"
                  >
                    <Check className="w-4 h-4" />
                    {tr(lang, '모든 요일에 적용', 'Apply to All Days', '应用到所有星期')}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    {tr(
                      lang,
                      '기존 과목은 교시 순서대로 유지되며, 학교 수업이 없는 요일(예: 토·일)은 건너뜁니다.',
                      'Existing subjects are kept by period order; days without school periods (e.g. Sat/Sun) are skipped.',
                      '现有科目按节次顺序保留；没有学校课程的星期（如周六、周日）将被跳过。'
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-600 px-3 py-2 rounded-xl bg-paper">
                  {tr(
                    lang,
                    '아래 표에서 왼쪽 교시 칸을 누르면 그 교시의 시작·종료 시간을 바꿀 수 있어요. 요일마다 다르게 정할 수도 있습니다.',
                    'Tap a period label on the left of the table below to change its start/end time — for all days or a single day.',
                    '点击下方表格左侧的节次即可修改该节的开始与结束时间，也可按星期分别设置。'
                  )}
                </p>
              )}
            </div>

            {/* STEP B: weekly subject table */}
            <div className="space-y-2.5 pt-4 border-t border-divider">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sage text-paper font-mono text-[10px] grid place-items-center shrink-0">
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
                  className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${
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
              <p className="text-[11px] text-slate-600">
                {tr(
                  lang,
                  '칸을 눌러 과목을 고르세요. 빈 칸(+)을 누르면 그 요일에 해당 교시가 생깁니다.',
                  'Tap a cell to pick a subject. Tapping an empty cell (+) adds that period to the day.',
                  '点击单元格选择科目。点击空白单元格（+）会为该星期添加此节课。'
                )}
              </p>

              {schoolRows.length === 0 ? (
                <div className="rounded-xl bg-paper px-3 py-5 text-center space-y-2">
                  <p className="text-[11px] text-slate-500">
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
                    className="h-8 px-3 rounded-full bg-sage text-paper text-[11px] font-bold inline-flex items-center gap-1 hover:bg-sage-700"
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
                        <th className="w-[62px] py-2 px-1 text-[10px] font-semibold text-slate-600 border-r border-divider">
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
                                <span className="text-[11px] font-bold text-sage-800 inline-flex items-center gap-0.5">
                                  {periodLabel(periodNum)}
                                  {info.mismatch && (
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-accent-400"
                                      title={tr(lang, '요일별 시간이 다름', 'Times differ by day', '各星期时间不同')}
                                    />
                                  )}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500 tabular-nums">
                                  {info.times.startTime}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500 tabular-nums">
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
                                          : 'bg-sage-100 text-sage-900 font-semibold hover:bg-sage-200'
                                        : 'text-slate-400 hover:bg-sage-100 hover:text-sage-700'
                                    }`}
                                    aria-label={tr(
                                      lang,
                                      `${d}요일 ${periodNum}교시`,
                                      `${translateDay(d, lang)} period ${periodNum}`,
                                      `${translateDay(d, lang)}第${periodNum}节`
                                    )}
                                  >
                                    {cell ? (
                                      <span className="block truncate text-[11px]">
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
                    className="flex-1 h-8 rounded-full bg-sage-100 text-sage-900 text-[11px] font-bold inline-flex items-center justify-center gap-1 hover:bg-sage-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tr(lang, `${maxSchoolPeriod + 1}교시 추가`, `Add P${maxSchoolPeriod + 1}`, `添加第${maxSchoolPeriod + 1}节`)}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveLastSchoolRow}
                    className="flex-1 h-8 rounded-full border border-divider text-ink text-[11px] font-semibold inline-flex items-center justify-center gap-1 hover:bg-slate-100"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    {tr(lang, `${maxSchoolPeriod}교시 삭제`, `Remove P${maxSchoolPeriod}`, `删除第${maxSchoolPeriod}节`)}
                  </button>
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
              <p className="text-[10px] text-slate-500">
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
          </div>
        )}
      </section>

      {/* SECTION 4: 학원 시간표 설정 (terracotta) */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(4)}
          className="w-full px-3.5 py-3 bg-accent-100 flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-accent text-paper flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-bold text-accent-900">
                {tr(lang, '4. 학원 시간표 설정', '4. Academy Timetable Setup', '4. 补习班课表设置')}
              </h2>
              <p className="text-[11px] text-accent-800">
                {tr(
                  lang,
                  '요일마다 다니는 학원과 시간을 등록하세요',
                  'Register the academies you attend on each weekday',
                  '登记每个星期要上的补习班及时间'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-accent text-paper text-[11px] font-mono tabular-nums">
              {totalAcademyCount}
            </span>
            {openSections[4] ? (
              <ChevronUp className="w-4 h-4 text-accent-800" />
            ) : (
              <ChevronDown className="w-4 h-4 text-accent-800" />
            )}
          </div>
        </button>

        {openSections[4] && (
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
                      active ? 'bg-accent text-paper' : 'bg-paper text-ink hover:bg-accent-100'
                    }`}
                  >
                    <span className="text-xs font-bold leading-none">{translateDay(d, lang)}</span>
                    <span
                      className={`text-[10px] font-mono leading-none tabular-nums ${
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
              <p className="text-[11px] text-slate-500 py-3 text-center rounded-xl bg-paper">
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
                          className="p-1.5 text-slate-500 hover:text-accent-800 shrink-0"
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
              className="w-full h-9 rounded-full border border-dashed border-accent-300 text-accent-800 text-[11px] font-bold inline-flex items-center justify-center gap-1 hover:bg-accent-100"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr(
                lang,
                `${selectedMasterDay}요일에 학원 추가`,
                `Add academy on ${translateDay(selectedMasterDay, lang)}`,
                `在${translateDay(selectedMasterDay, lang)}添加补习班`
              )}
            </button>
          </div>
        )}
      </section>

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
                        <h3 className="text-[13px] font-bold text-ink">
                          {tr(
                            lang,
                            `${day}요일 ${period}교시`,
                            `${translateDay(day, lang)} · Period ${period}`,
                            `${translateDay(day, lang)} 第${period}节`
                          )}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-600 tabular-nums">
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
                      <span className="block text-[11px] font-medium text-slate-600">
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
                                  ? 'bg-sage text-paper'
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
                        className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-xs font-medium text-ink placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sage"
                      />
                      <button
                        type="submit"
                        disabled={!customSubjectDraft.trim()}
                        className="h-9 px-3 rounded-full bg-sage text-paper text-xs font-bold hover:bg-sage-700 disabled:opacity-40 shrink-0"
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
                        <span className="block text-[11px] font-medium text-slate-600">
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
                            className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                          />
                          <span className="text-xs text-slate-400">~</span>
                          <input
                            type="time"
                            value={sheetCell.endTime}
                            aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                            onChange={(e) =>
                              e.target.value && handleUpdateDayPeriodTime(day, period, { endTime: e.target.value })
                            }
                            className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
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
                        <h3 className="text-[13px] font-bold text-ink">
                          {tr(lang, `${period}교시 시간`, `Period ${period} Time`, `第${period}节时间`)}
                        </h3>
                        <p className="text-[11px] text-slate-600">
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
                          <span className="text-[13px] font-mono text-sage-900 tabular-nums">
                            {info.times.startTime}–{info.times.endTime}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
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
                          className="w-full h-9 rounded-full bg-sage text-paper text-xs font-bold hover:bg-sage-700"
                        >
                          {tr(lang, '교시별 직접 입력으로 전환', 'Switch to custom times', '切换为逐节自定义')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <span className="block text-[11px] font-medium text-slate-600">
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
                              className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                            />
                            <span className="text-xs text-slate-400">~</span>
                            <input
                              type="time"
                              value={info.times.endTime}
                              aria-label={tr(lang, '종료 시간', 'End time', '结束时间')}
                              onChange={(e) =>
                                e.target.value && handleUpdateRowTimeAllDays(period, { endTime: e.target.value })
                              }
                              className="flex-1 min-w-0 h-9 px-3 rounded-full bg-surface text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-sage"
                            />
                          </div>
                          {info.mismatch && (
                            <p className="text-[10px] text-accent-800">
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
                            <summary className="text-[11px] font-bold text-ink cursor-pointer">
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

      {/* SECTION 5: AI 비정형 시간표 이미지 자동 인식 */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(5)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                '5. AI 비정형 시간표 이미지 자동 인식',
                '5. AI Timetable Image Recognition',
                '5. AI 非结构化课表图片自动识别'
              )}
            </h2>
            <p className="text-[11px] text-slate-600">
              {tr(
                lang,
                '가정통신문·칠판·손글씨 시간표 사진 분석 후 미리보기 표에서 검수/병합',
                'Analyze timetable photos with Gemini AI, edit in preview table, and merge',
                '分析纸质通知单、黑板或手写课表照片，在预览表中核对后一键合并'
              )}
            </p>
          </div>
          {openSections[5] ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openSections[5] && (
          <div className="p-4 space-y-4">
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
                className="w-full min-h-[64px] px-4 py-5 rounded-xl border border-dashed border-accent bg-accent-100 text-accent-900 text-xs font-bold flex items-center justify-center gap-2 hover:bg-accent-200 disabled:opacity-60 active:scale-98 transition-all"
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
                      <p className="text-[11px] text-slate-500 mt-0.5">{aiSummary}</p>
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
                        className="p-1 text-slate-500 hover:text-accent-800"
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
                  className="w-full min-h-[40px] py-2 px-4 rounded-full bg-accent text-paper text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-accent-600"
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
        )}
      </section>

      {/* SECTION 6: 데이터 백업(내보내기) 및 복원(불러오기) */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(6)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                '6. 데이터 백업(내보내기) 및 복원(불러오기)',
                '6. Data Backup (Export) & Restore (Import)',
                '6. 数据备份（导出）与恢复（导入）'
              )}
            </h2>
            <p className="text-[11px] text-slate-600">
              {tr(
                lang,
                '스마트폰 교체나 브라우저 초기화에 대비해 전체 플래너 상태를 파일로 보관',
                'Save or restore your entire planner state as a JSON file across devices',
                '将全部规划器数据保存为 JSON 文件，更换手机或重置浏览器后可一键恢复'
              )}
            </p>
          </div>
          {openSections[6] ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openSections[6] && (
          <div className="p-4 space-y-4">
            <div className="px-0.5 flex items-center justify-between">
              <span className="text-xs text-slate-600">
                {tr(lang, '마지막 백업 일시', 'Last Backup Date', '上次备份时间')}
              </span>
              <span className="text-xs font-mono text-ink tabular-nums">
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
              accept=".json,application/json"
              onChange={handleImportBackupJson}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="min-h-[40px] px-3 py-2 rounded-full bg-accent text-paper text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-accent-600"
              >
                <Download className="w-4 h-4" />
                {tr(lang, '데이터 내보내기 (저장)', 'Export Backup (.json)', '导出备份文件')}
              </button>

              <button
                type="button"
                onClick={() => restoreFileInputRef.current?.click()}
                className="min-h-[40px] px-3 py-2 rounded-full bg-transparent text-ink border border-divider text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100"
              >
                <FileUp className="w-4 h-4" />
                {tr(lang, '데이터 불러오기 (복원)', 'Import Backup (.json)', '导入恢复数据')}
              </button>
            </div>

            <div className="flex">
              <button
                type="button"
                onClick={() => {
                  onResetSampleData();
                  setBackupFeedback({
                    type: 'success',
                    message: tr(
                      lang,
                      '초기 샘플 데이터 상태로 초기화되었습니다.',
                      'Reset to initial sample data.',
                      '已重置为初始示例数据状态。'
                    ),
                  });
                }}
                className="w-full h-10 rounded-full border border-accent-300 bg-accent-100 text-accent-900 inline-flex items-center justify-center gap-1 text-xs font-semibold hover:bg-accent-200"
              >
                <RotateCcw className="w-3 h-3" />
                {tr(
                  lang,
                  '초기 샘플 데이터로 전체 리셋',
                  'Reset All to Initial Sample Data',
                  '全部重置为初始示例数据'
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 7: 홈 화면 위젯 미리보기 (Android Home Screen Widget Preview) */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <div className="px-3.5 py-3 border-b border-divider flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-ink">
                {tr(
                  lang,
                  '홈 화면 위젯 미리보기',
                  'Home Screen Widget Preview',
                  '主屏幕小组件预览'
                )}
              </h2>
              <p className="text-[11px] text-slate-600">
                {tr(
                  lang,
                  '오늘의 학교·학원 시간표 및 일정 요약 위젯 (자동 동기화됨)',
                  "Today's school, academy & schedule summary widget (Auto-synced)",
                  '今日学校·补习班课表及日程摘要小组件（自动同步）'
                )}
              </p>
            </div>
          </div>

          {/* 위젯 테마 전환 버튼 (밝은 테마 / 어두운 테마) */}
          <div className="inline-flex rounded-full border border-divider overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setWidgetTheme('light')}
              className={`h-[30px] px-2.5 text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                widgetTheme === 'light'
                  ? 'bg-accent text-paper'
                  : 'text-ink hover:bg-slate-100'
              }`}
            >
              <Sun className="w-3 h-3" />
              {tr(lang, '밝은 테마', 'Light', '浅色')}
            </button>
            <button
              type="button"
              onClick={() => setWidgetTheme('dark')}
              className={`h-[30px] px-2.5 text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                widgetTheme === 'dark'
                  ? 'bg-accent text-paper'
                  : 'text-ink hover:bg-slate-100'
              }`}
            >
              <Moon className="w-3 h-3" />
              {tr(lang, '어두운 테마', 'Dark', '深色')}
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 스마트폰 홈 화면 배경 프레임 */}
          <div
            className={`p-3.5 rounded-2xl border transition-colors ${
              widgetTheme === 'dark'
                ? 'bg-slate-800 border-transparent'
                : 'bg-slate-200/60 border-transparent'
            }`}
          >
            {/* 실제 안드로이드 위젯 카드 UI */}
            <div
              className={`rounded-2xl p-3.5 shadow-md border transition-all ${
                widgetTheme === 'dark'
                  ? 'bg-slate-900 border-transparent text-slate-100'
                  : 'bg-paper border-divider text-ink'
              }`}
            >
              {/* 위젯 상단 헤더 */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/20">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-xs font-extrabold tracking-tight">
                    {tr(
                      lang,
                      '오늘의 스마트 플래너',
                      "Today's Smart Planner",
                      '今日智能规划'
                    )}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                    widgetTheme === 'dark'
                      ? 'bg-slate-800 text-slate-200'
                      : 'bg-surface text-slate-700'
                  }`}
                >
                  {formatLocalizedDate(widgetPayload.date, widgetPayload.dayOfWeek, lang)}
                </span>
              </div>

              {/* 위젯 본문: 학교 시간표 & 학원 시간표 2열 요약 */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 오늘의 학교 시간표 */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    widgetTheme === 'dark'
                      ? 'bg-slate-800 border-transparent'
                      : 'bg-sage-100 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[11px] font-extrabold ${
                        widgetTheme === 'dark' ? 'text-sage-300' : 'text-sage-800'
                      }`}
                    >
                      {tr(lang, '학교 수업', 'School', '学校课程')}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        widgetTheme === 'dark' ? 'text-slate-400' : 'text-sage-700'
                      }`}
                    >
                      {activeSchoolClasses.length}
                      {tr(lang, '교시', 'p', '节')}
                    </span>
                  </div>

                  {activeSchoolClasses.length === 0 ? (
                    <p
                      className={`text-[11px] py-2 text-center ${
                        widgetTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {tr(lang, '오늘 학교 수업 없음', 'No classes today', '今日无学校课程')}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {activeSchoolClasses.slice(0, 4).map((item) => (
                        <div
                          key={item.period}
                          className="flex items-center justify-between text-[11px] gap-1"
                        >
                          <span
                            className={`font-mono text-[10px] shrink-0 ${
                              widgetTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {item.period}
                            {tr(lang, '교시', 'P', '节')}
                          </span>
                          <span className="font-bold truncate">
                            {translateSubject(item.subject, lang)}
                          </span>
                        </div>
                      ))}
                      {activeSchoolClasses.length > 4 && (
                        <div
                          className={`text-[10px] font-semibold text-right pt-0.5 ${
                            widgetTheme === 'dark' ? 'text-sage-300' : 'text-sage-700'
                          }`}
                        >
                          +{activeSchoolClasses.length - 4}
                          {tr(lang, '개 더보기', ' more', '节更多')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 오늘의 학원 시간표 */}
                <div
                  className={`p-2.5 rounded-xl border ${
                    widgetTheme === 'dark'
                      ? 'bg-slate-800 border-transparent'
                      : 'bg-accent-100 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[11px] font-extrabold ${
                        widgetTheme === 'dark' ? 'text-accent-300' : 'text-accent-800'
                      }`}
                    >
                      {tr(lang, '학원 일정', 'Academy', '补习班')}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        widgetTheme === 'dark' ? 'text-slate-400' : 'text-accent-700'
                      }`}
                    >
                      {activeAcademyClasses.length}
                      {tr(lang, '건', '', '项')}
                    </span>
                  </div>

                  {activeAcademyClasses.length === 0 ? (
                    <p
                      className={`text-[11px] py-2 text-center ${
                        widgetTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {tr(lang, '오늘 학원 일정 없음', 'No academies today', '今日无补习班')}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {activeAcademyClasses.slice(0, 3).map((ac) => (
                        <div key={ac.id} className="text-[11px] leading-tight">
                          <div className="font-bold truncate">
                            {translateSubject(ac.subject, lang)}
                          </div>
                          <div
                            className={`font-mono text-[10px] ${
                              widgetTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {ac.startTime}~{ac.endTime}
                          </div>
                        </div>
                      ))}
                      {activeAcademyClasses.length > 3 && (
                        <div
                          className={`text-[10px] font-semibold text-right pt-0.5 ${
                            widgetTheme === 'dark' ? 'text-accent-300' : 'text-accent-700'
                          }`}
                        >
                          +{activeAcademyClasses.length - 3}
                          {tr(lang, '건 더보기', ' more', '项更多')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 오늘의 주요 일정 요약 바 */}
              <div
                className={`mt-2.5 pt-2 border-t flex items-center justify-between gap-2 text-[11px] ${
                  widgetTheme === 'dark' ? 'border-slate-700' : 'border-divider'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                      widgetTheme === 'dark'
                        ? 'bg-accent/20 text-accent-300'
                        : 'bg-accent-100 text-accent-800'
                    }`}
                  >
                    {tr(lang, '오늘 일정', 'Events', '今日日程')}
                  </span>
                  <span className="truncate font-semibold">
                    {widgetPayload.todaySchedules.length > 0
                      ? widgetPayload.todaySchedules
                          .map((s) => translateSampleText(s.title, lang))
                          .join(', ')
                      : tr(
                          lang,
                          '등록된 특별 일정이 없습니다',
                          'No special schedules today',
                          '今日无特别日程'
                        )}
                  </span>
                </div>
                {widgetPayload.attendanceSummary.pendingMakeupCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-accent-100 text-accent-900 font-bold text-[10px] shrink-0">
                    {tr(
                      lang,
                      `보강 ${widgetPayload.attendanceSummary.pendingMakeupCount}건`,
                      `Makeup ${widgetPayload.attendanceSummary.pendingMakeupCount}`,
                      `待补课 ${widgetPayload.attendanceSummary.pendingMakeupCount}`
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 위젯 브릿지 동기화 상태 및 수동 새로고침 버튼 */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-600">
              {widgetSyncToast ||
                tr(
                  lang,
                  '시간표·일정·출석 변경 시 WIDGET_SYNC_DATA 및 안드로이드 위젯에 즉시 반영됩니다.',
                  'Automatically syncs to WIDGET_SYNC_DATA & AndroidWidgetBridge on any change.',
                  '修改课表、日程或考勤时会自动同步至 WIDGET_SYNC_DATA 与安卓桌面小组件。'
                )}
            </span>
            <button
              type="button"
              onClick={() => {
                syncWidgetData(state);
                setWidgetSyncToast(
                  tr(
                    lang,
                    '✓ 방금 위젯 데이터가 동기화되었습니다.',
                    '✓ Widget data synced just now.',
                    '✓ 小组件数据刚刚已同步。'
                  )
                );
                setTimeout(() => setWidgetSyncToast(null), 2500);
              }}
              className="h-9 px-3 rounded-full border border-divider bg-transparent hover:bg-slate-100 text-ink text-xs font-semibold shrink-0 transition-colors"
            >
              {tr(lang, '위젯 수동 동기화', 'Sync Now', '立即同步')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
