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
