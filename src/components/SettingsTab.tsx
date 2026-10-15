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
          school: rows.map((row, idx) => ({
            ...(existing[idx] || {}),
            period: row.period,
            startTime: row.startTime,
            endTime: row.endTime,
            subject: existing[idx]?.subject ?? fillSubject,
          })),
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

  const handleUpdateMasterSchoolPeriod = (
    periodNum: number,
    patch: Partial<SchoolPeriod>
  ) => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[selectedMasterDay];
      const updatedSchool = dayData.school.map((p) =>
        p.period === periodNum ? { ...p, ...patch } : p
      );
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [selectedMasterDay]: {
            ...dayData,
            school: updatedSchool,
          },
        },
      };
    });
  };

  const handleAddMasterSchoolPeriod = () => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[selectedMasterDay];
      const nextPeriodNum = dayData.school.length + 1;
      const cfg: SchoolTimeConfig = {
        ...DEFAULT_SCHOOL_TIME_CONFIG,
        ...(prev.schoolTimeConfig || {}),
      };
      let startTime: string;
      let endTime: string;
      if (cfg.mode === 'preset') {
        const row = buildPresetPeriods(cfg, nextPeriodNum)[nextPeriodNum - 1];
        startTime = row.startTime;
        endTime = row.endTime;
      } else {
        const last = dayData.school[dayData.school.length - 1];
        const lastEnd = last ? timeStrToMinutes(last.endTime) : timeStrToMinutes(cfg.firstStart) - cfg.breakMinutes;
        const duration = last
          ? Math.max(5, timeStrToMinutes(last.endTime) - timeStrToMinutes(last.startTime))
          : cfg.classMinutes;
        const start = lastEnd + cfg.breakMinutes;
        startTime = minutesToTimeStr(start);
        endTime = minutesToTimeStr(start + duration);
      }
      const newPeriod: SchoolPeriod = {
        period: nextPeriodNum,
        startTime,
        endTime,
        subject: prev.subjectPool.school.includes('자습')
          ? '자습'
          : prev.subjectPool.school[0] || '자습',
      };
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [selectedMasterDay]: {
            ...dayData,
            school: [...dayData.school, newPeriod],
          },
        },
      };
    });
  };

  const handleRemoveLastMasterSchoolPeriod = () => {
    onUpdateState((prev) => {
      const dayData = prev.masterTimetable[selectedMasterDay];
      if (dayData.school.length === 0) return prev;
      return {
        ...prev,
        masterTimetable: {
          ...prev.masterTimetable,
          [selectedMasterDay]: {
            ...dayData,
            school: dayData.school.slice(0, -1),
          },
        },
      };
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

  const currentMasterDayData = state.masterTimetable[selectedMasterDay];
  const periodTimeInputCls = `w-24 h-8 px-2 rounded-full border border-divider text-xs font-mono focus:outline-none ${
    isPresetMode
      ? 'bg-paper text-slate-500 cursor-not-allowed'
      : 'bg-surface text-slate-700 focus:border-accent'
  }`;

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

      {/* SECTION 2: 하루 시간표 표시 시간(시작~종료) 및 학교/학원 기본 시간표 설정 */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(2)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                '2. 시간표 표시 시간 (시작~종료) 및 기본 시간표 설정',
                '2. Timeline Display Hours & Master Timetable Setup',
                '2. 时间轴起止时间与每周固定课表设置'
              )}
            </h2>
            <p className="text-[11px] text-slate-600">
              {tr(
                lang,
                '일별 타임라인 시작·종료 시각 설정, 초·중·고 교시 프리셋 및 요일별 시간표 편집',
                'Configure daily timeline start/end hours, school period presets, and weekly master schedules',
                '设置每日时间轴开始与结束时间、标准课时预设及编辑各星期固定课表'
              )}
            </p>
          </div>
          {openSections[2] ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openSections[2] && (
          <div className="p-4 space-y-4">
            {masterFeedback && (
              <div className="p-3 rounded-xl bg-accent-100 border border-accent-300 text-xs font-bold text-accent-900">
                {masterFeedback}
              </div>
            )}

            {/* Daily Timeline Start & End Hour Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-ink">
                    {tr(
                      lang,
                      '시간표 하루 시작·종료 시간 설정',
                      'Daily Timeline Start & End Hours',
                      '课程表每日开始与结束时间设置'
                    )}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-accent text-paper text-[11px] font-mono tabular-nums">
                  {String(timelineStartHour).padStart(2, '0')}:00 ~{' '}
                  {String(timelineEndHour).padStart(2, '0')}:00 ({timelineEndHour - timelineStartHour}h)
                </span>
              </div>

              <p className="text-[11px] text-slate-600">
                {tr(
                  lang,
                  '[시간표 > 일별 상세 보기]의 타임라인 표와 빈 시간 계산에 적용할 하루의 시작 시각과 종료 시각을 선택하세요.',
                  'Choose the start and end hours displayed on the Daily Timeline and used for free-time calculation.',
                  '选择应用于【课程表 > 每日详情】时间轴视图及空闲时间计算的每日起止时间。'
                )}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600">
                    {tr(lang, '하루 시작 시간', 'Start Hour', '开始时间')}
                  </label>
                  <select
                    value={timelineStartHour}
                    onChange={(e) => {
                      const nextStart = Number(e.target.value);
                      const adjustedEnd =
                        timelineEndHour <= nextStart + 1
                          ? Math.min(24, nextStart + 2)
                          : timelineEndHour;
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
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600">
                    {tr(lang, '하루 종료 시간', 'End Hour', '结束时间')}
                  </label>
                  <select
                    value={timelineEndHour}
                    onChange={(e) => {
                      const nextEnd = Number(e.target.value);
                      handleUpdateTimelineRange(timelineStartHour, nextEnd);
                    }}
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
                </div>
              </div>

              {/* Quick Presets for Timeline Range */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleUpdateTimelineRange(6, 24)}
                  className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                    timelineStartHour === 6 && timelineEndHour === 24
                      ? 'bg-ink text-paper border-transparent'
                      : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                  }`}
                >
                  {tr(lang, '얼리버드 (06~24시)', 'Early (06-24h)', '早鸟 (06~24时)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateTimelineRange(8, 24)}
                  className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                    timelineStartHour === 8 && timelineEndHour === 24
                      ? 'bg-ink text-paper border-transparent'
                      : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                  }`}
                >
                  {tr(lang, '기본 (08~24시)', 'Default (08-24h)', '默认 (08~24时)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateTimelineRange(8, 22)}
                  className={`h-[30px] px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                    timelineStartHour === 8 && timelineEndHour === 22
                      ? 'bg-ink text-paper border-transparent'
                      : 'bg-transparent text-ink border-divider hover:bg-slate-100'
                  }`}
                >
                  {tr(lang, '표준 (08~22시)', 'Compact (08-22h)', '紧凑 (08~22时)')}
                </button>
              </div>
            </div>

            {/* School Class-Time Setup: Preset vs Custom */}
            <div className="space-y-2.5 pt-3 border-t border-divider">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sage-700" />
                <span className="text-xs font-bold text-ink">
                  {tr(lang, '학교 수업 시간 설정', 'School Class Times', '学校上课时间设置')}
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label={tr(lang, '수업 시간 설정 방식', 'Class time setup mode', '上课时间设置方式')}
                className="grid grid-cols-2 p-1 rounded-full bg-paper gap-1"
              >
                {(
                  [
                    { mode: 'preset', label: tr(lang, '프리셋으로 설정', 'Use Preset', '按预设设置') },
                    { mode: 'custom', label: tr(lang, '교시별 직접 설정', 'Set Each Period', '逐节自定义') },
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
                        active ? 'bg-accent text-paper' : 'text-ink hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {isPresetMode ? (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-600">
                    {tr(
                      lang,
                      '시작 시간·수업/쉬는/점심 시간을 입력하면 교시 시간이 자동 계산됩니다. [모든 요일에 적용]을 눌러 반영하세요.',
                      'Enter start time and class/break/lunch lengths to auto-calculate periods, then tap [Apply to All Days].',
                      '输入开始时间及上课/课间/午休时长即可自动计算各节时间，然后点击【应用到所有星期】。'
                    )}
                  </p>

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

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '첫 수업 시작 시간', 'First Class Starts', '第一节开始时间')}
                      </span>
                      <input
                        type="time"
                        value={schoolTimeConfig.firstStart}
                        onChange={(e) =>
                          e.target.value && updateSchoolTimeConfig({ firstStart: e.target.value })
                        }
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '교시 수', 'Number of Periods', '节数')}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={schoolTimeConfig.periodCount}
                        onChange={(e) =>
                          updateSchoolTimeConfig({ periodCount: Number(e.target.value) || 1 })
                        }
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '수업 시간 (분)', 'Class Length (min)', '每节时长（分钟）')}
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={schoolTimeConfig.classMinutes}
                        onChange={(e) =>
                          updateSchoolTimeConfig({ classMinutes: Number(e.target.value) || 5 })
                        }
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '쉬는 시간 (분)', 'Break (min)', '课间休息（分钟）')}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={schoolTimeConfig.breakMinutes}
                        onChange={(e) =>
                          updateSchoolTimeConfig({ breakMinutes: Number(e.target.value) || 0 })
                        }
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '점심시간 (분)', 'Lunch (min)', '午休时长（分钟）')}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={schoolTimeConfig.lunchMinutes}
                        onChange={(e) =>
                          updateSchoolTimeConfig({ lunchMinutes: Number(e.target.value) || 0 })
                        }
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] font-medium text-slate-600">
                        {tr(lang, '점심 위치', 'Lunch After', '午休位置')}
                      </span>
                      <select
                        value={
                          schoolTimeConfig.lunchAfterPeriod >= schoolTimeConfig.periodCount
                            ? 0
                            : schoolTimeConfig.lunchAfterPeriod
                        }
                        onChange={(e) =>
                          updateSchoolTimeConfig({ lunchAfterPeriod: Number(e.target.value) })
                        }
                        className="w-full h-9 px-3 rounded-full border border-divider bg-paper text-[13px] font-mono text-ink tabular-nums focus:outline-none focus:border-accent"
                      >
                        <option value={0}>{tr(lang, '점심 없음', 'No lunch', '无午休')}</option>
                        {Array.from(
                          { length: Math.max(0, schoolTimeConfig.periodCount - 1) },
                          (_, i) => i + 1
                        ).map((n) => (
                          <option key={n} value={n}>
                            {tr(lang, `${n}교시 후`, `After P${n}`, `第${n}节后`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Live preview */}
                  <div className="rounded-xl bg-paper p-2.5 space-y-1">
                    <div className="text-[11px] font-bold text-slate-600 pb-1">
                      {tr(lang, '미리보기', 'Preview', '预览')}
                    </div>
                    {presetPreviewRows.map((row) => (
                      <React.Fragment key={row.period}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-sage-800">
                            {tr(lang, `${row.period}교시`, `Period ${row.period}`, `第${row.period}节`)}
                          </span>
                          <span className="font-mono tabular-nums text-ink">
                            {row.startTime}~{row.endTime}
                          </span>
                        </div>
                        {row.period === schoolTimeConfig.lunchAfterPeriod &&
                          row.period < schoolTimeConfig.periodCount &&
                          schoolTimeConfig.lunchMinutes > 0 && (
                            <div className="flex items-center justify-between text-xs px-2 py-0.5 rounded-full bg-accent-100 text-accent-800">
                              <span className="font-semibold">
                                {tr(lang, '점심', 'Lunch', '午休')}
                              </span>
                              <span className="font-mono tabular-nums">
                                {row.endTime}~
                                {minutesToTimeStr(
                                  timeStrToMinutes(row.endTime) + schoolTimeConfig.lunchMinutes
                                )}
                              </span>
                            </div>
                          )}
                      </React.Fragment>
                    ))}
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
                <p className="text-[11px] text-slate-600">
                  {tr(
                    lang,
                    '아래 요일별 편집기에서 각 교시의 시작·종료 시간을 직접 입력하세요. 교시 추가/삭제도 가능합니다.',
                    'Enter each period’s start and end time directly in the per-day editor below. You can also add or remove periods.',
                    '请在下方按星期的编辑器中直接输入每节课的开始和结束时间，也可添加或删除课时。'
                  )}
                </p>
              )}
            </div>

            {/* Copy Day Timetable Control */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-slate-600">
                {tr(lang, '다른 요일 시간표 복사하기', 'Copy Day Schedule', '复制星期课表')}
              </span>
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
                  <Copy className="w-3.5 h-3.5" /> {tr(lang, '복사 실행', 'Copy', '执行复制')}
                </button>
              </div>
            </div>

            {/* Day Selector Tabs for Editing Master Timetable */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedMasterDay(d)}
                  className={`h-[30px] rounded-full text-xs font-bold transition-colors ${
                    selectedMasterDay === d
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-slate-200'
                  }`}
                >
                  {translateDay(d, lang)}
                </button>
              ))}
            </div>

            {/* Master School Periods Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sage-800">
                  {translateDay(selectedMasterDay, lang)}{' '}
                  {tr(
                    lang,
                    `기본 학교 시간표 (${currentMasterDayData.school.length}교시)`,
                    `Master School Schedule (${currentMasterDayData.school.length} periods)`,
                    `固定学校课表 (${currentMasterDayData.school.length}节课)`
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRemoveLastMasterSchoolPeriod}
                    className="h-7 px-2.5 rounded-full border border-divider text-ink text-[11px] font-semibold hover:bg-slate-100"
                  >
                    {tr(lang, '- 교시 삭제', '- Remove', '- 删除末节')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMasterSchoolPeriod}
                    className="h-7 px-2.5 rounded-full bg-sage-100 text-sage-800 text-[11px] font-bold hover:bg-sage-200"
                  >
                    {tr(lang, '+ 교시 추가', '+ Period', '+ 添加课时')}
                  </button>
                </div>
              </div>

              <p
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full inline-block ${
                  isPresetMode ? 'bg-paper text-slate-600' : 'bg-sage-100 text-sage-800'
                }`}
              >
                {isPresetMode
                  ? tr(
                      lang,
                      '프리셋 모드: 시간은 프리셋으로 계산됩니다 (과목만 수정 가능)',
                      'Preset mode: times come from the preset (subjects editable)',
                      '预设模式：时间由预设计算（仅可修改科目）'
                    )
                  : tr(
                      lang,
                      '직접 설정 모드: 교시별 시작·종료 시간을 입력하세요',
                      'Custom mode: edit each period’s start and end time',
                      '自定义模式：逐节输入开始与结束时间'
                    )}
              </p>

              {currentMasterDayData.school.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-1.5 text-center">
                  {tr(
                    lang,
                    '등록된 정규 교시가 없습니다. [+ 교시 추가]를 눌러 추가하세요.',
                    'No school periods configured for this day.',
                    '当天未登记学校常规课时，请点击【+ 添加课时】。'
                  )}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentMasterDayData.school.map((p) => (
                    <div
                      key={p.period}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-paper"
                    >
                      <span className="w-11 text-xs font-mono text-sage-800 shrink-0 tabular-nums">
                        {tr(lang, `${p.period}교시`, `P${p.period}`, `第${p.period}节`)}
                      </span>
                      <input
                        type="time"
                        value={p.startTime}
                        readOnly={isPresetMode}
                        aria-label={tr(lang, `${p.period}교시 시작 시간`, `Period ${p.period} start`, `第${p.period}节开始时间`)}
                        onChange={(e) =>
                          !isPresetMode &&
                          handleUpdateMasterSchoolPeriod(p.period, {
                            startTime: e.target.value,
                          })
                        }
                        className={periodTimeInputCls}
                      />
                      <span className="text-xs text-slate-400">~</span>
                      <input
                        type="time"
                        value={p.endTime}
                        readOnly={isPresetMode}
                        aria-label={tr(lang, `${p.period}교시 종료 시간`, `Period ${p.period} end`, `第${p.period}节结束时间`)}
                        onChange={(e) =>
                          !isPresetMode &&
                          handleUpdateMasterSchoolPeriod(p.period, {
                            endTime: e.target.value,
                          })
                        }
                        className={periodTimeInputCls}
                      />
                      <select
                        value={p.subject}
                        onChange={(e) =>
                          handleUpdateMasterSchoolPeriod(p.period, {
                            subject: e.target.value,
                          })
                        }
                        className="flex-1 h-8 px-2.5 rounded-full border border-divider bg-surface text-xs font-semibold text-ink min-w-0 focus:outline-none focus:border-accent"
                      >
                        {!state.subjectPool.school.includes(p.subject) && (
                          <option value={p.subject}>
                            {p.subject ? translateSubject(p.subject, lang) : tr(lang, '(과목 없음)', '(No subject)', '（无科目）')}
                          </option>
                        )}
                        {state.subjectPool.school.map((s) => (
                          <option key={s} value={s}>
                            {translateSubject(s, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Master Academy Editor */}
            <div className="space-y-2 pt-3 border-t border-divider">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-accent-800">
                  {translateDay(selectedMasterDay, lang)}{' '}
                  {tr(
                    lang,
                    `기본 학원 시간표 (${currentMasterDayData.academy.length}건)`,
                    `Master Academies (${currentMasterDayData.academy.length})`,
                    `固定补习班课表 (${currentMasterDayData.academy.length}项)`
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleAddMasterAcademyItem}
                  className="h-7 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold hover:bg-accent-200"
                >
                  {tr(lang, '+ 학원 시간 추가', '+ Add Academy', '+ 添加补习班')}
                </button>
              </div>

              {currentMasterDayData.academy.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-1.5 text-center">
                  {tr(
                    lang,
                    '이 요일에 등록된 기본 학원 일정이 없습니다.',
                    'No default academy classes on this day.',
                    '当天没有登记固定补习班课程。'
                  )}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {currentMasterDayData.academy.map((ac) => (
                    <div
                      key={ac.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-paper"
                    >
                      <input
                        type="time"
                        value={ac.startTime}
                        onChange={(e) =>
                          handleUpdateMasterAcademyItem(ac.id, {
                            startTime: e.target.value,
                          })
                        }
                        className="w-24 h-8 px-2 rounded-full border border-divider bg-surface text-xs font-mono text-slate-700 focus:outline-none focus:border-accent"
                      />
                      <span className="text-xs text-slate-400">~</span>
                      <input
                        type="time"
                        value={ac.endTime}
                        onChange={(e) =>
                          handleUpdateMasterAcademyItem(ac.id, {
                            endTime: e.target.value,
                          })
                        }
                        className="w-24 h-8 px-2 rounded-full border border-divider bg-surface text-xs font-mono text-slate-700 focus:outline-none focus:border-accent"
                      />
                      <select
                        value={ac.subject}
                        onChange={(e) =>
                          handleUpdateMasterAcademyItem(ac.id, {
                            subject: e.target.value,
                          })
                        }
                        className="flex-1 h-8 px-2.5 rounded-full border border-divider bg-surface text-xs font-semibold text-ink min-w-0 focus:outline-none focus:border-accent"
                      >
                        {state.subjectPool.academy.map((aName) => (
                          <option key={aName} value={aName}>
                            {translateSubject(aName, lang)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteMasterAcademyItem(ac.id)}
                        className="p-1.5 text-slate-500 hover:text-accent-800"
                        aria-label={tr(lang, '삭제', 'Delete', '删除')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: AI 비정형 시간표 이미지 자동 인식 */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(3)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                '3. AI 비정형 시간표 이미지 자동 인식',
                '3. AI Timetable Image Recognition',
                '3. AI 非结构化课表图片自动识别'
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
          {openSections[3] ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openSections[3] && (
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

      {/* SECTION 4: 데이터 백업(내보내기) 및 복원(불러오기) */}
      <section className="bg-surface rounded-2xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(4)}
          className="w-full px-3.5 py-3 border-b border-divider flex items-center justify-between text-left"
        >
          <div>
            <h2 className="text-[13px] font-bold text-ink">
              {tr(
                lang,
                '4. 데이터 백업(내보내기) 및 복원(불러오기)',
                '4. Data Backup (Export) & Restore (Import)',
                '4. 数据备份（导出）与恢复（导入）'
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
          {openSections[4] ? (
            <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
          )}
        </button>

        {openSections[4] && (
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

      {/* SECTION 5: 홈 화면 위젯 미리보기 (Android Home Screen Widget Preview) */}
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
