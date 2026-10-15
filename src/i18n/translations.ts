import { AppLanguage, DayOfWeek } from '../types';

export function tr(lang: AppLanguage | undefined, ko: string, en: string, zh: string): string {
  const l = lang || 'ko';
  if (l === 'en') return en;
  if (l === 'zh') return zh;
  return ko;
}

const DAY_MAP: Record<DayOfWeek, { ko: string; en: string; zh: string }> = {
  월: { ko: '월', en: 'Mon', zh: '周一' },
  화: { ko: '화', en: 'Tue', zh: '周二' },
  수: { ko: '수', en: 'Wed', zh: '周三' },
  목: { ko: '목', en: 'Thu', zh: '周四' },
  금: { ko: '금', en: 'Fri', zh: '周五' },
  토: { ko: '토', en: 'Sat', zh: '周六' },
  일: { ko: '일', en: 'Sun', zh: '周日' },
};

export function translateDay(day: DayOfWeek | string, lang: AppLanguage | undefined): string {
  const entry = DAY_MAP[day as DayOfWeek];
  if (!entry) return day;
  return tr(lang, entry.ko, entry.en, entry.zh);
}

const SUBJECT_DICT: Record<string, { en: string; zh: string }> = {
  // School subjects (core)
  국어: { en: 'Korean', zh: '语文' },
  수학: { en: 'Math', zh: '数学' },
  영어: { en: 'English', zh: '英语' },
  과학: { en: 'Science', zh: '科学' },
  사회: { en: 'Social Studies', zh: '社会' },
  한국사: { en: 'Korean History', zh: '韩国史' },
  역사: { en: 'History', zh: '历史' },
  체육: { en: 'P.E.', zh: '体育' },
  음악: { en: 'Music', zh: '音乐' },
  미술: { en: 'Art', zh: '美术' },
  정보: { en: 'Computer Sci', zh: '信息技术' },
  도덕: { en: 'Ethics', zh: '道德' },
  윤리: { en: 'Ethics', zh: '伦理' },
  기술가정: { en: 'Tech & Home Ec', zh: '技术家政' },
  '기술·가정': { en: 'Tech & Home Ec', zh: '技术家政' },
  기가: { en: 'Tech & Home Ec', zh: '技术家政' },
  제2외국어: { en: '2nd Foreign Lang', zh: '第二外语' },
  일본어: { en: 'Japanese', zh: '日语' },
  중국어: { en: 'Chinese', zh: '汉语' },
  스페인어: { en: 'Spanish', zh: '西班牙语' },
  프랑스어: { en: 'French', zh: '法语' },
  독일어: { en: 'German', zh: '德语' },
  한문: { en: 'Classical Chinese', zh: '汉文' },
  진로: { en: 'Career', zh: '生涯规划' },
  // High-school electives
  통합사회: { en: 'Integrated Social St.', zh: '综合社会' },
  통합과학: { en: 'Integrated Science', zh: '综合科学' },
  물리: { en: 'Physics', zh: '物理' },
  물리학: { en: 'Physics', zh: '物理' },
  화학: { en: 'Chemistry', zh: '化学' },
  생명과학: { en: 'Life Science', zh: '生命科学' },
  생물: { en: 'Biology', zh: '生物' },
  지구과학: { en: 'Earth Science', zh: '地球科学' },
  지리: { en: 'Geography', zh: '地理' },
  세계사: { en: 'World History', zh: '世界史' },
  경제: { en: 'Economics', zh: '经济' },
  정치와법: { en: 'Politics & Law', zh: '政治与法律' },
  문학: { en: 'Literature', zh: '文学' },
  독서: { en: 'Reading', zh: '阅读' },
  화법과작문: { en: 'Speech & Writing', zh: '演讲与写作' },
  언어와매체: { en: 'Language & Media', zh: '语言与媒体' },
  미적분: { en: 'Calculus', zh: '微积分' },
  확률과통계: { en: 'Prob. & Statistics', zh: '概率与统计' },
  기하: { en: 'Geometry', zh: '几何' },
  영어회화: { en: 'English Conversation', zh: '英语会话' },
  // Non-subject periods
  창체: { en: 'Creative Act.', zh: '创意活动' },
  창의적체험활동: { en: 'Creative Act.', zh: '创意活动' },
  자율: { en: 'Autonomous Act.', zh: '自律活动' },
  자율활동: { en: 'Autonomous Act.', zh: '自律活动' },
  진로활동: { en: 'Career Act.', zh: '生涯活动' },
  봉사활동: { en: 'Volunteering', zh: '志愿活动' },
  동아리: { en: 'Club Activity', zh: '社团活动' },
  자습: { en: 'Self-Study', zh: '自习' },
  자율학습: { en: 'Self-Study', zh: '自习' },
  야자: { en: 'Evening Self-Study', zh: '晚自习' },
  야간자율학습: { en: 'Evening Self-Study', zh: '晚自习' },
  방과후: { en: 'After-School', zh: '课后班' },
  방과후수업: { en: 'After-School Class', zh: '课后班' },
  조회: { en: 'Homeroom', zh: '早会' },
  종례: { en: 'Closing Homeroom', zh: '终礼' },
  점심: { en: 'Lunch', zh: '午餐' },
  점심시간: { en: 'Lunch', zh: '午休' },
  공강: { en: 'Free Period', zh: '空堂' },
  // Academies
  수학학원: { en: 'Math Academy', zh: '数学补习班' },
  영어학원: { en: 'English Academy', zh: '英语补习班' },
  과학학원: { en: 'Science Academy', zh: '科学补习班' },
  국어학원: { en: 'Korean Academy', zh: '语文补习班' },
  논술학원: { en: 'Essay Academy', zh: '论述写作班' },
  코딩학원: { en: 'Coding Academy', zh: '编程补习班' },
  피아노학원: { en: 'Piano Academy', zh: '钢琴班' },
  미술학원: { en: 'Art Academy', zh: '美术班' },
  음악학원: { en: 'Music Academy', zh: '音乐班' },
  태권도: { en: 'Taekwondo', zh: '跆拳道' },
  태권도학원: { en: 'Taekwondo Academy', zh: '跆拳道馆' },
  수영: { en: 'Swimming', zh: '游泳' },
  수영학원: { en: 'Swimming Academy', zh: '游泳班' },
  체육학원: { en: 'Sports Academy', zh: '体育班' },
  보습학원: { en: 'Tutoring Academy', zh: '综合补习班' },
  종합학원: { en: 'Cram School', zh: '综合补习班' },
  입시학원: { en: 'Admissions Academy', zh: '升学补习班' },
  독서실: { en: 'Study Room', zh: '自习室' },
  스터디카페: { en: 'Study Cafe', zh: '自习咖啡馆' },
  과외: { en: 'Private Tutoring', zh: '家教' },
  인강: { en: 'Online Lecture', zh: '网课' },
  학습지: { en: 'Workbook Tutor', zh: '学习辅导' },
};

const ACADEMY_SUFFIXES: Array<{ suffix: string; en: string; zh: string }> = [
  { suffix: '학원', en: 'Academy', zh: '补习班' },
  { suffix: '과외', en: 'Tutoring', zh: '家教' },
  { suffix: '특강', en: 'Special Class', zh: '特讲' },
  { suffix: '보강', en: 'Makeup', zh: '补课' },
];

function lookupSubject(key: string, lang: 'en' | 'zh'): string | null {
  const entry = SUBJECT_DICT[key];
  if (entry) return entry[lang];
  return null;
}

/**
 * Translate a subject / academy name for display. State always keeps the
 * original (Korean) name; this only affects rendering. Unknown user-entered
 * names are returned as-is.
 */
export function translateSubject(subject: string, lang: AppLanguage | undefined): string {
  if (!subject || !lang || lang === 'ko') return subject;
  const trimmed = subject.trim();
  const l = lang === 'en' ? 'en' : 'zh';

  // 1) exact match, then whitespace-insensitive match (e.g. '수학 학원')
  const exact = lookupSubject(trimmed, l);
  if (exact) return exact;
  const compact = trimmed.replace(/\s+/g, '');
  const compactHit = lookupSubject(compact, l);
  if (compactHit) return compactHit;

  // 2) known subject + academy-style suffix (e.g. '물리학원' -> 'Physics Academy')
  for (const { suffix, en, zh } of ACADEMY_SUFFIXES) {
    if (compact.length > suffix.length && compact.endsWith(suffix)) {
      const base = lookupSubject(compact.slice(0, -suffix.length), l);
      if (base) return l === 'en' ? `${base} ${en}` : `${base}${zh}`;
    }
  }

  // 3) user-entered name: keep as typed
  return subject;
}

const SAMPLE_TEXT_DICT: Record<string, { en: string; zh: string }> = {
  // Sample schedule titles & memos
  '영어 듣기 수행평가': {
    en: 'English Listening Assessment',
    zh: '英语听力随堂测评',
  },
  '1~3단원 핵심 어휘 및 딕테이션 복습 필수': {
    en: 'Review core vocabulary & dictation for Units 1-3',
    zh: '必须复习第1~3单元核心词汇及听写',
  },
  '수학학원 월말 레벨테스트': {
    en: 'Math Academy Monthly Level Test',
    zh: '数学补习班月末水平测试',
  },
  '이차방정식과 함수 심화 범위, 오답노트 지참': {
    en: 'Quadratic equations & functions advanced scope; bring error notebook',
    zh: '二次方程与函数深化范围，请携带错题本',
  },
  '2학기 중간고사 기간': {
    en: '2nd Semester Midterm Exams',
    zh: '第二学期期中考试周',
  },
  '전 과목 시험 범위 요약본 3회독 목표': {
    en: 'Goal: Read all subject summary notes 3 times',
    zh: '目标：全科考试范围总结复习3遍',
  },
  '교내 과학 탐구 토론 대회': {
    en: 'School Science Debate Contest',
    zh: '校内科学探究辩论大赛',
  },
  '과학실 2층, 발표 슬라이드 USB 챙기기': {
    en: '2nd Floor Science Lab, bring presentation USB drive',
    zh: '二楼科学实验室，记得带演示文稿U盘',
  },
  '치과 정기 검진 및 교정 진료': {
    en: 'Dental Checkup & Orthodontics',
    zh: '牙科定期检查与矫正复诊',
  },
  '학원 가기 전 들르기 (예약 완료)': {
    en: 'Visit before going to academy (Appointment confirmed)',
    zh: '去补习班前先去诊所（已预约）',
  },
  // Sample attendance reasons
  '학교 청소 당번으로 15분 늦음': {
    en: '15 mins late due to classroom cleaning duty',
    zh: '因学校值日打扫迟到15分钟',
  },
  '감기 몸살 및 병원 진료': {
    en: 'Cold/body ache & clinic visit',
    zh: '感冒发烧去医院就诊',
  },
  '학원 강사님 세미나 공식휴강': {
    en: 'Official cancellation for instructor seminar',
    zh: '讲师参加研讨会官方停课',
  },
  '우천으로 인한 마을버스 지연': {
    en: 'Local bus delayed due to heavy rain',
    zh: '因降雨导致社区巴士延误',
  },
  '가족 행사 참석': {
    en: 'Attended family event',
    zh: '参加家庭聚会活动',
  },
  '개교기념일 재량휴업일 (공식휴강)': {
    en: 'School Foundation Day Holiday (Official Off)',
    zh: '校庆纪念日放假（官方停课）',
  },
  '학교 수행평가 팀 프로젝트 모임': {
    en: 'School team project meeting',
    zh: '学校随堂评价小组项目会议',
  },
  '저녁 식사 후 이동 지연': {
    en: 'Transit delay after dinner',
    zh: '晚餐后交通移动延误',
  },
  // Sample memos
  '오늘 체크리스트:\n1. 영어 수행평가 발표 대본 3번 소리내어 읽기\n2. 수학학원 숙제 (심화교재 p.74~82 오답노트 정리)\n3. 과학 실험 보고서 프린트 파일철에 끼워두기\n4. 저녁에 단어장 Day 14~15 암기 테스트 준비!': {
    en: "Today's Checklist:\n1. Read English presentation script aloud 3 times\n2. Math Academy homework (Advanced workbook p.74-82 error notes)\n3. File the Science Lab report printout\n4. Prepare for Vocab Day 14-15 quiz tonight!",
    zh: '今日待办清单：\n1. 英语随堂评价演讲稿大声朗读3遍\n2. 数学补习班作业（深化教材 p.74~82 错题本整理）\n3. 将科学实验报告打印件装入文件夹\n4. 晚上准备单词书 Day 14~15 默写测试！',
  },
  '수학 함수 단원 심화 문제 풀이 중 이차함수 최대·최소 활용 유형이 헷갈렸다. 학원 선생님께 질문해서 그래프 축의 방정식 범위를 나누는 법을 완벽히 이해함! 내일 다시 3문제 풀어보기.': {
    en: 'While solving advanced math function problems, I was confused about quadratic min/max word problems. Asked the academy teacher and mastered how to split intervals by the axis of symmetry! Will solve 3 more problems tomorrow.',
    zh: '在解数学函数单元深化题时，对二次函数最大·最小值应用题型感到困惑。向补习班老师请教后，完全掌握了按对称轴划分范围的方法！明天再练习3道题。',
  },
  '한국사 근현대사 연표 정리 완료. 수행평가 조별 과제에서 발표 PPT 제작 역할을 맡았다. 주말까지 초안 만들어서 단톡방에 공유하기. 과학학원 보강 수업도 잊지 말고 참석할 것.': {
    en: 'Completed Modern History timeline summary. Assigned to create presentation slides for the group project. Finish draft by weekend and share in group chat. Do not forget to attend the Science Academy makeup class.',
    zh: '完成近现代史年表整理。在随堂评价小组作业中负责制作发表PPT。周末前完成初稿并分享到群聊。别忘了参加科学补习班的补课。',
  },
  // Sample schedules generated by createInitialPlannerState (src/data/initialData.ts)
  '영어 말하기 수행평가 발표': {
    en: 'English Speaking Assessment Presentation',
    zh: '英语口语随堂测评发表',
  },
  '스크립트 암기 최종 점검 및 발표 자료 유인물 챙기기 (2분 분량)': {
    en: 'Final check of memorized script; bring presentation handouts (2-minute talk)',
    zh: '最终检查讲稿背诵情况，带上发表用讲义（2分钟）',
  },
  '수학학원 월말 성취도 레벨테스트': {
    en: 'Math Academy Month-End Level Test',
    zh: '数学补习班月末水平测试',
  },
  '이차방정식~함수 단원 오답노트 복습 필수, 컴퍼스 및 샤프 지참': {
    en: 'Must review error notebook for quadratic equations ~ functions; bring compass & mechanical pencil',
    zh: '必须复习二次方程~函数单元错题本，携带圆规和自动铅笔',
  },
  '2학기 중간고사 지필평가': {
    en: '2nd Semester Midterm Written Exams',
    zh: '第二学期期中笔试',
  },
  '첫째 날: 국어/수학/한국사 · 둘째 날: 영어/과학/사회 컴퓨터용 사인펜 2자루 챙기기': {
    en: 'Day 1: Korean / Math / Korean History · Day 2: English / Science / Social Studies. Bring 2 OMR marker pens',
    zh: '第一天：语文/数学/韩国史 · 第二天：英语/科学/社会，带2支答题卡专用签字笔',
  },
  '과학학원 물리 파트 특강 보강': {
    en: 'Science Academy Physics Makeup Lecture',
    zh: '科学补习班物理特讲补课',
  },
  '지난주 결석분 역학 에너지 보존 법칙 보강 수업 (302호 강의실)': {
    en: "Makeup for last week's absence: conservation of mechanical energy (Room 302)",
    zh: '补上周缺课内容：力学能量守恒定律（302教室）',
  },
  '교정 치과 정기검진 및 동아리 모임': {
    en: 'Orthodontist Checkup & Club Meeting',
    zh: '牙齿矫正定期检查及社团聚会',
  },
  '하교 후 바로 서울교정치과 방문 뒤 스터디카페에서 동아리 부원 미팅': {
    en: 'Right after school, visit Seoul Orthodontics, then meet club members at the study cafe',
    zh: '放学后直接去首尔矫正牙科，之后在自习咖啡馆与社团成员见面',
  },
  // Common short phrases users / defaults may produce
  '공식휴강': { en: 'Official Off', zh: '官方停课' },
  '휴강': { en: 'Cancelled', zh: '停课' },
  '보강': { en: 'Makeup Class', zh: '补课' },
  '특강': { en: 'Special Lecture', zh: '特讲' },
  '수행평가': { en: 'Performance Assessment', zh: '随堂测评' },
  '중간고사': { en: 'Midterm Exam', zh: '期中考试' },
  '기말고사': { en: 'Final Exam', zh: '期末考试' },
  '모의고사': { en: 'Mock Exam', zh: '模拟考试' },
  '숙제': { en: 'Homework', zh: '作业' },
  '병원': { en: 'Hospital visit', zh: '去医院' },
};

export function translateSampleText(text: string | undefined, lang: AppLanguage | undefined): string {
  if (!text || !lang || lang === 'ko') return text || '';
  const match = SAMPLE_TEXT_DICT[text] || SAMPLE_TEXT_DICT[text.trim()];
  if (match) {
    return lang === 'en' ? match.en : match.zh;
  }
  return text;
}

/** True when the given text is a built-in sample string that has translations. */
export function isSampleText(text: string | undefined): boolean {
  if (!text) return false;
  return Boolean(SAMPLE_TEXT_DICT[text] || SAMPLE_TEXT_DICT[text.trim()]);
}

// ===================== Date formatting helpers =====================

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KO_WEEKDAYS: DayOfWeek[] = ['일', '월', '화', '수', '목', '금', '토'];

function parseDateInput(date: Date | string): Date | null {
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(date || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** ko `10월 15일 (목)`, en `Oct 15 (Thu)`, zh `10月15日 (周四)`. Accepts a Date or 'YYYY-MM-DD'. */
export function formatDateLabel(date: Date | string, lang: AppLanguage | undefined, withWeekday = true): string {
  const d = parseDateInput(date);
  if (!d) return typeof date === 'string' ? date : '';
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const wd = translateDay(KO_WEEKDAYS[d.getDay()], lang);
  const suffix = withWeekday ? ` (${wd})` : '';
  return tr(lang, `${mo}월 ${day}일${suffix}`, `${EN_MONTHS[d.getMonth()]} ${day}${suffix}`, `${mo}月${day}日${suffix}`);
}

/** Like formatDateLabel but with the year: ko `2026년 10월 15일 (목)`, en `Oct 15, 2026 (Thu)`, zh `2026年10月15日 (周四)`. */
export function formatFullDateLabel(date: Date | string, lang: AppLanguage | undefined, withWeekday = true): string {
  const d = parseDateInput(date);
  if (!d) return typeof date === 'string' ? date : '';
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const wd = translateDay(KO_WEEKDAYS[d.getDay()], lang);
  const suffix = withWeekday ? ` (${wd})` : '';
  return tr(
    lang,
    `${y}년 ${mo}월 ${day}일${suffix}`,
    `${EN_MONTHS[d.getMonth()]} ${day}, ${y}${suffix}`,
    `${y}年${mo}月${day}日${suffix}`
  );
}

/** ko `2026년 10월`, en `Oct 2026`, zh `2026年10月`. */
export function formatYearMonthLabel(date: Date | string, lang: AppLanguage | undefined): string {
  const d = parseDateInput(date);
  if (!d) return typeof date === 'string' ? date : '';
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  return tr(lang, `${y}년 ${mo}월`, `${EN_MONTHS[d.getMonth()]} ${y}`, `${y}年${mo}月`);
}

/** Formats a stored 'YYYY-MM-DD HH:MM' timestamp: ko `10월 15일 08:30`, en `Oct 15 08:30`, zh `10月15日 08:30`. */
export function formatTimestampLabel(ts: string | null | undefined, lang: AppLanguage | undefined): string {
  if (!ts) return '';
  const [datePart, timePart] = ts.split(' ');
  const d = parseDateInput(datePart);
  if (!d) return ts;
  const label = formatDateLabel(d, lang, false);
  return timePart ? `${label} ${timePart}` : label;
}

// ===================== Common enum labels =====================

export function translateAttendanceStatus(
  status: 'present' | 'late' | 'absent' | 'cancelled' | string | undefined | null,
  lang: AppLanguage | undefined
): string {
  switch (status) {
    case 'present':
      return tr(lang, '출석', 'Present', '出勤');
    case 'late':
      return tr(lang, '지각', 'Late', '迟到');
    case 'absent':
      return tr(lang, '결석', 'Absent', '缺席');
    case 'cancelled':
      return tr(lang, '공식휴강', 'Official Off', '官方停课');
    default:
      return status || '';
  }
}

export function translateScheduleCategory(
  category: 'school' | 'academy' | 'other' | string | undefined,
  lang: AppLanguage | undefined
): string {
  switch (category) {
    case 'school':
      return tr(lang, '학교', 'School', '学校');
    case 'academy':
      return tr(lang, '학원', 'Academy', '补习班');
    case 'other':
      return tr(lang, '기타', 'Other', '其他');
    default:
      return category || '';
  }
}

export interface GuideStepItem {
  id: string;
  badge: { ko: string; en: string; zh: string };
  title: { ko: string; en: string; zh: string };
  summary: { ko: string; en: string; zh: string };
  steps: Array<{
    stepTitle: { ko: string; en: string; zh: string };
    stepDesc: { ko: string; en: string; zh: string };
  }>;
  tip: { ko: string; en: string; zh: string };
}

export const USER_GUIDE_TOPICS: GuideStepItem[] = [
  {
    id: 'timetable-override',
    badge: { ko: '시간표 · 2-Tap 변경', en: 'Timetable · 2-Tap Edit', zh: '课程表 · 2步快速修改' },
    title: {
      ko: '요일별 시간표 조회 및 당일 수업 2-Tap 변경',
      en: 'View Timetable & 2-Tap Daily Class Override',
      zh: '查看课程表及当天课程2步快速调整',
    },
    summary: {
      ko: '매주 반복되는 기본 시간표를 유지하면서, 오늘만 바뀐 학교 수업이나 학원 특강/휴강을 터치 2번으로 수정합니다.',
      en: 'Keep your weekly master schedule intact while changing a single day’s class, makeup lesson, or cancellation in just 2 taps.',
      zh: '在保持每周固定课表不变的情况下，只需点击2次即可修改当天的学校调课、补习班加课或停课。',
    },
    steps: [
      {
        stepTitle: {
          ko: 'Step 1. [시간표] 탭에서 날짜·요일 선택',
          en: 'Step 1. Select Date & Day in [Timetable] Tab',
          zh: 'Step 1. 在【课程表】标签页选择日期与星期',
        },
        stepDesc: {
          ko: '하단 첫 번째 [시간표] 탭을 누르면 오늘 요일(TODAY)이 자동 선택됩니다. 상단 월~일 버튼이나 화살표로 원하는 날짜로 이동하세요.',
          en: 'Open the [Timetable] tab at the bottom. Today is automatically selected. Use the Mon–Sun bar or arrows to pick any date.',
          zh: '点击底部第一个【课程表】标签，系统会自动定位到今天(TODAY)。点击上方周一至周日按钮可切换日期。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 2. 변경할 수업 블록 터치',
          en: 'Step 2. Tap Any School Period or Academy Slot',
          zh: 'Step 2. 点击需要修改的学校课时或补习班区块',
        },
        stepDesc: {
          ko: '시간표 위에서 바뀐 학교 교시나 학원 수업을 터치하면 하단에 수정 시트가 열립니다.',
          en: 'Tap any school class or academy block on the timeline or list to open the quick edit sheet.',
          zh: '在时间轴或列表中点击任意学校课程或补习班，底部会弹出快速修改面板。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 3. 과목 후보군 선택 또는 [오늘 휴강/자습] 적용',
          en: 'Step 3. Pick a Subject Chip or Tap [Cancel / Self-Study]',
          zh: 'Step 3. 选择候选科目或点击【今日停课/自习】',
        },
        stepDesc: {
          ko: '타이핑할 필요 없이 버튼 그리드에서 바뀐 과목을 터치하면 해당 날짜에만 즉시 반영되며, 언제든 [기본 시간표로 원상복구]할 수 있습니다.',
          en: 'Tap a subject button from the pool to apply it only to that date, or tap [Restore Default] anytime to revert.',
          zh: '无需打字，直接点击候选科目按钮即可仅对当天生效，随时可点击【恢复默认课表】还原。',
        },
      },
    ],
    tip: {
      ko: '빈 시간(공강) 블록의 [+ 보강/특강] 버튼을 누르면 해당 시간대가 자동 입력된 상태로 당일 보강 수업을 추가할 수 있습니다.',
      en: 'Tap [+ Makeup] on any green Free Time block to pre-fill that exact time slot for a one-day academy class!',
      zh: '点击绿色空闲时间区块上的【+ 补课/特讲】按钮，可自动填入该时间段并快速添加当天临时课程。',
    },
  },
  {
    id: 'timeline-conflict',
    badge: { ko: '타임라인 · 시간 설정', en: 'Timeline · Hours & Conflict', zh: '时间轴 · 时段与冲突' },
    title: {
      ko: '일별 타임라인 범위 설정 및 [시간 겹침] 확인',
      en: 'Custom Timeline Hours & [Time Overlap] Detection',
      zh: '自定义时间轴起止时间与【时间冲突】检测',
    },
    summary: {
      ko: '하루 시작·종료 시각(예: 08:00~24:00)을 내 생활 패턴에 맞게 조절하고, 겹치는 수업 일정을 주황색 경고 배지로 즉시 식별합니다.',
      en: 'Customize your daily timeline hours (e.g. 08:00–24:00) and spot overlapping classes immediately with orange warning badges.',
      zh: '根据作息调整每日时间轴显示范围（如08:00~24:00），并通过橙色警告徽章快速识别重叠课程。',
    },
    steps: [
      {
        stepTitle: {
          ko: 'Step 1. [설정] → [2. 기본 시간표 및 표시 시간 설정] 이동',
          en: 'Step 1. Go to [Settings] → [2. Master Timetable & Hours]',
          zh: 'Step 1. 进入【设置】→【2. 固定课表及显示时间设置】',
        },
        stepDesc: {
          ko: '설정 화면의 2번 섹션 상단에서 [일별 타임라인 표시 시간 범위] 설정 카드를 찾으세요.',
          en: 'In Section 2 of Settings, locate the [Daily Timeline Display Range] card at the top.',
          zh: '在设置页面的第2部分顶部找到【每日时间轴显示范围】设置卡片。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 2. 시작 시각과 종료 시각 선택 (또는 프리셋 터치)',
          en: 'Step 2. Choose Start & End Hours (or Tap a Preset)',
          zh: 'Step 2. 选择开始与结束时间（或点击快捷预设）',
        },
        stepDesc: {
          ko: '드롭다운에서 시작/종료 시각을 고르거나 [07:00~23:00 얼리버드], [08:00~24:00 기본] 프리셋을 누르면 시간표 탭에 즉시 적용됩니다.',
          en: 'Pick start/end hours from the dropdowns or tap a preset like [07:00–23:00 Early Bird] to update the timeline immediately.',
          zh: '通过下拉菜单选择起止时间，或直接点击【07:00~23:00 早鸟】等预设按钮立即生效。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 3. 타임라인에서 [시간 겹침] 경고 확인 및 시간 조정',
          en: 'Step 3. Check Orange [Time Overlap] Warnings on Timeline',
          zh: 'Step 3. 在时间轴查看橙色【时间冲突】警告并调整',
        },
        stepDesc: {
          ko: '두 수업 시간이 겹치면 주황색 스트라이프 구간과 [시간 겹침] 배지가 표시됩니다. 해당 수업을 터치해 시간을 수정하세요.',
          en: 'When two classes overlap, an orange zone and [Time Overlap] badge appear. Tap the class block to adjust its time.',
          zh: '若两门课程时间重叠，会显示橙色条纹区域及【时间冲突】徽章，点击对应课程即可修改时间。',
        },
      },
    ],
    tip: {
      ko: '[시간표] 상단 우측의 [표 | 목록] 스위치로 비례 타임라인 뷰와 깔끔한 카드 목록 뷰를 언제든 전환할 수 있습니다.',
      en: 'Use the [Timeline | List] toggle in the Timetable header to switch between the proportional timeline and classic list view.',
      zh: '点击课程表右上角的【时间表 | 列表】开关，可随时在比例时间轴与经典卡片列表视图间切换。',
    },
  },
  {
    id: 'master-ai',
    badge: { ko: '기본 시간표 · AI 인식', en: 'Master Setup · AI Scan', zh: '固定课表 · AI识别' },
    title: {
      ko: '기본 시간표 세팅 및 AI 시간표 이미지 자동 인식',
      en: 'Master Timetable Setup & AI Timetable Image Recognition',
      zh: '设置每周固定课表及 AI 课表图片自动识别',
    },
    summary: {
      ko: '과목 후보군 등록, 45분/50분 교시 프리셋 자동 생성, 또는 시간표 사진 1장 업로드로 전체 시간표를 한 번에 완성합니다.',
      en: 'Register subject pools, auto-generate 45/50-min school periods, or upload a photo of your timetable for AI extraction.',
      zh: '添加候选科目、一键生成45/50分钟标准课时，或上传一张课表照片由 AI 自动识别并导入。',
    },
    steps: [
      {
        stepTitle: {
          ko: 'Step 1. [1. 과목 후보군]에서 학교 과목·학원 이름 등록',
          en: 'Step 1. Add School Subjects & Academies in [1. Subject Pool]',
          zh: 'Step 1. 在【1. 候选科目管理】中添加学校科目与补习班名称',
        },
        stepDesc: {
          ko: '자주 쓰는 과목과 학원 이름을 먼저 칩으로 등록해 두면 시간표 배정과 2-Tap 변경이 훨씬 빨라집니다.',
          en: 'Add your subjects and academies as chips first so they appear in all dropdowns and 2-Tap quick selectors.',
          zh: '先将常用学校科目和补习班名称添加为标签，后续排课和2步调课会更加快捷。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 2. [2. 기본 시간표]에서 교시 프리셋 및 요일 복사 활용',
          en: 'Step 2. Use Period Presets & Day Copy in [2. Master Timetable]',
          zh: 'Step 2. 在【2. 固定课表】中使用课时预设与星期复制功能',
        },
        stepDesc: {
          ko: '[고등 50분] 또는 [중등 45분] 버튼을 누르면 1~7교시 시간이 자동 세팅되며, [요일 시간표 복사]로 월요일 시간표를 다른 요일에 복제할 수 있습니다.',
          en: 'Tap [High 50m] or [Middle 45m] to auto-calculate period times, and use [Copy Day] to duplicate schedules across days.',
          zh: '点击【高中50分】或【初中45分】可自动计算1~7节时间，还可将周一课表一键复制到其他星期。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 3. [3. AI 시간표 인식]에서 이미지 업로드 후 검수·병합',
          en: 'Step 3. Upload Timetable Photo in [3. AI Scan] & Merge',
          zh: 'Step 3. 在【3. AI 课表识别】上传图片，核对预览表后合并',
        },
        stepDesc: {
          ko: '시간표 사진을 업로드(또는 샘플 테스트)하면 수정 가능한 미리보기 표가 생성됩니다. 오타를 검수한 뒤 [기존 시간표에 병합하기]를 누르세요.',
          en: 'Upload a timetable photo (or run the sample test), review the editable preview table, and tap [Merge into Master Timetable].',
          zh: '上传课表图片（或运行示例测试）后生成可编辑预览表，核对无误后点击【合并到现有课表】。',
        },
      },
    ],
    tip: {
      ko: 'AI 인식 후 바로 덮어쓰지 않고 미리보기 표에서 요일·시간·과목명을 직접 고친 뒤 병합하므로 기존 데이터가 안전하게 보호됩니다.',
      en: 'AI extraction never overwrites blindly—you can edit every row in the preview table before merging!',
      zh: 'AI 识别不会直接覆盖原数据，您可以在预览表中自由修改星期、时间和科目后再安全合并。',
    },
  },
  {
    id: 'attendance-makeup',
    badge: { ko: '출석률 · 보강 관리', en: 'Attendance · Makeups', zh: '出勤率 · 补课管理' },
    title: {
      ko: '학원별 출석률 상세 리포트 & 미완료 보강 관리',
      en: 'Per-Academy Attendance Report & Makeup Class Tracking',
      zh: '各补习班出勤率详细报告与未完成补课管理',
    },
    summary: {
      ko: '공식휴강을 제외한 실질 출석률을 학원별로 한눈에 비교하고, 출석률이 낮은 학원을 눌러 지각한 날·결석한 날을 확인합니다.',
      en: 'Compare real attendance rates (excluding official cancellations) and tap any academy to inspect exact late and absent dates.',
      zh: '一目了然对比扣除官方停课后的实际出勤率，点击任意补习班即可查看具体的迟到日与缺席日。',
    },
    steps: [
      {
        stepTitle: {
          ko: 'Step 1. [출석표] 상단에서 학원별 출석률 버튼 터치',
          en: 'Step 1. Tap Any Academy Rate Button in [Attendance] Tab',
          zh: 'Step 1. 在【出勤表】顶部点击任意补习班出勤率按钮',
        },
        stepDesc: {
          ko: '학원명/출석률 요약 그리드에서 학원을 터치하면 구체적인 출석·지각·결석 횟수와 지각한 날, 결석한 날 리스트가 펼쳐집니다.',
          en: 'Tap an academy in the compact grid to expand its exact present/late/absent counts plus the list of late and absent dates.',
          zh: '在精简网格中点击某个补习班，即可展开具体的出勤/迟到/缺席次数以及迟到日期、缺席日期列表。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 2. 달력에서 날짜 선택 후 하단 [원터치 출석 체크]',
          en: 'Step 2. Pick a Date on Calendar & Record 1-Touch Status',
          zh: 'Step 2. 在日历选择日期并在下方进行【一键出勤登记】',
        },
        stepDesc: {
          ko: '달력에서 날짜를 누르면 그 요일에 배정된 학교·학원 목록이 자동 표시됩니다. [출석 / 지각 / 결석 / 공식휴강]을 원터치로 기록하세요.',
          en: 'Select a date on the calendar to see scheduled classes for that day. Tap [Present / Late / Absent / Official Off].',
          zh: '点击日历上的日期会自动加载当天排定的学校和补习班，一键记录【出勤 / 迟到 / 缺席 / 官方停课】。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 3. 결석 시 [보강 필요] 체크 및 완료 시 [보강 완료 체크]',
          en: 'Step 3. Check [Needs Makeup] & Complete Makeup When Done',
          zh: 'Step 3. 缺席时勾选【需要补课】，完成后点击【完成补课】',
        },
        stepDesc: {
          ko: '결석/지각 시 사유를 적고 [보강 필요]를 켜두면 상단 알림 배지에 미완료 보강 건수로 집계되며, 보강 후 원터치로 완료 처리할 수 있습니다.',
          en: 'Mark [Needs Makeup] on an absence to track it in the header alert, then tap [Complete Makeup] once finished.',
          zh: '缺席或迟到时填写事由并勾选【需要补课】，完成后一键点击【完成补课】即可消除提醒。',
        },
      },
    ],
    tip: {
      ko: '[공식휴강]으로 기록한 날은 전체 수업 일수(분모)에서 자동 제외되어 내 실질 출석률이 떨어지지 않습니다.',
      en: 'Days marked as [Official Off] are excluded from the denominator so your real attendance rate is never penalized!',
      zh: '标记为【官方停课】的日期会自动从总课时分母中扣除，不会拉低您的实际出勤率。',
    },
  },
  {
    id: 'schedule-dday',
    badge: { ko: '일정표 · D-Day', en: 'Schedule · D-Day', zh: '日程表 · D-Day倒计时' },
    title: {
      ko: '3대 라벨(학교·학원·기타) 일정 등록 및 D-Day 관리',
      en: '3-Category Schedule (School / Academy / Other) & D-Day',
      zh: '三大分类（学校·补习班·其他）日程与 D-Day 倒计时管理',
    },
    summary: {
      ko: '수행평가, 지필고사, 학원 레벨테스트, 병원 예약 등을 색상 라벨과 D-Day 배지로 월간·주간·일간 뷰에서 관리합니다.',
      en: 'Manage exams, school assessments, academy tests, and personal events with color-coded labels and automatic D-Day badges.',
      zh: '通过颜色标签与自动 D-Day 倒计时徽章，在月/周/日视图中管理考试、随堂测评、补习班测试及个人日程。',
    },
    steps: [
      {
        stepTitle: {
          ko: 'Step 1. [일정표] 탭에서 [월간 / 주간 / 일간] 및 라벨 필터 선택',
          en: 'Step 1. Switch [Month / Week / Day] & Category Filters',
          zh: 'Step 1. 在【日程表】切换【月/周/日】视图与分类筛选',
        },
        stepDesc: {
          ko: '상단에서 뷰 모드를 전환하거나 [전체 / 학교 일정 / 학원 일정 / 기타 일정] 필터를 눌러 원하는 일정만 모아 볼 수 있습니다.',
          en: 'Toggle Month/Week/Day views or filter by [All / School / Academy / Other] with one tap.',
          zh: '在顶部切换月/周/日视图，或点击【全部 / 学校日程 / 补习班日程 / 其他日程】筛选查看。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 2. [+ 일정 추가] 버튼으로 단일·기간 일정 등록',
          en: 'Step 2. Tap [+ Add Event] for Single-Day or Multi-Day Events',
          zh: 'Step 2. 点击【+ 添加日程】登记单日或跨日日程',
        },
        stepDesc: {
          ko: '제목, 카테고리 라벨, 시작일(및 종료일), 시간을 입력하면 D-Day(예: D-3, D-Day)가 자동 계산되어 표시됩니다.',
          en: 'Enter title, category, start/end dates, and time. D-Day badges (e.g. D-3, D-Day) are calculated automatically.',
          zh: '输入标题、分类标签、起止日期及时间后，系统会自动计算并显示 D-Day 倒计时徽章。',
        },
      },
    ],
    tip: {
      ko: '월간 달력에서 날짜 칸을 터치하면 바로 아래에 해당 날짜의 상세 일정 리스트가 표시되며 즉시 수정·삭제할 수 있습니다.',
      en: 'Tap any day cell on the monthly calendar to inspect, edit, or delete that day’s events right below.',
      zh: '在月历中点击任意日期格，下方会立即显示当天的详细日程列表，支持直接编辑或删除。',
    },
  },
  {
    id: 'memo-backup',
    badge: { ko: '메모장 · 검색 · 백업', en: 'Memo · Search · Backup', zh: '备忘录 · 搜索 · 备份' },
    title: {
      ko: '일일 메모 자동 저장, 키워드 검색 및 파일 백업/복원',
      en: 'Auto-Saved Daily Memos, Keyword Search & JSON Backup',
      zh: '每日备忘自动保存、关键词高亮搜索与数据备份/恢复',
    },
    summary: {
      ko: '오늘 날짜 메모장에 숙제·준비물을 즉시 기록하고, 키워드 검색 및 JSON 백업 파일로 스마트폰 교체 시에도 데이터를 보존합니다.',
      en: 'Jot down daily homework or notes with instant auto-save, search past memos with highlighting, and export/restore JSON backups.',
      zh: '随时记录每日作业与待办并自动保存，支持关键词高亮搜索，以及通过 JSON 文件导出备份与跨设备恢复。',
    },
    steps: [
      {
        stepTitle: {
          ko: 'Step 1. [메모장] 탭에서 오늘 메모 즉시 작성 (자동 저장)',
          en: 'Step 1. Write Today’s Note in [Memo] Tab (Instant Auto-Save)',
          zh: 'Step 1. 在【备忘录】直接编写今日笔记（实时自动保存）',
        },
        stepDesc: {
          ko: '메모장 탭을 열면 오늘 날짜가 제목으로 자동 지정됩니다. 내용을 입력하는 즉시 브라우저에 오프라인 저장됩니다.',
          en: 'Opening the Memo tab automatically selects today’s date. Every keystroke is saved immediately for offline access.',
          zh: '打开备忘录会自动定位到今天日期，输入的内容会实时保存在本地，断网离线也可随时查看。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 2. 상단 검색창에 키워드 입력하여 하이라이트 검색',
          en: 'Step 2. Search Past Memos with Yellow Keyword Highlighting',
          zh: 'Step 2. 在顶部搜索框输入关键词进行高亮搜索',
        },
        stepDesc: {
          ko: "'수행평가', '숙제' 등 단어를 입력하면 과거 모든 메모에서 일치하는 단어를 노란색 형광펜으로 하이라이트해 보여줍니다.",
          en: 'Type any keyword in the search bar to filter all historical memos with matching words highlighted in yellow.',
          zh: '在搜索框输入如“作业”、“测评”等词，会在所有历史备忘录中用黄色荧光笔高亮显示匹配内容。',
        },
      },
      {
        stepTitle: {
          ko: 'Step 3. [설정] → [4. 데이터 백업 및 복원]으로 파일 보관',
          en: 'Step 3. Export or Restore JSON File in [Settings] → [4. Backup]',
          zh: 'Step 3. 在【设置】→【4. 数据备份与恢复】导出或导入文件',
        },
        stepDesc: {
          ko: '[데이터 내보내기]로 백업 파일(.json)을 저장해 두면, 기기 변경 후 [데이터 불러오기]로 100% 동일하게 복원할 수 있습니다.',
          en: 'Tap [Export Data] to download a .json backup file, and use [Import Data] anytime to restore 100% of your planner.',
          zh: '点击【导出数据】保存 .json 备份文件，更换手机或重装后点击【导入数据】即可100%完整恢复。',
        },
      },
    ],
    tip: {
      ko: '모든 기능(AI 이미지 인식 제외)은 100% 오프라인 우선(Local-First)으로 동작하여 지하 강의실이나 와이파이가 없는 곳에서도 즉시 작동합니다.',
      en: 'All features (except AI image recognition) work 100% offline so you can use the planner even in underground classrooms without Wi-Fi!',
      zh: '除 AI 图片识别外，所有功能均采用100%本地离线优先架构，在地下教室或无网络环境下也能流畅使用。',
    },
  },
];
