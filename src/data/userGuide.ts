// Settings → 사용 가이드: two ways in.
//  • FEATURE_GUIDE: what each bottom-menu tab can do.
//  • SETUP_GUIDE: the order to set the app up the first time (each step can jump to its settings card).

export interface L10n {
  ko: string;
  en: string;
  zh: string;
}

export type GuideMenu = 'timetable' | 'schedule' | 'attendance' | 'memo' | 'settings';

export interface FeatureGuideSection {
  menu: GuideMenu;
  name: L10n;
  summary: L10n;
  items: Array<{ title: L10n; desc: L10n }>;
}

/** Where a setup step lives: a settings card id, or 'top' for the settings header card. */
export type SetupTarget = 'top' | 'profile' | 'layout' | 'range' | 'school' | 'academy' | 'pool' | 'backup' | 'reminders' | 'widgets';

export interface SetupGuideStep {
  title: L10n;
  where: L10n;
  desc: L10n;
  target: SetupTarget;
  optional?: boolean;
}

export const FEATURE_GUIDE: FeatureGuideSection[] = [
  {
    menu: 'timetable',
    name: { ko: '시간표', en: 'Timetable', zh: '课程表' },
    summary: {
      ko: '학교·학원 시간표와 지금 할 일을 한눈에 봐요.',
      en: 'School and academy timetables, and what is happening now.',
      zh: '一眼看清学校、补习班课表和当前安排。',
    },
    items: [
      {
        title: { ko: '「지금」 카드', en: 'The “Now” card', zh: '「现在」卡片' },
        desc: {
          ko: '지금 수업과 다음 수업까지 남은 시간, 오늘의 보강·특강을 보여줘요. 이름을 누르면 내 정보를 고칠 수 있어요.',
          en: 'Shows the current class, time to the next one and today’s makeups. Tap the name to edit your profile.',
          zh: '显示当前课程、距下一节课的时间和今天的补课。点击姓名可修改个人信息。',
        },
      },
      {
        title: { ko: '일별 · 주간 · 월별', en: 'Day · Week · Month', zh: '日 · 周 · 月' },
        desc: {
          ko: '일별은 타임라인/목록형, 주간은 학교 표(월~금)와 학원(월~일), 월별은 달력으로 한 달을 봐요. 마지막에 고른 보기는 다음에 열어도 그대로예요.',
          en: 'Day shows a timeline or list, Week a school grid (Mon–Fri) and academies (Mon–Sun), Month a calendar. The last view you chose is remembered.',
          zh: '日视图为时间轴/列表，周视图为学校课表（周一至周五）和补习班（周一至周日），月视图为日历。会记住上次选择的视图。',
        },
      },
      {
        title: { ko: '그날만 바꾸기', en: 'Change just one day', zh: '只改当天' },
        desc: {
          ko: '수업 블록을 누르면 그날만 과목 변경, 휴강·결석·자습 표시, 메모를 남길 수 있어요. 기본 시간표는 그대로예요.',
          en: 'Tap a class to change the subject, mark cancelled/absent/self-study or add a note — for that day only.',
          zh: '点击课程块可仅修改当天：更换科目、标记停课/缺席/自习或添加备注，固定课表不变。',
        },
      },
      {
        title: { ko: '보강/특강 추가 · 수정', en: 'Add or edit makeups', zh: '添加/修改补课' },
        desc: {
          ko: '위쪽 「보강/특강 추가」에서 날짜를 골라 등록하고, 「등록된 보강/특강」 목록에서 눌러 고칠 수 있어요. 빈 시간을 눌러도 바로 추가돼요.',
          en: 'Use “Add makeup” at the top to pick any date, or tap one under “Registered makeups” to edit it. Tapping a free slot works too.',
          zh: '在顶部「添加补课/特讲」中选择日期登记，或在「已登记的补课」中点击修改。也可点击空闲时间直接添加。',
        },
      },
      {
        title: { ko: '시간 겹침 알림', en: 'Overlap warning', zh: '时间冲突提醒' },
        desc: {
          ko: '보강이나 일정이 다른 수업과 시간이 겹치면 저장 전에 팝업으로 알려줘요. 시간을 바꾸거나 그대로 저장할 수 있어요.',
          en: 'If a makeup or event overlaps another class, a popup warns you before saving. Change the time or save anyway.',
          zh: '补课或日程与其他课程时间冲突时，保存前会弹窗提醒，可修改时间或继续保存。',
        },
      },
      {
        title: { ko: '월별 달력에서 수정', en: 'Edit from the month view', zh: '在月历中修改' },
        desc: {
          ko: '월별에서 날짜를 누르면 아래에 그날 수업과 일정이 나와요. 눌러서 고치거나 「보강/특강」「일정」으로 바로 추가해요.',
          en: 'In Month, tap a date to list that day below. Tap an item to edit it, or add a makeup or event right there.',
          zh: '在月视图中点击日期，下方会列出当天安排，可点击修改，或直接添加补课、日程。',
        },
      },
      {
        title: { ko: '주간 보기에서 추가', en: 'Add from the week view', zh: '在周视图中添加' },
        desc: {
          ko: '주간 보기에도 「보강 추가」 버튼이 있어요. 학원 시간표에서 날짜 줄의 빈 곳이나 ＋를 누르면 그날 학원 수업을 넣고, 「보강 · 특강」인지 「일반 수업」인지 골라요.',
          en: 'The week view has “Makeup” too. In the academy timetable, tap a day’s free space or ＋ to add a class and choose “Makeup · special” or “Regular”.',
          zh: '周视图也有「加补课」按钮。在补习班课表中点某天的空白处或＋添加课程，并选择「补课 · 特讲」或「普通课程」。',
        },
      },
      {
        title: { ko: '과목 색과 화면 구성', en: 'Colours and layout', zh: '科目颜色与画面布局' },
        desc: {
          ko: '과목에 색을 정하면 시간표가 그 색으로 보여요. 설정 → 시간표 화면 구성에서 「지금」 카드나 칸의 순서를 바꾸거나 숨길 수 있어요.',
          en: 'Subject colours show on the timetable. Settings → Timetable layout reorders or hides the “Now” card and sections.',
          zh: '设置科目颜色后课表会以该颜色显示。在 设置 → 课表画面布局 中可调整或隐藏「现在」卡片和各板块。',
        },
      },
    ],
  },
  {
    menu: 'schedule',
    name: { ko: '일정표', en: 'Schedule', zh: '日程表' },
    summary: {
      ko: '시험·수행평가·학원 테스트 같은 일정을 관리해요.',
      en: 'Keep track of exams, assignments and academy tests.',
      zh: '管理考试、作业、补习班测验等日程。',
    },
    items: [
      {
        title: { ko: '다가오는 일정 (D-Day)', en: 'Coming up (D-Day)', zh: '即将到来（D-Day）' },
        desc: {
          ko: '가까운 일정을 D-Day와 함께 맨 위에 보여줘요. 오늘 일정은 따로 강조돼요.',
          en: 'The nearest events are shown on top with a D-Day count; today’s are highlighted.',
          zh: '最近的日程会带 D-Day 显示在顶部，今天的日程会突出显示。',
        },
      },
      {
        title: { ko: '월 · 주 · 일 보기와 구분 필터', en: 'Month · week · day and filters', zh: '月 · 周 · 日与分类筛选' },
        desc: {
          ko: '보기 방식과 학교·학원·기타 필터, 지난 일정 보기는 다음에 열어도 그대로 유지돼요.',
          en: 'The view, the school/academy/other filter and “show past” are remembered.',
          zh: '视图方式、学校/补习班/其他筛选和显示过去日程的设置都会被记住。',
        },
      },
      {
        title: { ko: '일정 추가 · 수정', en: 'Add and edit events', zh: '添加/修改日程' },
        desc: {
          ko: '제목, 날짜(여러 날이면 종료 날짜), 시간, 구분, 메모를 넣어요. 시간이 수업과 겹치면 알려줘요.',
          en: 'Enter a title, date (and end date for several days), time, category and note. Overlaps with classes are flagged.',
          zh: '填写标题、日期（多天可填结束日期）、时间、分类和备注。与课程冲突时会提醒。',
        },
      },
    ],
  },
  {
    menu: 'attendance',
    name: { ko: '출석표', en: 'Attendance', zh: '出勤表' },
    summary: {
      ko: '학교·학원 출석과 빠진 수업의 보강을 챙겨요.',
      en: 'Attendance for school and academies, and makeups for missed classes.',
      zh: '记录学校和补习班出勤，跟进缺课补课。',
    },
    items: [
      {
        title: { ko: '출석 체크', en: 'Check attendance', zh: '出勤打卡' },
        desc: {
          ko: '날짜를 고르고 수업마다 출석·지각·결석·휴강을 눌러요. 사유도 적을 수 있어요.',
          en: 'Pick a date and mark each class present, late, absent or cancelled, with an optional reason.',
          zh: '选择日期，为每节课标记出勤、迟到、缺席或停课，可填写原因。',
        },
      },
      {
        title: { ko: '보강 챙기기', en: 'Track makeups', zh: '跟进补课' },
        desc: {
          ko: '빠진 학원 수업은 「보강 필요」로 표시하고, 미완료 보강에서 보강 일정을 등록하면 시간표에 들어가요. 보강을 마치면 「보강 완료」를 누르고, 완료된 보강 이력에서 다시 볼 수 있어요.',
          en: 'Mark missed academy classes “needs makeup”, schedule the makeup (it goes on the timetable), then mark it done; completed ones stay in the history.',
          zh: '缺上的补习班课程可标记为「需补课」，登记补课时间后会加入课表，补课后标记完成，可在完成记录中查看。',
        },
      },
      {
        title: { ko: '완료된 보강 이력', en: 'Completed makeups', zh: '已完成补课记录' },
        desc: {
          ko: '「완료된 보강 이력」을 펼치면 결석한 날과 보강한 날이 함께 보여요. 잘못 눌렀으면 「완료 취소」를 눌러요.',
          en: 'Unfold “Completed makeups” to see the missed and makeup dates. Tap “Undo” if you marked one by mistake.',
          zh: '展开「已完成补课记录」可看到缺课日和补课日。误点时可点「撤销」。',
        },
      },
      {
        title: { ko: '월별 출석 현황', en: 'Monthly overview', zh: '月度出勤概况' },
        desc: {
          ko: '출석·지각·결석·보강 대기 숫자를 누르면 날짜별 이력이 팝업으로 나와요. 줄을 누르면 그 날짜로 이동해요.',
          en: 'Tap the present/late/absent/pending numbers to see a dated history. Tap a row to jump to that day.',
          zh: '点击出勤/迟到/缺席/待补课数字可查看按日期的记录，点击某行可跳到该日期。',
        },
      },
    ],
  },
  {
    menu: 'memo',
    name: { ko: '메모장', en: 'Memo', zh: '备忘录' },
    summary: {
      ko: '하루 한 장, 날짜별로 기록해요.',
      en: 'One page a day, filed by date.',
      zh: '每天一页，按日期记录。',
    },
    items: [
      {
        title: { ko: '날짜별 메모', en: 'Daily memo', zh: '每日备忘' },
        desc: {
          ko: '날짜를 고르고 적으면 자동으로 저장돼요. 할 일·숙제·준비물·시험 태그를 눌러 빠르게 쓸 수 있어요.',
          en: 'Pick a date and type — it saves automatically. Tags for to-do, homework, supplies and exams speed things up.',
          zh: '选择日期后输入即可自动保存。可用待办、作业、准备物、考试标签快速记录。',
        },
      },
      {
        title: { ko: '달력과 검색', en: 'Calendar and search', zh: '日历与搜索' },
        desc: {
          ko: '메모 달력에서 메모가 있는 날을 보고, 검색으로 지난 메모를 찾아요.',
          en: 'The memo calendar marks days with notes; search finds older ones.',
          zh: '备忘日历会标出有备忘的日期，搜索可查找过去的备忘。',
        },
      },
    ],
  },
  {
    menu: 'settings',
    name: { ko: '설정', en: 'Settings', zh: '设置' },
    summary: {
      ko: '시간표 틀, 데이터, 알림, 위젯을 관리해요.',
      en: 'Timetable setup, data, reminders and widgets.',
      zh: '管理课表框架、数据、提醒和小组件。',
    },
    items: [
      {
        title: { ko: '맨 위 카드', en: 'Top card', zh: '顶部卡片' },
        desc: {
          ko: '언어, 글자 크기, 자녀 선택, 사용 가이드, 처음 사용 안내(화면 설명·처음 설정 다시 보기), 앱 초기화(항목을 골라 지우기)가 있어요.',
          en: 'Language, text size, children, this guide, the first-run guide (replay), and reset (pick what to clear).',
          zh: '包括语言、字体大小、选择孩子、使用指南、初次使用指南（重看）和应用重置（可选择清除内容）。',
        },
      },
      {
        title: { ko: '시간표 설정', en: 'Timetable setup', zh: '课表设置' },
        desc: {
          ko: '학교 수업 시간(자동 계산 또는 교시별 직접 입력·점심시간), 학교·학원 기본 시간표, 표시 범위를 정해요. 「시간표 화면 구성」에서 시간표 메뉴의 칸 순서를 바꾸거나 숨길 수 있어요.',
          en: 'Class times (auto or per period, with lunch), the weekly school and academy timetables, and the visible time range. “Timetable layout” reorders or hides the timetable’s sections.',
          zh: '设置上课时间（自动计算或逐节输入，含午休）、学校和补习班固定课表、显示时间范围。在「课表画面布局」中可调整或隐藏课表板块。',
        },
      },
      {
        title: { ko: '과목/수업 설정 · 색상', en: 'Subjects and colours', zh: '科目/课程设置与颜色' },
        desc: {
          ko: '자주 쓰는 과목을 모아 두고, 동그라미를 눌러 과목마다 색을 정하면 시간표에 그 색으로 보여요.',
          en: 'Keep your usual subjects here; tap the dot to give each a colour used across the timetable.',
          zh: '保存常用科目，点击圆点为每个科目设置颜色，课表中会用该颜色显示。',
        },
      },
      {
        title: { ko: '되돌리기 · 모두 지우기', en: 'Restore or clear a section', zh: '恢复默认 · 全部清除' },
        desc: {
          ko: '과목/수업 · 학교 시간표 · 학원 시간표 아래에 「이 섹션 기본값으로 되돌리기」와 「모든 설정값 지우기」가 있어요. 누르면 한 번 더 확인해요.',
          en: 'Subjects, School and Academy timetable each have “Restore defaults” and “Clear everything” at the bottom, with a confirmation.',
          zh: '科目/课程、学校课表、补习班课表下方都有「恢复默认」和「清除全部设置」，点击后会再次确认。',
        },
      },
      {
        title: { ko: '백업 · 복원', en: 'Backup & restore', zh: '备份与恢复' },
        desc: {
          ko: '「데이터 내보내기 (보내기·저장)」를 누르면 공유 창이 떠서 카카오톡·메일로 보내거나 내 파일·드라이브에 저장해요. 불러올 때는 원하는 항목만 골라 적용하고, 친구·가족이 보낸 파일을 새 자녀로 추가할 수도 있어요.',
          en: '“Export” opens the share sheet to send it or save it to Files / Drive. When importing, apply only what you pick; a file from someone else can become a new child.',
          zh: '点「导出（发送·保存）」会打开分享窗口，可通过聊天软件、邮件发送，或保存到我的文件/云端硬盘。导入时只应用所选内容，也可把他人发来的文件添加为新孩子。',
        },
      },
      {
        title: { ko: '보강 알림 · 위젯', en: 'Reminders and widgets', zh: '补课提醒与小组件' },
        desc: {
          ko: '보강·특강 전에 휴대폰 알림을 받고(10분~하루 전), 홈 화면 위젯 5종을 테마·글자 크기와 함께 추가해요.',
          en: 'Get a phone alert before makeups (10 min to a day ahead) and add five home-screen widgets with theme and text size.',
          zh: '在补课前收到手机提醒（提前10分钟至1天），并添加5种主屏幕小组件，可调主题和字体大小。',
        },
      },
      {
        title: { ko: '업데이트 이력', en: 'Update history', zh: '更新记录' },
        desc: {
          ko: '앱 맨 아래 「업데이트 이력」에서 버전마다 무엇이 바뀌었는지 볼 수 있어요.',
          en: '“Update history” at the bottom lists what changed in each version.',
          zh: '底部的「更新记录」列出每个版本的变化。',
        },
      },
    ],
  },
];

export const SETUP_GUIDE: SetupGuideStep[] = [
  {
    target: 'top',
    title: { ko: '언어와 글자 크기', en: 'Language and text size', zh: '语言和字体大小' },
    where: { ko: '설정 맨 위 카드', en: 'Settings · top card', zh: '设置 · 顶部卡片' },
    desc: {
      ko: '편한 언어를 고르고, 글씨가 작으면 글자 크기를 키워요.',
      en: 'Choose your language, and make the text bigger if needed.',
      zh: '选择语言，字太小可以调大字体。',
    },
  },
  {
    target: 'top',
    optional: true,
    title: { ko: '예시 데이터 지우기', en: 'Clear the example data', zh: '清除示例数据' },
    where: { ko: '설정 맨 위 카드 → 앱 초기화', en: 'Settings · top card → Reset app', zh: '设置 · 顶部卡片 → 重置应用' },
    desc: {
      ko: '처음 보이는 시간표·일정·출석·메모는 예시예요. 학교·학원 시간표, 일정, 출석, 메모를 골라 「빈 상태로」 지우고 내 것으로 시작해요.',
      en: 'The first timetable, events, attendance and memos are examples. Pick them in “Reset app” and clear them to start your own.',
      zh: '一开始看到的课表、日程、出勤、备忘是示例。在「重置应用」中选择并清空，即可开始填写自己的。',
    },
  },
  {
    target: 'top',
    optional: true,
    title: { ko: '자녀 추가 (부모님)', en: 'Add children (parents)', zh: '添加孩子（家长）' },
    where: { ko: '설정 맨 위 카드 → 자녀 선택', en: 'Settings · top card → Children', zh: '设置 · 顶部卡片 → 选择孩子' },
    desc: {
      ko: '자녀가 여럿이면 자녀를 추가하고 한 명씩 골라서 아래 단계를 진행해요. 위쪽 이름을 눌러 언제든 바꿀 수 있어요.',
      en: 'With several children, add each one, select them in turn and follow the steps below. Tap the name in the header to switch any time.',
      zh: '有多个孩子时，先逐一添加，再依次选择并完成以下步骤。随时点击顶部姓名即可切换。',
    },
  },
  {
    target: 'profile',
    title: { ko: '내 정보', en: 'Profile', zh: '我的信息' },
    where: { ko: '설정 → 내 정보', en: 'Settings → Profile', zh: '设置 → 我的信息' },
    desc: {
      ko: '이름·학교·학년을 넣으면 시간표 「지금」 카드에 보여요.',
      en: 'Name, school and grade appear on the timetable’s “Now” card.',
      zh: '填写姓名、学校、年级后会显示在课表的「现在」卡片上。',
    },
  },
  {
    target: 'pool',
    title: { ko: '과목/수업 정하기', en: 'Set up subjects', zh: '设置科目/课程' },
    where: { ko: '설정 → 과목/수업 설정', en: 'Settings → Subjects & classes', zh: '设置 → 科目/课程设置' },
    desc: {
      ko: '자주 쓰는 학교 과목과 학원을 등록해요. 시간표를 채울 때 빠른 선택 버튼으로 나와요. 동그라미를 눌러 과목마다 색도 정할 수 있어요.',
      en: 'Add your school subjects and academies; they appear as quick picks when filling timetables. Tap the dot to give each a colour.',
      zh: '登记常用的学校科目和补习班，填写课表时会作为快捷按钮出现。点击圆点可为每个科目设置颜色。',
    },
  },
  {
    target: 'school',
    title: { ko: '학교 수업 시간', en: 'School class times', zh: '学校上课时间' },
    where: { ko: '설정 → 학교 시간표 → 수업 시간', en: 'Settings → School timetable → Class times', zh: '设置 → 学校课表 → 上课时间' },
    desc: {
      ko: '1교시 시작·수업 길이·쉬는 시간·점심으로 자동 계산하거나, 「교시별 직접 입력」에서 교시마다 시간과 점심시간을 정해요.',
      en: 'Let it calculate from the first start, class length, break and lunch — or use “per period” to set each period and the lunch break.',
      zh: '可根据第一节开始时间、课长、课间和午休自动计算，或在「逐节输入」中设置每节时间和午休。',
    },
  },
  {
    target: 'school',
    title: { ko: '학교 시간표 입력', en: 'Fill in the school timetable', zh: '填写学校课表' },
    where: { ko: '설정 → 학교 시간표', en: 'Settings → School timetable', zh: '设置 → 学校课表' },
    desc: {
      ko: '표에서 칸을 누르고 과목을 골라요. 「요일 통째로 복사」로 비슷한 요일을 빠르게 채울 수 있어요.',
      en: 'Tap a cell and pick a subject. “Copy a whole day” fills similar days quickly.',
      zh: '点击格子选择科目。「整天复制」可快速填充相似的日子。',
    },
  },
  {
    target: 'academy',
    title: { ko: '학원 시간표 입력', en: 'Add academy classes', zh: '添加补习班课程' },
    where: { ko: '설정 → 학원 시간표', en: 'Settings → Academy timetable', zh: '设置 → 补习班课表' },
    desc: {
      ko: '요일을 고르고 학원 이름과 시작·끝 시간을 넣어요. 매주 반복돼요.',
      en: 'Pick a day and enter the academy and its start and end time. It repeats every week.',
      zh: '选择星期，填写补习班名称和起止时间，每周重复。',
    },
  },
  {
    target: 'reminders',
    optional: true,
    title: { ko: '보강 알림 켜기', en: 'Turn on makeup reminders', zh: '开启补课提醒' },
    where: { ko: '설정 → 보강 알림', en: 'Settings → Makeup reminders', zh: '设置 → 补课提醒' },
    desc: {
      ko: '알림을 켜고 언제 알려줄지 골라요. 처음 켤 때 알림 권한을 허용해 주세요.',
      en: 'Switch it on and choose when to be reminded. Allow notifications when asked.',
      zh: '开启提醒并选择提醒时间。首次开启时请允许通知权限。',
    },
  },
  {
    target: 'widgets',
    optional: true,
    title: { ko: '홈 화면 위젯 추가', en: 'Add home-screen widgets', zh: '添加主屏幕小组件' },
    where: { ko: '설정 → 홈 화면 위젯', en: 'Settings → Home screen widgets', zh: '设置 → 主屏幕小组件' },
    desc: {
      ko: '테마와 글자 크기를 고르고 원하는 위젯의 「홈 화면에 추가」를 눌러요.',
      en: 'Choose a theme and text size, then tap “Add to home screen” on the widgets you want.',
      zh: '选择主题和字体大小，然后点击所需小组件的「添加到主屏幕」。',
    },
  },
  {
    target: 'backup',
    title: { ko: '백업해 두기', en: 'Make a backup', zh: '做好备份' },
    where: { ko: '설정 → 백업 · 복원', en: 'Settings → Backup & restore', zh: '设置 → 备份与恢复' },
    desc: {
      ko: '다 입력했으면 「데이터 내보내기 (보내기·저장)」를 눌러 공유 창에서 내 파일·드라이브에 저장하거나 가족에게 보내요. 휴대폰을 바꿀 때도 써요.',
      en: 'When you’re done, tap “Export” and save it to Files / Drive or send it to family from the share sheet. Handy when switching phones.',
      zh: '填写完成后点「导出（发送·保存）」，在分享窗口中保存到我的文件/云端硬盘或发给家人。换手机时也能用。',
    },
  },
  {
    target: 'layout',
    optional: true,
    title: { ko: '시간표 화면 꾸미기', en: 'Arrange the timetable screen', zh: '调整课表画面' },
    where: { ko: '설정 → 시간표 화면 구성', en: 'Settings → Timetable layout', zh: '设置 → 课表画面布局' },
    desc: {
      ko: '↑↓로 「지금」 카드나 칸의 순서를 바꾸고, 안 쓰는 칸은 스위치로 숨겨요.',
      en: 'Use ↑↓ to reorder the “Now” card and sections, and switch off the ones you don’t use.',
      zh: '用 ↑↓ 调整「现在」卡片和各板块的顺序，不用的可用开关隐藏。',
    },
  },
];
