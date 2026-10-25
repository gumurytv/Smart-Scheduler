import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AppLanguage } from '../types';
import { tr } from '../i18n/translations';
import { APP_VERSION } from '../data/changelog';
import { isNativeApp } from '../native/androidShell';

export const FEEDBACK_EMAIL = 'dbo0ofly@gmail.com';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.gumurytv.teumteum';

type FeedbackKind = 'bug' | 'wish' | 'other';

const KINDS: Array<{ id: FeedbackKind; label: [string, string, string] }> = [
  { id: 'bug', label: ['불편 · 오류', 'Problem · bug', '不便 · 错误'] },
  { id: 'wish', label: ['바라는 기능', 'Feature idea', '希望的功能'] },
  { id: 'other', label: ['기타', 'Other', '其他'] },
];

const LANGUAGE_NAMES: Record<AppLanguage, string> = { ko: '한국어', en: 'English', zh: '中文' };

/** Short device description for the mail footer (no personal data). */
function deviceLabel(): string {
  const android = /Android\s+([\d.]+)/.exec(navigator.userAgent);
  if (isNativeApp) return android ? `Android app (Android ${android[1]})` : 'Android app';
  return android ? `Web (Android ${android[1]})` : 'Web';
}

/**
 * Opens a link outside the app. In the Android app, Capacitor hands any non-app URL
 * (mailto:, the Play Store) to the system, so a plain navigation is enough there.
 */
function openExternal(url: string) {
  if (isNativeApp || url.startsWith('mailto:')) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

/** 설정 → 의견 보내기: pick a kind, write a note, then hand it to the mail app (or the Play Store). */
export const FeedbackPanel: React.FC<{ lang: AppLanguage }> = ({ lang }) => {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [text, setText] = useState('');

  const sendMail = () => {
    const kindLabel = KINDS.find((k) => k.id === kind)!.label;
    const subject = `[틈틈] ${kindLabel[0]}`;
    const body = [
      text.trim() || tr(lang, '(여기에 내용을 적어 주세요)', '(Write your message here)', '（请在这里填写内容）'),
      '',
      '----',
      `${tr(lang, '앱 버전', 'App version', '应用版本')}: ${APP_VERSION}`,
      `${tr(lang, '언어', 'Language', '语言')}: ${LANGUAGE_NAMES[lang] ?? lang}`,
      `${tr(lang, '기기', 'Device', '设备')}: ${deviceLabel()}`,
    ].join('\n');
    openExternal(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <div className="p-4 space-y-3">
      <p className="text-[0.75rem] text-slate-700 leading-relaxed break-keep">
        {tr(
          lang,
          '불편한 점이나 바라는 기능을 알려 주세요. 보내 주신 의견은 다음 업데이트에 반영할게요.',
          'Tell us what bothers you or what you would like. Your feedback shapes the next update.',
          '请告诉我们不便之处或希望的功能，我们会在下次更新中参考。'
        )}
      </p>

      <div className="space-y-1.5">
        <p className="text-[0.75rem] font-bold text-ink">{tr(lang, '어떤 의견인가요?', 'What is it about?', '是哪类意见？')}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tr(lang, '의견 종류', 'Feedback type', '意见类型')}>
          {KINDS.map((k) => {
            const selected = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(k.id)}
                className={`min-h-11 px-2 py-2 rounded-xl text-[0.8125rem] font-bold leading-tight break-keep ${
                  selected ? 'bg-accent-700 text-paper' : 'bg-paper text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
                }`}
              >
                {tr(lang, ...k.label)}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-[0.75rem] font-bold text-ink">{tr(lang, '내용', 'Message', '内容')}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={tr(
            lang,
            '예: 주간 보기에서 학원 수업을 누르면 보강 표시가 안 보여요',
            'e.g. In the weekly view, makeup classes are not marked',
            '例：在周视图中点补习班课程时看不到补课标记'
          )}
          className="w-full rounded-xl bg-paper ring-1 ring-slate-300 px-3 py-2.5 text-[0.875rem] text-ink placeholder:text-slate-500 leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </label>

      <button
        type="button"
        onClick={sendMail}
        className="w-full min-h-12 px-4 py-2 rounded-full bg-accent-700 text-paper text-[0.9375rem] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-accent-800"
      >
        {tr(lang, '메일로 보내기', 'Send by email', '通过邮件发送')}
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>
      <button
        type="button"
        onClick={() => openExternal(PLAY_STORE_URL)}
        className="w-full min-h-12 px-4 py-2 rounded-full bg-paper text-ink ring-1 ring-slate-300 text-[0.875rem] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-slate-100"
      >
        {tr(lang, 'Play 스토어에 의견 남기기', 'Review on Google Play', '在 Play 商店留言')}
        <ArrowRight className="w-4 h-4 shrink-0" />
      </button>

      <p className="text-[0.6875rem] text-slate-600 leading-relaxed break-keep">
        {tr(
          lang,
          '메일 앱이 열리고 앱 버전 · 언어 · 기기 정보가 함께 적혀요. 시간표 · 일정 · 메모 같은 기록은 보내지 않아요.',
          'Your mail app opens with the app version, language and device filled in. Timetables, events and memos are never sent.',
          '会打开邮件应用，并附上应用版本、语言和设备信息。课表、日程、备忘录等记录不会发送。'
        )}
      </p>
    </div>
  );
};
