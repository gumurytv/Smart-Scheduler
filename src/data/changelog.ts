// Settings → 앱 → 업데이트 이력. Newest first; the first entry is the current app version.
// Add an entry (and bump versionCode/versionName in android/app/build.gradle) for every Play release.
import type { L10n } from './userGuide';

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  items: L10n[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-10-18',
    items: [
      {
        ko: '출석표: 결석한 학원 보강의 일정을 등록하면 시간표에 보강으로 들어가요. 등록 후 「보강 완료」를 누를 수 있어요',
        en: 'Attendance: schedule the makeup for a missed class; it goes on the timetable, then mark it done',
        zh: '出勤表：为缺上的课登记补课时间，会加入课表，之后可标记完成',
      },
      {
        ko: '출석표: 완료된 보강 이력을 펼쳐서 볼 수 있어요',
        en: 'Attendance: a list of completed makeups',
        zh: '出勤表：可查看已完成的补课记录',
      },
      {
        ko: '시간표 주간: 「보강 추가」 버튼, 학원 칸의 빈 곳을 눌러 학원 수업 추가 (보강·특강 / 일반 수업 선택)',
        en: 'Timetable week view: “Makeup” button, and tap a day’s free space to add a class (makeup or regular)',
        zh: '课表周视图：「加补课」按钮，点击空白处添加课程（补课或普通课程）',
      },
      {
        ko: '시간표 주간: 섹션 이름을 「학교 시간표」, 「학원 시간표」로 정리',
        en: 'Timetable week view: sections renamed to “School timetable” and “Academy timetable”',
        zh: '课表周视图：板块名称改为「学校课表」「补习班课表」',
      },
      {
        ko: '설정: 업데이트 이력 추가',
        en: 'Settings: update history',
        zh: '设置：新增更新记录',
      },
    ],
  },
  {
    version: '1.2.1',
    date: '2026-10-17',
    items: [
      {
        ko: '설정: 시간표 화면 구성 (칸 순서 바꾸기·숨기기)',
        en: 'Settings: timetable layout (reorder and hide sections)',
        zh: '设置：课表画面布局（调整顺序、隐藏板块）',
      },
      {
        ko: '설정: 「과목 후보군」을 「과목/수업 설정」으로 바꾸고 맨 앞으로, 섹션별 「모든 설정값 지우기」',
        en: 'Settings: “Subjects & classes” moved first; “Clear everything” per section',
        zh: '设置：「科目/课程设置」移到最前，各部分新增「清除全部设置」',
      },
      {
        ko: '큰 글씨에서 백업·복원 버튼 글자가 줄바꿈되던 문제 수정',
        en: 'Fixed backup button labels wrapping at large text sizes',
        zh: '修复大字体下备份按钮文字换行的问题',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-17',
    items: [
      { ko: '홈 화면 위젯 5종 (테마·글자 크기 설정)', en: 'Five home-screen widgets (theme and text size)', zh: '5种主屏幕小组件（主题、字体大小）' },
      { ko: '보강 알림: 보강·특강 전에 휴대폰 알림 (10분 전 ~ 하루 전)', en: 'Makeup reminders (10 minutes to a day before)', zh: '补课提醒（提前10分钟至1天）' },
      { ko: '시간표 월별 보기, 원하는 날짜에 보강 등록·수정, 시간 겹침 알림', en: 'Month view, makeups on any date, overlap warnings', zh: '月视图、任意日期登记补课、时间冲突提醒' },
      { ko: '자녀 여러 명 관리, 과목별 색상', en: 'Several children, subject colours', zh: '多个孩子管理、科目颜色' },
      { ko: '출석 이력 보기, 교시별 입력의 점심시간, 백업 골라서 불러오기', en: 'Attendance history, lunch in per-period mode, selective import', zh: '出勤记录、逐节输入的午休、选择性导入' },
      { ko: '사용 가이드, 앱 초기화(항목 골라서), 마지막 보기 설정 기억', en: 'User guide, selective reset, remembered views', zh: '使用指南、选择性重置、记住视图' },
    ],
  },
  {
    version: '1.0',
    date: '2026-10-16',
    items: [
      { ko: '첫 비공개 테스트: 시간표 · 일정표 · 출석표 · 메모장', en: 'First closed test: timetable, schedule, attendance, memo', zh: '首次封闭测试：课表、日程表、出勤表、备忘录' },
      { ko: '「지금」 카드, 글자 크기 조절, 한국어 · English · 中文', en: '“Now” card, text size, Korean · English · Chinese', zh: '「现在」卡片、字体大小、韩语 · 英语 · 中文' },
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
