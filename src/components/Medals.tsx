import React, { useMemo } from 'react';
import { ChevronRight, Flame, Lock, X } from 'lucide-react';
import { AppLanguage, AttendanceMap } from '../types';
import { tr } from '../i18n/translations';
import {
  MEDAL_MIN_CLASSES,
  MEDAL_TIERS,
  MedalTier,
  STREAK_MILESTONES,
  attendanceStreak,
  medalMonths,
  monthMedal,
} from '../utils/medals';

const TIER_COLORS: Record<MedalTier, { face: string; rim: string; shine: string; ribbon: string }> = {
  gold: { face: '#F2C14E', rim: '#C9962B', shine: '#FBE3A1', ribbon: '#D2553B' },
  silver: { face: '#C9CFD6', rim: '#98A0AA', shine: '#EEF1F4', ribbon: '#4F78B8' },
  bronze: { face: '#D69563', rim: '#A8673A', shine: '#F0C9A6', ribbon: '#5E8C5A' },
};

export const tierLabel = (tier: MedalTier, lang: AppLanguage) =>
  tier === 'gold'
    ? tr(lang, '금메달', 'Gold medal', '金牌')
    : tier === 'silver'
    ? tr(lang, '은메달', 'Silver medal', '银牌')
    : tr(lang, '동메달', 'Bronze medal', '铜牌');

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (month: string, lang: AppLanguage) => {
  const m = Number(month.slice(5, 7));
  return tr(lang, `${m}월`, EN_MONTHS[m - 1], `${m}月`);
};

/** A round medal on a ribbon; `tier` null draws an empty (not yet earned) slot. */
export const MedalIcon: React.FC<{ tier: MedalTier | null; size?: number; label?: string }> = ({ tier, size = 40, label }) => {
  const c = tier ? TIER_COLORS[tier] : null;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {c ? (
        <>
          <path d="M12 2 L18 2 L22 15 L16 17 Z" fill={c.ribbon} />
          <path d="M28 2 L22 2 L18 15 L24 17 Z" fill={c.ribbon} opacity="0.85" />
          <circle cx="20" cy="25" r="12.5" fill={c.rim} />
          <circle cx="20" cy="25" r="10" fill={c.face} />
          <path d="M14.5 21 A7 7 0 0 1 22 17.6" stroke={c.shine} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path
            d="M20 19.6 l1.65 3.35 3.7 .54 -2.68 2.6 .63 3.68 -3.3 -1.74 -3.3 1.74 .63 -3.68 -2.68 -2.6 3.7 -.54 z"
            fill={c.rim}
            opacity="0.75"
          />
        </>
      ) : (
        <circle cx="20" cy="25" r="11" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" className="text-slate-300" />
      )}
    </svg>
  );
};

/** 출석표 → 이달의 출석 현황: the medal this month is on track for, and the streak. Tap → 메달함. */
export const MedalStrip: React.FC<{
  lang: AppLanguage;
  attendance: AttendanceMap;
  month: string;
  isCurrentMonth: boolean;
  todayStr: string;
  onOpen: () => void;
}> = ({ lang, attendance, month, isCurrentMonth, todayStr, onOpen }) => {
  const m = useMemo(() => monthMedal(attendance, month), [attendance, month]);
  const streak = useMemo(() => attendanceStreak(attendance, todayStr), [attendance, todayStr]);
  const isPast = month < todayStr.slice(0, 7);
  const tl = m.tier ? tierLabel(m.tier, lang) : '';

  const message =
    m.total === 0
      ? tr(lang, '출석을 체크하면 메달을 받을 수 있어요', 'Check attendance to earn medals', '记录出勤即可获得奖牌')
      : m.total < MEDAL_MIN_CLASSES
      ? tr(
          lang,
          `수업 ${MEDAL_MIN_CLASSES - m.total}번만 더 체크하면 메달 도전!`,
          `${MEDAL_MIN_CLASSES - m.total} more classes to go for a medal!`,
          `再记录 ${MEDAL_MIN_CLASSES - m.total} 节课就能挑战奖牌！`
        )
      : isPast
      ? m.tier
        ? tr(lang, `${monthName(month, lang)} ${tl}을 받았어요!`, `${tl} for ${monthName(month, lang)}!`, `${monthName(month, lang)}获得${tl}！`)
        : tr(lang, '다음 달에 다시 도전해요!', 'Try again next month!', '下个月再挑战吧！')
      : m.tier
      ? tr(lang, `지금처럼 하면 ${tl}!`, `Keep it up for a ${tl.toLowerCase()}!`, `保持下去就能拿${tl}！`)
      : tr(lang, '보강을 마치면 메달에 가까워져요', 'Finishing makeups brings you closer to a medal', '完成补课离奖牌更近一步');

  return (
    <button
      type="button"
      onClick={onOpen}
      data-tour="medals"
      className="w-full flex items-center gap-3 rounded-2xl bg-paper px-3 py-2.5 text-left hover:bg-slate-100 active:scale-[0.99] transition-transform"
      aria-label={`${tr(lang, '메달함 열기', 'Open medal box', '打开奖牌盒')}: ${message}`}
    >
      <span className={m.tier ? '' : 'opacity-60'}>
        <MedalIcon tier={m.tier} size={44} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[0.6875rem] font-bold text-slate-600">
          {isCurrentMonth || !isPast
            ? tr(lang, '이번 달 메달', "This month's medal", '本月奖牌')
            : tr(lang, `${monthName(month, lang)} 메달`, `${monthName(month, lang)} medal`, `${monthName(month, lang)}奖牌`)}
        </span>
        <span className="block text-[0.875rem] font-bold text-ink leading-snug break-keep">{message}</span>
      </span>
      <span className="shrink-0 flex flex-col items-center px-1">
        <span className="inline-flex items-center gap-0.5 text-accent-700">
          <Flame className="w-4 h-4" strokeWidth={2.5} />
          <span className="font-mono text-[1.125rem] font-bold tabular-nums">{streak.current}</span>
        </span>
        <span className="text-[0.625rem] font-semibold text-slate-600 whitespace-nowrap">
          {tr(lang, '연속 출석', 'in a row', '连续出勤')}
        </span>
      </span>
      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
    </button>
  );
};

/** 메달함: streak badges + every month's medal. */
export const MedalSheet: React.FC<{
  lang: AppLanguage;
  attendance: AttendanceMap;
  todayStr: string;
  onClose: () => void;
}> = ({ lang, attendance, todayStr, onClose }) => {
  const thisMonth = todayStr.slice(0, 7);
  const months = useMemo(() => medalMonths(attendance, thisMonth), [attendance, thisMonth]);
  const streak = useMemo(() => attendanceStreak(attendance, todayStr), [attendance, todayStr]);
  const counts = { gold: 0, silver: 0, bronze: 0 } as Record<MedalTier, number>;
  months.forEach((m) => {
    if (m.tier && m.month < thisMonth) counts[m.tier]++;
  });
  const nextMilestone = STREAK_MILESTONES.find((n) => streak.best < n);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr(lang, '메달함', 'Medal box', '奖牌盒')}
    >
      <div className="w-full max-w-md max-h-[85vh] bg-paper rounded-t-[28px] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 pt-2.5 pb-3 border-b border-divider shrink-0 space-y-2">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 mx-auto" />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[1rem] font-bold text-ink">{tr(lang, '🏅 메달함', '🏅 Medal box', '🏅 奖牌盒')}</h3>
              <p className="text-[0.6875rem] text-slate-600">
                {tr(lang, '꾸준히 출석해서 모은 메달이에요', 'Medals earned by showing up', '坚持出勤获得的奖牌')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(lang, '닫기', 'Close', '关闭')}
              className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink hover:bg-slate-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Medal totals */}
          <div className="grid grid-cols-3 gap-2">
            {(['gold', 'silver', 'bronze'] as MedalTier[]).map((t) => (
              <div key={t} className="rounded-2xl bg-surface py-2.5 flex flex-col items-center">
                <MedalIcon tier={t} size={40} />
                <span className="font-mono text-[1.25rem] font-bold text-ink tabular-nums leading-tight">{counts[t]}</span>
                <span className="text-[0.6875rem] font-semibold text-slate-600">{tierLabel(t, lang)}</span>
              </div>
            ))}
          </div>

          {/* Streak */}
          <section className="rounded-2xl bg-surface p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[0.8125rem] font-bold text-ink inline-flex items-center gap-1">
                <Flame className="w-4 h-4 text-accent-700" strokeWidth={2.5} />
                {tr(lang, '연속 출석', 'Attendance streak', '连续出勤')}
              </h4>
              <span className="text-[0.6875rem] text-slate-600">
                {tr(lang, `최고 기록 ${streak.best}회`, `Best ${streak.best}`, `最高 ${streak.best} 次`)}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[2rem] font-bold text-accent-700 tabular-nums leading-none">{streak.current}</span>
              <span className="text-[0.8125rem] font-bold text-ink">{tr(lang, '회째 이어가는 중', 'classes in a row', '次连续')}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {STREAK_MILESTONES.map((n) => {
                const got = streak.best >= n;
                return (
                  <div
                    key={n}
                    className={`rounded-xl py-2 flex flex-col items-center ${got ? 'bg-accent-100 text-accent-800' : 'bg-paper text-slate-500'}`}
                    aria-label={tr(lang, `${n}회 연속 ${got ? '달성' : '미달성'}`, `${n} in a row ${got ? 'earned' : 'not yet'}`, `连续${n}次 ${got ? '已达成' : '未达成'}`)}
                  >
                    {got ? <Flame className="w-5 h-5" strokeWidth={2.5} /> : <Lock className="w-5 h-5" />}
                    <span className="font-mono text-[0.875rem] font-bold tabular-nums">{n}</span>
                  </div>
                );
              })}
            </div>
            {nextMilestone && (
              <p className="text-[0.75rem] text-slate-700 break-keep">
                {tr(
                  lang,
                  `${nextMilestone}회 배지까지 ${nextMilestone - streak.current}번 남았어요`,
                  `${nextMilestone - streak.current} more for the ${nextMilestone} badge`,
                  `距离 ${nextMilestone} 次徽章还差 ${nextMilestone - streak.current} 次`
                )}
              </p>
            )}
          </section>

          {/* Monthly medals */}
          <section className="space-y-2">
            <h4 className="text-[0.8125rem] font-bold text-ink">{tr(lang, '이달의 메달', 'Monthly medals', '每月奖牌')}</h4>
            {months.length === 0 ? (
              <p className="py-6 text-center text-[0.8125rem] text-slate-600">
                {tr(lang, '출석을 체크하면 여기에 메달이 모여요', 'Medals will gather here as you check attendance', '记录出勤后奖牌会集中在这里')}
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {months.map((m) => {
                  const live = m.month === thisMonth;
                  const [y, mm] = m.month.split('-');
                  return (
                    <div key={m.month} className="rounded-2xl bg-surface py-2 flex flex-col items-center text-center">
                      <span className={m.tier ? (live ? 'opacity-50' : '') : 'opacity-70'}>
                        <MedalIcon tier={m.tier} size={40} label={m.tier ? tierLabel(m.tier, lang) : undefined} />
                      </span>
                      <span className="text-[0.75rem] font-bold text-ink leading-tight">
                        {monthName(m.month, lang)}
                      </span>
                      <span className="text-[0.625rem] text-slate-600 tabular-nums">
                        {live ? tr(lang, '진행 중', 'in progress', '进行中') : m.total < MEDAL_MIN_CLASSES ? '–' : `${Math.round(m.rate)}%`}
                      </span>
                      {Number(mm) === 1 && <span className="text-[0.5625rem] text-slate-500">{y}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Rules */}
          <section className="rounded-2xl border border-divider p-3 space-y-1.5">
            <h4 className="text-[0.75rem] font-bold text-ink">{tr(lang, '메달 받는 방법', 'How to earn medals', '如何获得奖牌')}</h4>
            <ul className="text-[0.6875rem] text-slate-700 leading-relaxed space-y-0.5 break-keep">
              {MEDAL_TIERS.map((t) => (
                <li key={t.tier}>
                  · {tierLabel(t.tier, lang)}:{' '}
                  {t.min === 100
                    ? tr(lang, '한 달 동안 모든 수업 출석', 'every class in the month', '整月全勤')
                    : tr(lang, `한 달 출석률 ${t.min}% 이상`, `${t.min}%+ for the month`, `月出勤率 ${t.min}% 以上`)}
                </li>
              ))}
              <li>
                ·{' '}
                {tr(
                  lang,
                  '지각은 출석으로 쳐요. 결석해도 보강을 마치면 출석으로 바뀌어요',
                  'Late counts as present. A missed class counts once its makeup is done',
                  '迟到算出勤。缺席的课完成补课后算出勤'
                )}
              </li>
              <li>
                ·{' '}
                {tr(
                  lang,
                  `공식휴강은 빼고 계산하고, 한 달에 ${MEDAL_MIN_CLASSES}번 이상 체크해야 메달을 받아요`,
                  `Official days off don't count; a month needs ${MEDAL_MIN_CLASSES}+ checked classes`,
                  `官方停课不计入；每月需记录 ${MEDAL_MIN_CLASSES} 次以上`
                )}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

/** One-time 🎉 popup for something newly earned. */
export const MedalCelebration: React.FC<{ lang: AppLanguage; id: string; onClose: () => void }> = ({ lang, id, onClose }) => {
  const [kind, a, b] = id.split(':');
  const isMonth = kind === 'month';
  const tier = (isMonth ? b : null) as MedalTier | null;
  const title = isMonth
    ? tr(lang, `${monthName(a, lang)} ${tierLabel(tier!, lang)}!`, `${tierLabel(tier!, lang)} for ${monthName(a, lang)}!`, `${monthName(a, lang)}${tierLabel(tier!, lang)}！`)
    : tr(lang, `${a}회 연속 출석!`, `${a} classes in a row!`, `连续出勤 ${a} 次！`);
  const text = isMonth
    ? tr(lang, '한 달 동안 정말 꾸준했어요. 멋져요!', 'You kept it up all month. Great job!', '整个月都很坚持，太棒了！')
    : tr(lang, '한 번도 빠지지 않고 해냈어요. 대단해요!', "You didn't miss a single one. Amazing!", '一次都没缺席，真厉害！');
  return (
    <div className="fixed inset-0 z-[55] bg-slate-900/60 flex items-center justify-center px-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative w-full max-w-xs rounded-[28px] bg-paper shadow-2xl px-5 pt-7 pb-5 text-center space-y-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 flex justify-around text-[1.25rem] opacity-80" aria-hidden="true">
          <span className="animate-bounce [animation-delay:0ms]">🎉</span>
          <span className="animate-bounce [animation-delay:150ms]">✨</span>
          <span className="animate-bounce [animation-delay:300ms]">🎊</span>
        </div>
        <div className="flex justify-center pt-3">
          {isMonth ? (
            <MedalIcon tier={tier} size={96} />
          ) : (
            <span className="w-24 h-24 rounded-full bg-accent-100 text-accent-700 flex flex-col items-center justify-center">
              <Flame className="w-10 h-10" strokeWidth={2.5} />
              <span className="font-mono text-[1.25rem] font-bold tabular-nums leading-none">{a}</span>
            </span>
          )}
        </div>
        <h3 className="text-[1.25rem] font-bold text-ink">{title}</h3>
        <p className="text-[0.875rem] text-slate-700 break-keep">{text}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-full bg-accent-700 text-paper text-[1rem] font-bold hover:bg-accent-800"
        >
          {tr(lang, '고마워요!', 'Yay!', '太好了！')}
        </button>
      </div>
    </div>
  );
};
