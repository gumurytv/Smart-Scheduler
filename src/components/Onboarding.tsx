import React, { useState } from 'react';
import {
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Hand,
  IdCard,
  Rocket,
  Settings,
  Sparkles,
  StickyNote,
  Tags,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { AppLanguage, PlannerState, TEXT_SCALES, TextScale } from '../types';
import { tr } from '../i18n/translations';
import { resetPlannerParts } from '../utils/appReset';
import { isNativeApp } from '../native/androidShell';
import { requestReminderPermission } from '../native/reminders';

/** Where to land after the guide: a settings card to open, or just the timetable. */
export type OnboardingExit = 'timetable' | 'pool' | 'school' | 'academy';

interface OnboardingProps {
  lang: AppLanguage;
  state: PlannerState;
  onUpdateState: (updater: (prev: PlannerState) => PlannerState) => void;
  onFinish: (exit: OnboardingExit) => void;
}

type TabKey = 'timetable' | 'schedule' | 'attendance' | 'memo' | 'settings';

const NAV: Array<{ id: TabKey; icon: LucideIcon; ko: string; en: string; zh: string }> = [
  { id: 'timetable', icon: CalendarClock, ko: '시간표', en: 'Timetable', zh: '课程表' },
  { id: 'schedule', icon: CalendarDays, ko: '일정표', en: 'Schedule', zh: '日程表' },
  { id: 'attendance', icon: CheckCircle2, ko: '출석표', en: 'Attendance', zh: '出勤表' },
  { id: 'memo', icon: StickyNote, ko: '메모장', en: 'Memo', zh: '备忘录' },
  { id: 'settings', icon: Settings, ko: '설정', en: 'Settings', zh: '设置' },
];

type L3 = [string, string, string];

/** 1) 화면 설명: one slide per bottom-menu tab, in plain words. */
const TOUR: Array<{ tab: TabKey; tone: string; title: L3; lines: L3[] }> = [
  {
    tab: 'timetable',
    tone: 'bg-accent-700',
    title: ['시간표 – 오늘 하루를 한눈에', 'Timetable – your day at a glance', '课程表 – 一眼看清今天'],
    lines: [
      ['맨 위 「지금」 카드에 지금 수업과 다음 수업이 나와요.', 'The “Now” card shows the current and next class.', '顶部「现在」卡片显示当前和下一节课。'],
      ['일별 · 주간 · 월별 버튼으로 보는 방식을 바꿔요.', 'Switch between day, week and month.', '用「日 · 周 · 月」切换查看方式。'],
      ['수업을 누르면 그날만 휴강·결석·메모를 바꿀 수 있어요.', 'Tap a class to change just that day.', '点击课程可只修改当天。'],
    ],
  },
  {
    tab: 'schedule',
    tone: 'bg-other-600',
    title: ['일정표 – 시험·숙제 날짜 챙기기', 'Schedule – exams and due dates', '日程表 – 考试和作业日期'],
    lines: [
      ['다가오는 일정이 D-Day와 함께 맨 위에 보여요.', 'Upcoming events show with a D-Day count.', '即将到来的日程带 D-Day 显示。'],
      ['「일정 추가」로 날짜·시간·메모를 적어요.', 'Use “Add” to note the date, time and memo.', '用「添加日程」记录日期、时间、备注。'],
      ['학교 · 학원 · 기타로 나눠서 볼 수 있어요.', 'Filter by school, academy or other.', '可按学校、补习班、其他分类查看。'],
    ],
  },
  {
    tab: 'attendance',
    tone: 'bg-sage-700',
    title: ['출석표 – 출석과 보강 관리', 'Attendance – and makeups', '出勤表 – 出勤与补课'],
    lines: [
      ['수업마다 출석 · 지각 · 결석 · 휴강을 눌러요.', 'Tap present, late, absent or off for each class.', '为每节课点出勤、迟到、缺席或停课。'],
      ['빠진 학원은 「보강 필요」를 누르면 따로 모여요.', 'Missed classes go to “Pending makeups”.', '缺上的课点「需补课」后会集中显示。'],
      ['보강 일정을 등록하고, 마치면 「보강 완료」를 눌러요.', 'Schedule the makeup, then tap “Done”.', '登记补课时间，完成后点「补课完成」。'],
    ],
  },
  {
    tab: 'memo',
    tone: 'bg-accent-600',
    title: ['메모장 – 하루 한 장 기록', 'Memo – one page a day', '备忘录 – 每天一页'],
    lines: [
      ['날짜를 고르고 적으면 저절로 저장돼요.', 'Pick a date and type – it saves itself.', '选择日期后输入，会自动保存。'],
      ['숙제 · 준비물 · 시험 버튼으로 빠르게 적어요.', 'Homework, supplies and exam tags help.', '用作业、准备物、考试标签快速记录。'],
      ['검색으로 지난 메모를 찾을 수 있어요.', 'Search finds older memos.', '可以搜索以前的备忘。'],
    ],
  },
  {
    tab: 'settings',
    tone: 'bg-slate-600',
    title: ['설정 – 내 시간표 만들기', 'Settings – build your timetable', '设置 – 建立你的课表'],
    lines: [
      ['학교 · 학원 시간표와 과목을 여기서 넣어요.', 'Enter school and academy timetables here.', '在这里填写学校、补习班课表和科目。'],
      ['글자 크기, 보강 알림, 홈 화면 위젯도 여기 있어요.', 'Text size, reminders and widgets live here too.', '字体大小、补课提醒、小组件也在这里。'],
      ['맨 위 「사용 가이드」에서 언제든 다시 볼 수 있어요.', '“User guide” at the top explains it all again.', '顶部「使用指南」随时可以再看。'],
    ],
  },
];

type SetupStep = 'text' | 'sample' | 'profile' | 'pool' | 'school' | 'academy' | 'reminders';
const SETUP: SetupStep[] = ['text', 'sample', 'profile', 'pool', 'school', 'academy', 'reminders'];

/** 처음 사용 안내: welcome → (화면 설명) → (초기 설정 단계) → done. Skippable at any point. */
export const Onboarding: React.FC<OnboardingProps> = ({ lang, state, onUpdateState, onFinish }) => {
  const t = (l: L3) => tr(lang, l[0], l[1], l[2]);
  const [phase, setPhase] = useState<'welcome' | 'tour' | 'setup' | 'done'>('welcome');
  const [index, setIndex] = useState(0);
  const [sampleChoice, setSampleChoice] = useState<'keep' | 'clear' | null>(null);
  const [reminderDenied, setReminderDenied] = useState(false);

  const textScale = state.textScale ?? 100;
  const profile = state.profile ?? { name: '', school: '', grade: '' };
  const setProfile = (patch: Partial<typeof profile>) =>
    onUpdateState((prev) => ({ ...prev, profile: { ...(prev.profile ?? { name: '', school: '', grade: '' }), ...patch } }));

  const total = phase === 'tour' ? TOUR.length : phase === 'setup' ? SETUP.length : 0;
  const next = () => {
    if (phase === 'tour') {
      if (index < TOUR.length - 1) setIndex(index + 1);
      else {
        setPhase('setup');
        setIndex(0);
      }
    } else if (phase === 'setup') {
      if (index < SETUP.length - 1) setIndex(index + 1);
      else setPhase('done');
    }
  };
  const back = () => {
    if (index > 0) setIndex(index - 1);
    else if (phase === 'setup') {
      setPhase('tour');
      setIndex(TOUR.length - 1);
    } else setPhase('welcome');
  };

  const bigChoice = (opts: {
    icon: LucideIcon;
    title: string;
    hint: string;
    onClick: () => void;
    primary?: boolean;
    selected?: boolean;
  }) => {
    const Icon = opts.icon;
    return (
      <button
        type="button"
        onClick={opts.onClick}
        aria-pressed={opts.selected}
        className={`w-full rounded-3xl px-4 py-4 flex items-center gap-4 text-left transition-colors ${
          opts.primary || opts.selected
            ? 'bg-accent-700 text-paper hover:bg-accent-800'
            : 'bg-surface text-ink hover:bg-slate-100 border border-divider'
        }`}
      >
        <span
          className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${
            opts.primary || opts.selected ? 'bg-paper/20' : 'bg-paper'
          }`}
        >
          <Icon className="w-6 h-6" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] font-bold leading-snug">{opts.title}</span>
          <span className={`block text-[0.8125rem] leading-snug ${opts.primary || opts.selected ? 'text-paper/85' : 'text-slate-600'}`}>
            {opts.hint}
          </span>
        </span>
        {opts.selected && <Check className="w-6 h-6 shrink-0" strokeWidth={3} />}
      </button>
    );
  };

  /** A setup step that is done in Settings: what to do + a shortcut there. */
  const settingsStep = (icon: LucideIcon, title: string, where: string, lines: string[], exit: OnboardingExit) => {
    const Icon = icon;
    return (
      <div className="space-y-5">
        <span className="w-16 h-16 rounded-3xl bg-accent-700 text-paper grid place-items-center">
          <Icon className="w-8 h-8" strokeWidth={2.25} />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-[1.375rem] font-bold text-ink leading-snug">{title}</h2>
          <p className="text-[0.875rem] font-semibold text-accent-800">{where}</p>
        </div>
        <ol className="space-y-3">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-surface text-ink font-mono text-[0.875rem] grid place-items-center shrink-0">
                {i + 1}
              </span>
              <span className="text-[1rem] text-ink leading-relaxed break-keep">{line}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => onFinish(exit)}
          className="w-full h-12 rounded-full border-2 border-accent-700 text-accent-800 text-[0.9375rem] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-100"
        >
          {tr(lang, '안내를 마치고 지금 하러 가기', 'Finish and do it now', '结束指南，现在就去设置')}
          <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-[0.75rem] text-slate-600 text-center">
          {tr(lang, '나중에 해도 괜찮아요. 「다음」을 누르면 다음 단계를 볼 수 있어요.', 'You can do it later – “Next” shows the next step.', '也可以以后再做，点「下一步」继续。')}
        </p>
      </div>
    );
  };

  let body: React.ReactNode = null;

  if (phase === 'welcome') {
    body = (
      <div className="space-y-6">
        <div className="space-y-3 pt-4">
          <span className="w-16 h-16 rounded-3xl bg-accent-700 text-paper grid place-items-center">
            <Hand className="w-8 h-8" strokeWidth={2.25} />
          </span>
          <h1 className="text-[1.625rem] font-extrabold text-ink leading-tight">
            {tr(lang, '틈틈에 오신 걸 환영해요', 'Welcome to TeumTeum', '欢迎使用 TeumTeum')}
          </h1>
          <p className="text-[1rem] text-slate-700 leading-relaxed break-keep">
            {tr(
              lang,
              '학교 · 학원 시간표, 일정, 출석, 메모를 한곳에서 관리하는 앱이에요. 사용 방법을 알려드릴까요?',
              'One place for school and academy timetables, events, attendance and memos. Shall we show you around?',
              '在一个地方管理学校、补习班课表、日程、出勤和备忘。要看看使用方法吗？'
            )}
          </p>
        </div>
        <div className="space-y-3">
          {bigChoice({
            icon: Sparkles,
            title: tr(lang, '처음이에요, 알려주세요', 'I’m new – show me', '第一次用，请教我'),
            hint: tr(lang, '화면 설명 → 처음 설정 순서 (3분 정도)', 'Screens, then setup steps (about 3 min)', '画面说明 → 初次设置（约3分钟）'),
            primary: true,
            onClick: () => {
              setPhase('tour');
              setIndex(0);
            },
          })}
          {bigChoice({
            icon: Rocket,
            title: tr(lang, '잘 알아요, 바로 시작할게요', 'I know my way – start', '我会用，直接开始'),
            hint: tr(lang, '안내는 설정 → 사용 가이드에서 언제든 볼 수 있어요', 'The guide stays in Settings → User guide', '指南可随时在 设置 → 使用指南 查看'),
            onClick: () => onFinish('timetable'),
          })}
        </div>
      </div>
    );
  } else if (phase === 'tour') {
    const slide = TOUR[index];
    const navItem = NAV.find((n) => n.id === slide.tab)!;
    const Icon = navItem.icon;
    body = (
      <div className="space-y-5">
        <p className="text-[0.8125rem] font-bold text-accent-800">
          {tr(lang, '화면 설명', 'The screens', '画面说明')}
        </p>
        <span className={`w-16 h-16 rounded-3xl text-paper grid place-items-center ${slide.tone}`}>
          <Icon className="w-8 h-8" strokeWidth={2.25} />
        </span>
        <h2 className="text-[1.375rem] font-bold text-ink leading-snug">{t(slide.title)}</h2>
        <ul className="space-y-3">
          {slide.lines.map((line, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-2 h-2 mt-[0.6rem] rounded-full bg-accent shrink-0" aria-hidden="true" />
              <span className="text-[1rem] text-ink leading-relaxed break-keep">{t(line)}</span>
            </li>
          ))}
        </ul>
        {/* Where it is: a copy of the bottom menu with this tab lit up */}
        <div className="space-y-1.5">
          <p className="text-[0.75rem] font-semibold text-slate-600">
            {tr(lang, `화면 맨 아래 「${navItem.ko}」 버튼을 누르면 돼요`, `Tap “${navItem.en}” at the bottom of the screen`, `点击屏幕底部的「${navItem.zh}」`)}
          </p>
          <div className="grid grid-cols-5 rounded-2xl bg-surface border border-divider px-1 py-1.5" aria-hidden="true">
            {NAV.map((n) => {
              const NIcon = n.icon;
              const on = n.id === slide.tab;
              return (
                <span
                  key={n.id}
                  className={`flex flex-col items-center gap-0.5 py-1 rounded-xl ${on ? 'bg-accent-100 text-accent-700 ring-2 ring-accent-600' : 'text-slate-400'}`}
                >
                  <NIcon className="w-5 h-5" strokeWidth={on ? 2.75 : 2} />
                  <span className="text-[0.625rem] font-bold">{tr(lang, n.ko, n.en, n.zh)}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  } else if (phase === 'setup') {
    const step = SETUP[index];
    const header = (
      <p className="text-[0.8125rem] font-bold text-accent-800">
        {tr(lang, '처음 설정', 'First setup', '初次设置')}
      </p>
    );
    if (step === 'text') {
      body = (
        <div className="space-y-5">
          {header}
          <span className="w-16 h-16 rounded-3xl bg-accent-700 text-paper grid place-items-center">
            <Type className="w-8 h-8" strokeWidth={2.25} />
          </span>
          <h2 className="text-[1.375rem] font-bold text-ink leading-snug">
            {tr(lang, '글자가 잘 보이나요?', 'Is the text easy to read?', '文字看得清楚吗？')}
          </h2>
          <p className="text-[1rem] text-slate-700 leading-relaxed">
            {tr(lang, '편한 크기를 눌러 보세요. 바로 바뀌어요.', 'Tap a size – it changes right away.', '点一下合适的大小，会立即改变。')}
          </p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup">
            {TEXT_SCALES.map((scale, i) => (
              <button
                key={scale}
                type="button"
                role="radio"
                aria-checked={textScale === scale}
                onClick={() => onUpdateState((prev) => ({ ...prev, textScale: scale as TextScale }))}
                className={`min-h-[72px] rounded-2xl flex flex-col items-center justify-center gap-1 ${
                  textScale === scale ? 'bg-accent-700 text-paper' : 'bg-surface text-ink border border-divider'
                }`}
              >
                <span className="font-bold leading-none" style={{ fontSize: `${(18 * scale) / 100}px` }} aria-hidden="true">
                  {tr(lang, '가', 'A', '字')}
                </span>
                <span className="text-[0.6875rem] font-semibold">
                  {[tr(lang, '기본', 'Default', '默认'), tr(lang, '크게', 'Large', '大'), tr(lang, '더 크게', 'Larger', '更大'), tr(lang, '최대', 'Largest', '最大')][i]}
                </span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-[0.875rem] font-bold text-ink">{tr(lang, '언어', 'Language', '语言')}</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {(
                [
                  ['ko', '한국어'],
                  ['en', 'English'],
                  ['zh', '中文'],
                ] as Array<[AppLanguage, string]>
              ).map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={lang === code}
                  onClick={() => onUpdateState((prev) => ({ ...prev, language: code }))}
                  className={`h-12 rounded-2xl text-[0.9375rem] font-bold ${
                    lang === code ? 'bg-accent-700 text-paper' : 'bg-surface text-ink border border-divider'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    } else if (step === 'sample') {
      body = (
        <div className="space-y-5">
          {header}
          <h2 className="text-[1.375rem] font-bold text-ink leading-snug">
            {tr(lang, '지금 보이는 시간표는 예시예요', 'The timetable you see is an example', '现在看到的课表是示例')}
          </h2>
          <p className="text-[1rem] text-slate-700 leading-relaxed break-keep">
            {tr(
              lang,
              '앱이 어떻게 보이는지 알려드리려고 넣어 둔 예시예요. 내 시간표를 넣으려면 예시를 비우고 시작하세요.',
              'It’s there to show how the app looks. To enter your own, start empty.',
              '这是为了展示应用效果的示例。要填写自己的课表，请清空后开始。'
            )}
          </p>
          <div className="space-y-3">
            {bigChoice({
              icon: Sparkles,
              title: tr(lang, '예시는 지우고 내 것으로 시작', 'Clear the example, start mine', '清除示例，开始填写我的'),
              hint: tr(lang, '시간표 · 일정 · 출석 · 메모가 비워져요 (수업 시간은 남아요)', 'Empties timetables, events, attendance and memos (class times stay)', '清空课表、日程、出勤、备忘（保留上课时间）'),
              selected: sampleChoice === 'clear',
              onClick: () => {
                if (sampleChoice !== 'clear') {
                  onUpdateState((prev) =>
                    resetPlannerParts(prev, ['school', 'academy', 'schedules', 'attendance', 'memos'], 'empty')
                  );
                }
                setSampleChoice('clear');
              },
            })}
            {bigChoice({
              icon: CalendarClock,
              title: tr(lang, '예시를 보면서 먼저 둘러볼게요', 'Keep it and look around first', '先保留示例看看'),
              hint: tr(lang, '나중에 설정 → 앱 초기화에서 지울 수 있어요', 'Clear it later in Settings → Reset', '以后可在 设置 → 重置应用 清除'),
              selected: sampleChoice === 'keep',
              onClick: () => setSampleChoice('keep'),
            })}
          </div>
        </div>
      );
    } else if (step === 'profile') {
      const field = (label: string, value: string, placeholder: string, onChange: (v: string) => void) => (
        <label className="block space-y-1.5">
          <span className="text-[0.875rem] font-bold text-ink">{label}</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-12 px-4 rounded-2xl bg-surface border border-divider text-[1rem] text-ink placeholder:text-slate-500 outline-none focus:border-accent"
          />
        </label>
      );
      body = (
        <div className="space-y-5">
          {header}
          <span className="w-16 h-16 rounded-3xl bg-sage-700 text-paper grid place-items-center">
            <IdCard className="w-8 h-8" strokeWidth={2.25} />
          </span>
          <h2 className="text-[1.375rem] font-bold text-ink leading-snug">
            {tr(lang, '누구의 플래너인가요?', 'Whose planner is this?', '这是谁的计划本？')}
          </h2>
          <p className="text-[0.9375rem] text-slate-700 leading-relaxed break-keep">
            {tr(
              lang,
              '시간표 맨 위에 이름이 보여요. 비워 둬도 괜찮아요. 자녀가 여럿이면 나중에 설정 → 자녀 선택에서 추가하세요.',
              'The name shows on the timetable. Optional. Several children? Add them later in Settings → Children.',
              '姓名会显示在课表顶部，可留空。有多个孩子时，以后在 设置 → 选择孩子 中添加。'
            )}
          </p>
          {field(tr(lang, '이름', 'Name', '姓名'), profile.name, tr(lang, '예: 김민준', 'e.g. Minjun', '例：金敏俊'), (v) => setProfile({ name: v }))}
          {field(tr(lang, '학교', 'School', '学校'), profile.school, tr(lang, '예: 한빛중학교', 'e.g. Hanbit Middle School', '例：韩光中学'), (v) => setProfile({ school: v }))}
          {field(tr(lang, '학년 · 반', 'Grade · class', '年级 · 班'), profile.grade, tr(lang, '예: 2학년 3반', 'e.g. Grade 8, Class 3', '例：初二3班'), (v) => setProfile({ grade: v }))}
        </div>
      );
    } else if (step === 'pool') {
      body = (
        <>
          {header}
          <div className="mt-5">
            {settingsStep(
              Tags,
              tr(lang, '과목과 학원 이름 정하기', 'Set your subjects and academies', '设置科目和补习班'),
              tr(lang, '설정 → 과목/수업 설정', 'Settings → Subjects & classes', '设置 → 科目/课程设置'),
              [
                tr(lang, '듣는 학교 과목과 다니는 학원 이름을 추가해요.', 'Add the subjects you take and the academies you attend.', '添加学校科目和补习班名称。'),
                tr(lang, '시간표를 채울 때 이 목록에서 눌러서 골라요.', 'You’ll pick from this list when filling timetables.', '填写课表时从这个列表中选择。'),
                tr(lang, '동그라미를 누르면 과목마다 색을 정할 수 있어요.', 'Tap the dot to give each a colour.', '点圆点可为每个科目设置颜色。'),
              ],
              'pool'
            )}
          </div>
        </>
      );
    } else if (step === 'school') {
      body = (
        <>
          {header}
          <div className="mt-5">
            {settingsStep(
              GraduationCap,
              tr(lang, '학교 시간표 넣기', 'Enter the school timetable', '填写学校课表'),
              tr(lang, '설정 → 학교 시간표', 'Settings → School timetable', '设置 → 学校课表'),
              [
                tr(lang, '먼저 1교시 시작 시간과 수업 · 쉬는 시간 길이를 정해요.', 'First set the first-period time and class/break lengths.', '先设置第一节开始时间和课长、课间。'),
                tr(lang, '표에서 칸(요일 × 교시)을 누르고 과목을 골라요.', 'Tap a cell (day × period) and pick the subject.', '点表格中的格子（星期 × 节次）选择科目。'),
                tr(lang, '「요일 통째로 복사」로 비슷한 요일을 빨리 채워요.', '“Copy a whole day” fills similar days fast.', '用「整天复制」快速填写相似的日子。'),
              ],
              'school'
            )}
          </div>
        </>
      );
    } else if (step === 'academy') {
      body = (
        <>
          {header}
          <div className="mt-5">
            {settingsStep(
              Building2,
              tr(lang, '학원 시간표 넣기', 'Add academy classes', '添加补习班课程'),
              tr(lang, '설정 → 학원 시간표', 'Settings → Academy timetable', '设置 → 补习班课表'),
              [
                tr(lang, '요일을 고르고 학원과 시작 · 끝 시간을 넣어요.', 'Pick a day, then the academy and its times.', '选择星期，再填写补习班和起止时间。'),
                tr(lang, '한 번 넣으면 매주 같은 요일에 반복돼요.', 'It repeats on that day every week.', '填写一次后每周重复。'),
                tr(lang, '보강은 시간표 화면의 「보강 추가」로 따로 넣어요.', 'Add makeups with “Add makeup” on the timetable.', '补课用课表画面的「添加补课」单独添加。'),
              ],
              'academy'
            )}
          </div>
        </>
      );
    } else if (step === 'reminders') {
      const on = Boolean(state.reminders?.enabled);
      body = (
        <div className="space-y-5">
          {header}
          <span className="w-16 h-16 rounded-3xl bg-accent-700 text-paper grid place-items-center">
            <BellRing className="w-8 h-8" strokeWidth={2.25} />
          </span>
          <h2 className="text-[1.375rem] font-bold text-ink leading-snug">
            {tr(lang, '보강 전에 알림을 받을까요?', 'Get a reminder before makeups?', '补课前要提醒吗？')}
          </h2>
          <p className="text-[1rem] text-slate-700 leading-relaxed break-keep">
            {tr(
              lang,
              '보강 · 특강이 시작하기 1시간 전에 휴대폰으로 알려줘요. 시간은 설정 → 보강 알림에서 바꿀 수 있어요.',
              'A phone alert an hour before each makeup. Change the time in Settings → Makeup reminders.',
              '补课开始前1小时发送手机提醒。可在 设置 → 补课提醒 中修改时间。'
            )}
          </p>
          {bigChoice({
            icon: BellRing,
            title: on ? tr(lang, '알림 켜짐', 'Reminders on', '提醒已开启') : tr(lang, '알림 켜기', 'Turn on reminders', '开启提醒'),
            hint: isNativeApp
              ? tr(lang, '알림 권한을 물어보면 「허용」을 눌러 주세요', 'Tap “Allow” when asked', '询问权限时请点「允许」')
              : tr(lang, '알림은 안드로이드 앱에서 와요', 'Reminders arrive in the Android app', '提醒在安卓应用中发送'),
            selected: on,
            onClick: async () => {
              if (on) {
                onUpdateState((prev) => ({ ...prev, reminders: { enabled: false, leadMinutes: prev.reminders?.leadMinutes ?? 60 } }));
                return;
              }
              const ok = await requestReminderPermission();
              setReminderDenied(!ok);
              if (ok) onUpdateState((prev) => ({ ...prev, reminders: { enabled: true, leadMinutes: prev.reminders?.leadMinutes ?? 60 } }));
            },
          })}
          {reminderDenied && (
            <p role="alert" className="rounded-2xl bg-accent-100 border border-accent-300 px-3 py-2 text-[0.8125rem] font-semibold text-accent-900 leading-snug">
              {tr(
                lang,
                '알림 권한이 꺼져 있어요. 휴대폰 설정 → 애플리케이션 → 틈틈 → 알림에서 허용해 주세요.',
                'Notifications are blocked. Allow them in phone Settings → Apps → TeumTeum → Notifications.',
                '通知权限已关闭，请在手机 设置 → 应用 → TeumTeum → 通知 中允许。'
              )}
            </p>
          )}
        </div>
      );
    }
  } else {
    body = (
      <div className="space-y-6 pt-4">
        <span className="w-16 h-16 rounded-3xl bg-sage-700 text-paper grid place-items-center">
          <Check className="w-8 h-8" strokeWidth={3} />
        </span>
        <h1 className="text-[1.625rem] font-extrabold text-ink leading-tight">
          {tr(lang, '준비가 끝났어요!', 'You’re all set!', '准备好了！')}
        </h1>
        <p className="text-[1rem] text-slate-700 leading-relaxed break-keep">
          {tr(
            lang,
            '다음으로 학교 시간표를 넣으면 「지금」 카드가 지금 수업을 알려줘요. 안내는 설정 → 맨 위 카드의 「처음 사용 안내」에서 언제든 다시 볼 수 있어요.',
            'Next, enter the school timetable and the “Now” card will follow your classes. Replay this anytime from Settings → “First-run guide”.',
            '接下来填写学校课表，「现在」卡片就会显示当前课程。可随时在 设置 → 顶部卡片的「初次使用指南」中重看。'
          )}
        </p>
        <div className="space-y-3">
          {bigChoice({
            icon: GraduationCap,
            title: tr(lang, '학교 시간표 넣으러 가기', 'Enter the school timetable', '去填写学校课表'),
            hint: tr(lang, '설정 → 학교 시간표가 열려요', 'Opens Settings → School timetable', '打开 设置 → 学校课表'),
            primary: true,
            onClick: () => onFinish('school'),
          })}
          {bigChoice({
            icon: CalendarClock,
            title: tr(lang, '시간표 화면으로 시작', 'Start on the timetable', '从课表画面开始'),
            hint: tr(lang, '나중에 천천히 넣을게요', 'I’ll fill it in later', '以后慢慢填写'),
            onClick: () => onFinish('timetable'),
          })}
        </div>
      </div>
    );
  }

  const stepping = phase === 'tour' || phase === 'setup';
  const isLast = phase === 'setup' && index === SETUP.length - 1;

  return (
    <div
      className="fixed inset-0 z-[60] bg-paper flex flex-col max-w-md mx-auto"
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, '처음 사용 안내', 'First-run guide', '初次使用指南')}
    >
      {/* Top: progress + skip */}
      <div className="flex-none h-14 px-4 flex items-center justify-between gap-3 border-b border-divider">
        {stepping ? (
          <div className="flex items-center gap-1.5" aria-label={`${index + 1} / ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-accent-700' : i < index ? 'w-2 bg-accent-300' : 'w-2 bg-slate-300'}`}
              />
            ))}
            <span className="ml-1.5 text-[0.75rem] font-mono text-slate-600 tabular-nums">
              {index + 1}/{total}
            </span>
          </div>
        ) : (
          <span className="text-[1.125rem] font-extrabold text-accent-700">{tr(lang, '틈틈', 'TeumTeum', 'TeumTeum')}</span>
        )}
        {phase !== 'done' && (
          <button
            type="button"
            onClick={() => onFinish('timetable')}
            className="h-9 px-3.5 rounded-full text-[0.875rem] font-bold text-slate-700 hover:bg-surface"
          >
            {tr(lang, '건너뛰기', 'Skip', '跳过')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">{body}</div>

      {stepping && (
        <div className="flex-none px-4 pt-3 pb-5 border-t border-divider grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={back}
            className="h-14 px-5 rounded-full bg-surface text-ink text-[1rem] font-bold inline-flex items-center gap-1 hover:bg-slate-200"
          >
            <ChevronLeft className="w-5 h-5" />
            {tr(lang, '이전', 'Back', '上一步')}
          </button>
          <button
            type="button"
            onClick={next}
            className="h-14 rounded-full bg-accent-700 text-paper text-[1.0625rem] font-bold inline-flex items-center justify-center gap-1 hover:bg-accent-800"
          >
            {phase === 'tour' && index === TOUR.length - 1
              ? tr(lang, '처음 설정 시작', 'Start setup', '开始设置')
              : isLast
              ? tr(lang, '마치기', 'Finish', '完成')
              : tr(lang, '다음', 'Next', '下一步')}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
