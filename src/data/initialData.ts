import { PlannerState, DayOfWeek, SchoolPeriod } from '../types';

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayOfWeekKor(date: Date): DayOfWeek {
  const map: DayOfWeek[] = ['일', '월', '화', '수', '목', '금', '토'];
  return map[date.getDay()];
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getMondayOfCurrentWeek(referenceDate: Date): Date {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function generatePeriodSchedule(
  durationMinutes: 40 | 45 | 50,
  subjects: string[]
): SchoolPeriod[] {
  const result: SchoolPeriod[] = [];
  let currentMinutes = 9 * 60; // Start at 09:00

  for (let p = 1; p <= 7; p++) {
    const startH = Math.floor(currentMinutes / 60);
    const startM = currentMinutes % 60;
    const endMinutes = currentMinutes + durationMinutes;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;

    const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    result.push({
      period: p,
      startTime,
      endTime,
      subject: subjects[p - 1] || '자습',
    });

    // Lunch break after 4th period (50 mins), otherwise 10 min break
    if (p === 4) {
      currentMinutes = endMinutes + 55;
    } else {
      currentMinutes = endMinutes + 10;
    }
  }

  return result;
}

export function createInitialPlannerState(now: Date = new Date()): PlannerState {
  const todayStr = formatDateKey(now);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Helper to get valid date strings in the current month
  const dayInMonth = (dayNum: number) => {
    const maxDays = new Date(year, now.getMonth() + 1, 0).getDate();
    const clamped = Math.min(Math.max(1, dayNum), maxDays);
    return `${year}-${month}-${String(clamped).padStart(2, '0')}`;
  };

  const subjectPool = {
    school: [
      '국어',
      '영어',
      '수학',
      '사회',
      '과학',
      '한국사',
      '체육',
      '음악',
      '미술',
      '정보',
      '자습',
      '동아리',
    ],
    academy: [
      '수학학원',
      '영어학원',
      '과학학원',
      '논술학원',
      '코딩학원',
    ],
  };

  const masterTimetable = {
    월: {
      school: generatePeriodSchedule(45, ['국어', '수학', '영어', '과학', '한국사', '체육', '자습']),
      academy: [
        { id: 'ac-mon-1', startTime: '17:00', endTime: '19:00', subject: '수학학원' },
        { id: 'ac-mon-2', startTime: '19:30', endTime: '21:30', subject: '영어학원' },
      ],
    },
    화: {
      school: generatePeriodSchedule(45, ['수학', '영어', '과학', '사회', '음악', '국어', '정보']),
      academy: [
        { id: 'ac-tue-1', startTime: '17:30', endTime: '19:30', subject: '과학학원' },
        { id: 'ac-tue-2', startTime: '20:00', endTime: '21:30', subject: '코딩학원' },
      ],
    },
    수: {
      school: generatePeriodSchedule(45, ['영어', '국어', '수학', '체육', '사회', '동아리', '자습']),
      academy: [
        { id: 'ac-wed-1', startTime: '16:30', endTime: '18:30', subject: '수학학원' },
        { id: 'ac-wed-2', startTime: '19:00', endTime: '21:00', subject: '영어학원' },
      ],
    },
    목: {
      school: generatePeriodSchedule(45, ['과학', '수학', '한국사', '국어', '미술', '영어', '사회']),
      academy: [
        { id: 'ac-thu-1', startTime: '17:30', endTime: '19:30', subject: '과학학원' },
        { id: 'ac-thu-2', startTime: '20:00', endTime: '21:30', subject: '논술학원' },
      ],
    },
    금: {
      school: generatePeriodSchedule(45, ['수학', '과학', '국어', '영어', '정보', '체육', '한국사']),
      academy: [
        { id: 'ac-fri-1', startTime: '17:00', endTime: '19:00', subject: '수학학원' },
        { id: 'ac-fri-2', startTime: '19:30', endTime: '21:30', subject: '영어학원' },
      ],
    },
    토: {
      school: [],
      academy: [
        { id: 'ac-sat-1', startTime: '10:00', endTime: '12:30', subject: '논술학원' },
        { id: 'ac-sat-2', startTime: '14:00', endTime: '16:30', subject: '코딩학원' },
      ],
    },
    일: {
      school: [],
      academy: [
        { id: 'ac-sun-1', startTime: '14:00', endTime: '16:00', subject: '과학학원' },
      ],
    },
  };

  // Sample daily override on today so user immediately sees 2-Tap override badge
  const dailyOverrides = {
    [todayStr]: {
      school: {
        5: {
          subject: '체육',
          isCancelled: false,
        },
      },
    },
  };

  // 5 realistic schedules in the current month (including today and upcoming D-days)
  const dPlus2 = formatDateKey(addDays(now, 2));
  const dPlus5 = formatDateKey(addDays(now, 5));
  const dMinus3 = formatDateKey(addDays(now, -3));
  const dPlus9 = formatDateKey(addDays(now, 9));

  const schedules = [
    {
      id: 'sch-1',
      date: todayStr,
      time: '13:30',
      title: '영어 말하기 수행평가 발표',
      category: 'school' as const,
      memo: '스크립트 암기 최종 점검 및 발표 자료 유인물 챙기기 (2분 분량)',
    },
    {
      id: 'sch-2',
      date: dPlus2,
      time: '17:00',
      title: '수학학원 월말 성취도 레벨테스트',
      category: 'academy' as const,
      memo: '이차방정식~함수 단원 오답노트 복습 필수, 컴퍼스 및 샤프 지참',
    },
    {
      id: 'sch-3',
      date: dPlus5,
      endDate: formatDateKey(addDays(now, 7)),
      time: '09:00',
      title: '2학기 중간고사 지필평가',
      category: 'school' as const,
      memo: '첫째 날: 국어/수학/한국사 · 둘째 날: 영어/과학/사회 컴퓨터용 사인펜 2자루 챙기기',
    },
    {
      id: 'sch-4',
      date: dMinus3,
      time: '18:00',
      title: '과학학원 물리 파트 특강 보강',
      category: 'academy' as const,
      memo: '지난주 결석분 역학 에너지 보존 법칙 보강 수업 (302호 강의실)',
    },
    {
      id: 'sch-5',
      date: dPlus9,
      time: '15:30',
      title: '교정 치과 정기검진 및 동아리 모임',
      category: 'other' as const,
      memo: '하교 후 바로 서울교정치과 방문 뒤 스터디카페에서 동아리 부원 미팅',
    },
  ];

  // 10 realistic attendance records in current month
  const attDates = [
    dayInMonth(2),
    dayInMonth(3),
    dayInMonth(4),
    dayInMonth(5),
    dayInMonth(6),
    dayInMonth(7),
    dayInMonth(9),
    dayInMonth(10),
    dayInMonth(11),
    dayInMonth(12),
  ];

  const attendance: PlannerState['attendance'] = {
    [attDates[0]]: {
      school: { status: 'present' },
      academies: {
        수학학원: { status: 'present' },
        영어학원: { status: 'present' },
      },
    },
    [attDates[1]]: {
      school: { status: 'present' },
      academies: {
        과학학원: { status: 'present' },
        코딩학원: { status: 'late', reason: '학교 청소 당번으로 15분 늦음' },
      },
    },
    [attDates[2]]: {
      school: { status: 'present' },
      academies: {
        수학학원: {
          status: 'absent',
          reason: '감기 몸살 및 병원 진료',
          needsMakeup: true,
          makeupCompleted: false,
        },
        영어학원: { status: 'present' },
      },
    },
    [attDates[3]]: {
      school: { status: 'present' },
      academies: {
        과학학원: { status: 'present' },
        논술학원: { status: 'cancelled', reason: '학원 강사님 세미나 공식휴강' },
      },
    },
    [attDates[4]]: {
      school: { status: 'late', reason: '우천으로 인한 마을버스 지연' },
      academies: {
        수학학원: { status: 'present' },
        영어학원: { status: 'present' },
      },
    },
    [attDates[5]]: {
      academies: {
        논술학원: { status: 'present' },
        코딩학원: {
          status: 'absent',
          reason: '가족 행사 참석',
          needsMakeup: true,
          makeupCompleted: false,
        },
      },
    },
    [attDates[6]]: {
      school: { status: 'cancelled', reason: '개교기념일 재량휴업일 (공식휴강)' },
      academies: {
        수학학원: { status: 'present' },
        영어학원: { status: 'present' },
      },
    },
    [attDates[7]]: {
      school: { status: 'present' },
      academies: {
        과학학원: {
          status: 'absent',
          reason: '학교 수행평가 팀 프로젝트 모임',
          needsMakeup: true,
          makeupCompleted: true,
        },
        코딩학원: { status: 'present' },
      },
    },
    [attDates[8]]: {
      school: { status: 'present' },
      academies: {
        수학학원: { status: 'present' },
        영어학원: { status: 'late', reason: '저녁 식사 후 이동 지연' },
      },
    },
    [attDates[9]]: {
      school: { status: 'present' },
      academies: {
        과학학원: { status: 'present' },
        논술학원: { status: 'present' },
      },
    },
  };

  // 3 realistic memos (today, yesterday, 3 days ago)
  const yesterdayStr = formatDateKey(addDays(now, -1));
  const threeDaysAgoStr = formatDateKey(addDays(now, -3));

  const memos: PlannerState['memos'] = {
    [todayStr]: {
      content:
        '오늘 체크리스트:\n1. 영어 수행평가 발표 대본 3번 소리내어 읽기\n2. 수학학원 숙제 (심화교재 p.74~82 오답노트 정리)\n3. 과학 실험 보고서 프린트 파일철에 끼워두기\n4. 저녁에 단어장 Day 14~15 암기 테스트 준비!',
      updatedAt: `${todayStr} 08:30`,
    },
    [yesterdayStr]: {
      content:
        '수학 함수 단원 심화 문제 풀이 중 이차함수 최대·최소 활용 유형이 헷갈렸다. 학원 선생님께 질문해서 그래프 축의 방정식 범위를 나누는 법을 완벽히 이해함! 내일 다시 3문제 풀어보기.',
      updatedAt: `${yesterdayStr} 21:45`,
    },
    [threeDaysAgoStr]: {
      content:
        '한국사 근현대사 연표 정리 완료. 수행평가 조별 과제에서 발표 PPT 제작 역할을 맡았다. 주말까지 초안 만들어서 단톡방에 공유하기. 과학학원 보강 수업도 잊지 말고 참석할 것.',
      updatedAt: `${threeDaysAgoStr} 20:15`,
    },
  };

  return {
    subjectPool,
    masterTimetable,
    dailyOverrides,
    schedules,
    attendance,
    memos,
    backupMeta: {
      lastBackupDate: `${todayStr} 08:00`,
    },
    timelineConfig: {
      startHour: 8,
      endHour: 24,
    },
  };
}
