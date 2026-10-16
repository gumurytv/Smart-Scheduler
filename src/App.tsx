import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  StickyNote,
  Settings,
  WifiOff,
} from 'lucide-react';
import {
  PlannerState,
  DailyOverrides,
  ScheduleItem,
  AttendanceMap,
  MemoMap,
  AppLanguage,
  DEFAULT_SCHOOL_TIME_CONFIG,
  TEXT_SCALES,
} from './types';
import { createInitialPlannerState } from './data/initialData';
import { tr, formatDateLabel } from './i18n/translations';
import { TimetableTab } from './components/TimetableTab';
import { ScheduleTab } from './components/ScheduleTab';
import { AttendanceTab } from './components/AttendanceTab';
import { MemoTab } from './components/MemoTab';
import { SettingsTab } from './components/SettingsTab';
import { syncWidgetData } from './utils/widgetSync';
import { registerBackButton, keepRepainted } from './native/androidShell';

const STORAGE_KEY = 'smart_school_academy_planner_v1';

type TabKey = 'timetable' | 'schedule' | 'attendance' | 'memo' | 'settings';

function loadInitialState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.subjectPool &&
        parsed.masterTimetable &&
        Array.isArray(parsed.schedules) &&
        parsed.attendance &&
        parsed.memos
      ) {
        return {
          ...(parsed as PlannerState),
          language: parsed.language || 'ko',
          timelineConfig: parsed.timelineConfig || { startHour: 8, endHour: 24 },
          schoolTimeConfig: parsed.schoolTimeConfig || { ...DEFAULT_SCHOOL_TIME_CONFIG },
        };
      }
    }
  } catch (e) {
    console.warn('localStorage load fallback to sample data:', e);
  }
  return {
    ...createInitialPlannerState(new Date()),
    language: 'ko',
    schoolTimeConfig: { ...DEFAULT_SCHOOL_TIME_CONFIG },
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('timetable');
  // Settings section to open when arriving from another tab (e.g. "내 정보" from the 지금 card)
  const [settingsFocus, setSettingsFocus] = useState<'profile' | null>(null);
  const [state, setState] = useState<PlannerState>(() => loadInitialState());
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const lang: AppLanguage = state.language || 'ko';

  // Save to localStorage immediately on every state update (Local-First) + Sync Widget Data
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
    syncWidgetData(state);
  }, [state]);

  // 글자 크기: every text size is in rem, so scaling the root font size scales all text.
  const textScale = TEXT_SCALES.includes(state.textScale ?? 100) ? state.textScale ?? 100 : 100;
  useLayoutEffect(() => {
    document.documentElement.style.fontSize = textScale === 100 ? '' : `${textScale}%`;
  }, [textScale]);

  // The content area is the scroll container: start each tab at the top.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);
  useEffect(() => keepRepainted(mainRef.current), []);

  // Android back button: close sheet → back to 시간표 → exit app (no-op in the browser)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  useEffect(
    () =>
      registerBackButton({
        isOnHomeTab: () => activeTabRef.current === 'timetable',
        goHome: () => setActiveTab('timetable'),
      }),
    []
  );

  // Listen to online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdateDailyOverrides = (updater: (prev: DailyOverrides) => DailyOverrides) => {
    setState((prev) => ({
      ...prev,
      dailyOverrides: updater(prev.dailyOverrides),
    }));
  };

  const handleUpdateSchedules = (updater: (prev: ScheduleItem[]) => ScheduleItem[]) => {
    setState((prev) => ({
      ...prev,
      schedules: updater(prev.schedules),
    }));
  };

  const handleUpdateAttendance = (updater: (prev: AttendanceMap) => AttendanceMap) => {
    setState((prev) => ({
      ...prev,
      attendance: updater(prev.attendance),
    }));
  };

  const handleUpdateMemos = (updater: (prev: MemoMap) => MemoMap) => {
    setState((prev) => ({
      ...prev,
      memos: updater(prev.memos),
    }));
  };

  const handleResetSampleData = () => {
    const fresh = createInitialPlannerState(new Date());
    setState((prev) => ({
      ...fresh,
      language: prev.language || 'ko',
      schoolTimeConfig: { ...DEFAULT_SCHOOL_TIME_CONFIG },
      profile: prev.profile,
      textScale: prev.textScale,
    }));
  };

  const today = new Date();
  const todayFormatted = formatDateLabel(today, lang);

  // Count pending makeups for header quick badge
  const pendingMakeupCount = Object.values(state.attendance).reduce((acc, dayAtt) => {
    if (!dayAtt.academies) return acc;
    const countInDay = Object.values(dayAtt.academies).filter(
      (r) => r.needsMakeup && !r.makeupCompleted
    ).length;
    return acc + countInDay;
  }, 0);

  const navTabs: Array<{
    id: TabKey;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    {
      id: 'timetable',
      label: tr(lang, '시간표', 'Timetable', '课程表'),
      icon: CalendarClock,
    },
    {
      id: 'schedule',
      label: tr(lang, '일정표', 'Schedule', '日程表'),
      icon: CalendarDays,
    },
    {
      id: 'attendance',
      label: tr(lang, '출석표', 'Attendance', '出勤表'),
      icon: CheckCircle2,
    },
    {
      id: 'memo',
      label: tr(lang, '메모장', 'Memo', '备忘录'),
      icon: StickyNote,
    },
    {
      id: 'settings',
      label: tr(lang, '설정', 'Settings', '设置'),
      icon: Settings,
    },
  ];

  return (
    <div className="max-w-md mx-auto h-screen h-[100dvh] overflow-hidden bg-paper text-ink flex flex-col shadow-xl relative">
      {/* App shell: fixed-height column (header · scrolling content · tab bar). Only <main>
          scrolls, so the page itself never does — the Android WebView repaints reliably this way. */}
      {/* Top Header */}
      <header className="flex-none z-30 bg-surface border-b border-divider px-4 h-14 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <h1 className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[1.25rem] font-extrabold tracking-tight text-accent-700 shrink-0">
              {tr(lang, '틈틈', 'TeumTeum', 'TeumTeum')}
            </span>
            <span className="text-[0.6875rem] font-semibold text-slate-600 truncate">
              {tr(lang, '학교·학원 플래너', 'school & academy planner', '学校·补习班计划本')}
            </span>
          </h1>
          {isOffline && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-900 text-[0.625rem] font-bold shrink-0">
              <WifiOff className="w-3 h-3" />{' '}
              {tr(lang, '오프라인 작동중', 'Offline Mode', '离线运行中')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingMakeupCount > 0 && activeTab !== 'attendance' && (
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className="h-7 px-2.5 rounded-full bg-accent-100 border border-accent-300 text-accent-900 text-[0.6875rem] font-bold tabular-nums hover:bg-accent-200 transition-colors"
            >
              {tr(
                lang,
                `미완료 보강 ${pendingMakeupCount}건`,
                `${pendingMakeupCount} Makeup(s)`,
                `待补课 ${pendingMakeupCount}项`
              )}
            </button>
          )}
          <span className="text-[0.8125rem] font-mono text-slate-500 tabular-nums">
            {todayFormatted}
          </span>
        </div>
      </header>

      {/* Main Scrollable Content Area (the only scroll container) */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-paper p-3.5 pb-6">
        {activeTab === 'timetable' && (
          <TimetableTab
            language={lang}
            subjectPool={state.subjectPool}
            masterTimetable={state.masterTimetable}
            dailyOverrides={state.dailyOverrides}
            timelineConfig={state.timelineConfig}
            onUpdateDailyOverrides={handleUpdateDailyOverrides}
            schedules={state.schedules}
            onUpdateSchedules={handleUpdateSchedules}
            attendance={state.attendance}
            onUpdateAttendance={handleUpdateAttendance}
            profile={state.profile}
            onEditProfile={() => {
              setSettingsFocus('profile');
              setActiveTab('settings');
            }}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            language={lang}
            schedules={state.schedules}
            onUpdateSchedules={handleUpdateSchedules}
            masterTimetable={state.masterTimetable}
            dailyOverrides={state.dailyOverrides}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab
            language={lang}
            attendance={state.attendance}
            masterTimetable={state.masterTimetable}
            dailyOverrides={state.dailyOverrides}
            subjectPool={state.subjectPool}
            onUpdateAttendance={handleUpdateAttendance}
          />
        )}

        {activeTab === 'memo' && (
          <MemoTab
            language={lang}
            memos={state.memos}
            onUpdateMemos={handleUpdateMemos}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            state={state}
            onUpdateState={setState}
            onResetSampleData={handleResetSampleData}
            focusSection={settingsFocus}
            onFocusHandled={() => setSettingsFocus(null)}
          />
        )}
      </main>

      {/* Bottom 5-Tab Navigation Bar (in flow, below the scroll area) */}
      <nav
        aria-label={tr(lang, '메인 메뉴', 'Main Navigation', '主导航')}
        className="flex-none w-full z-40 bg-surface border-t border-divider px-1.5 h-16 grid grid-cols-5 items-center"
      >
        {navTabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors relative ${
                isActive
                  ? 'text-accent-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <IconComponent
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'scale-105 stroke-[2.75]' : 'stroke-2'
                }`}
              />
              <span
                className={`text-[0.6875rem] mt-1 tracking-tight whitespace-nowrap ${
                  isActive ? 'font-bold text-accent-700' : 'font-medium text-slate-500'
                }`}
              >
                {tab.label}
              </span>
              {tab.id === 'attendance' && pendingMakeupCount > 0 && (
                <span className="absolute top-1.5 right-3.5 w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
