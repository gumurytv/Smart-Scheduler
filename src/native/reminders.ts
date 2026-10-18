// 보강 알림: a phone notification before each makeup/special class (Android app only; no-op in the browser).
// Every planner change re-plans the whole list: the pending notifications are replaced when it differs.
import { LocalNotifications } from '@capacitor/local-notifications';
import { AppLanguage, PlannerState, ReminderLead } from '../types';
import { tr, translateSubject, formatDateLabel } from '../i18n/translations';
import { childName, listChildren } from '../utils/children';
import { isNativeApp } from './androidShell';

const HORIZON_DAYS = 60;
const MAX_PENDING = 60;

export interface PlannedReminder {
  id: number;
  at: Date;
  classStart: Date;
  title: string;
  body: string;
}

export function reminderLeadLabel(lead: ReminderLead, lang: AppLanguage): string {
  switch (lead) {
    case 10:
      return tr(lang, '10분 전', '10 min before', '提前10分钟');
    case 30:
      return tr(lang, '30분 전', '30 min before', '提前30分钟');
    case 60:
      return tr(lang, '1시간 전', '1 hour before', '提前1小时');
    case 120:
      return tr(lang, '2시간 전', '2 hours before', '提前2小时');
    default:
      return tr(lang, '하루 전', 'The day before', '提前1天');
  }
}

function hashId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return (h & 0x7fffffff) || 1;
}

/** Upcoming makeup/special classes of every child, with their reminder times (soonest first). */
export function planMakeupReminders(state: PlannerState, now = new Date()): PlannedReminder[] {
  const cfg = state.reminders;
  if (!cfg?.enabled) return [];
  const lang = state.language || 'ko';
  const kids = listChildren(state);
  const fallback = (n: number) => tr(lang, `자녀 ${n}`, `Child ${n}`, `孩子 ${n}`);
  const horizon = now.getTime() + HORIZON_DAYS * 86400000;
  const out: PlannedReminder[] = [];
  kids.forEach((kid, idx) => {
    const who = kids.length > 1 ? childName(kid.data, idx, fallback) : '';
    Object.entries(kid.data.dailyOverrides || {}).forEach(([date, ov]) => {
      (ov.academy || []).forEach((a) => {
        if (!a.isAdded || a.notMakeup || a.isCancelled || !/^\d{2}:\d{2}$/.test(a.startTime)) return;
        const [y, m, d] = date.split('-').map(Number);
        const [hh, mm] = a.startTime.split(':').map(Number);
        const classStart = new Date(y, m - 1, d, hh, mm);
        const at = new Date(classStart.getTime() - cfg.leadMinutes * 60000);
        if (at.getTime() <= now.getTime() || at.getTime() > horizon) return;
        const subject = translateSubject(a.subject, lang);
        out.push({
          id: hashId(`${kid.id}|${date}|${a.id}|${a.startTime}`),
          at,
          classStart,
          title: tr(
            lang,
            `${who ? `${who} · ` : ''}보강 ${reminderLeadLabel(cfg.leadMinutes, lang)} · ${subject}`,
            `${who ? `${who} · ` : ''}Makeup ${reminderLeadLabel(cfg.leadMinutes, lang).toLowerCase()} · ${subject}`,
            `${who ? `${who} · ` : ''}补课${reminderLeadLabel(cfg.leadMinutes, lang)} · ${subject}`
          ),
          body: `${formatDateLabel(date, lang)} ${a.startTime}–${a.endTime}${a.note ? ` · ${a.note}` : ''}`,
        });
      });
    });
  });
  return out.sort((x, y) => x.at.getTime() - y.at.getTime()).slice(0, MAX_PENDING);
}

/** Asks for the notification permission (Android 13+). True when notifications may be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!isNativeApp) return true;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  } catch {
    return false;
  }
}

let lastSignature = '';
let timer: ReturnType<typeof setTimeout> | null = null;

/** Replaces the pending reminders with the current plan (debounced; skipped when nothing changed). */
export function syncMakeupReminders(state: PlannerState): void {
  if (!isNativeApp) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const plan = planMakeupReminders(state);
    const signature = JSON.stringify(plan.map((p) => [p.id, p.at.getTime(), p.title, p.body]));
    if (signature === lastSignature) return;
    lastSignature = signature;
    void (async () => {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
        }
        if (plan.length === 0) return;
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') return;
        await LocalNotifications.schedule({
          notifications: plan.map((p) => ({
            id: p.id,
            title: p.title,
            body: p.body,
            schedule: { at: p.at, allowWhileIdle: true },
            // Inexact on purpose: no "Alarms & reminders" permission prompt; a few minutes' slack is fine.
            isExactNotification: false,
            extra: { kind: 'makeup' },
          })),
        });
      } catch (e) {
        lastSignature = '';
        console.warn('보강 알림 예약 실패:', e);
      }
    })();
  }, 800);
}
