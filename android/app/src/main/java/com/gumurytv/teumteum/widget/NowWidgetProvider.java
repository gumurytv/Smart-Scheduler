package com.gumurytv.teumteum.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.MainActivity;
import com.gumurytv.teumteum.R;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 「지금」 home-screen widget: the class happening now (with time left) and the next one.
 *
 * The app sends the classes of the next 8 days (buildNativeNowWidget in src/utils/widgetSync.ts);
 * the widget picks current/next from the clock, so it stays right while the app is closed.
 * It redraws at the next class boundary (at most every 5 minutes) with a non-waking alarm.
 */
public class NowWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "teumteum_widgets";
    static final String KEY_NOW = "now_json";
    private static final String ACTION_REFRESH = "com.gumurytv.teumteum.widget.NOW_REFRESH";
    private static final long MAX_REFRESH_MS = 5 * 60 * 1000L;

    // ---- entry points ----

    static void saveAndRefresh(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_NOW, json).apply();
        refreshAll(context);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NowWidgetProvider.class));
        if (ids.length == 0) {
            cancelRefresh(context);
            return;
        }
        Snapshot snapshot = Snapshot.compute(readPayload(context), Calendar.getInstance());
        RemoteViews views = render(context, snapshot);
        for (int id : ids) manager.updateAppWidget(id, views);
        scheduleRefresh(context, snapshot.nextRefreshAt);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        refreshAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
            || Intent.ACTION_DATE_CHANGED.equals(action)) {
            refreshAll(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        cancelRefresh(context);
    }

    // ---- rendering ----

    private static RemoteViews render(Context context, Snapshot s) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_now);
        v.setOnClickPendingIntent(R.id.widget_now_root, openAppIntent(context));

        if (s.empty) {
            s.title = context.getString(R.string.widget_now_empty_title);
            s.subtitle = context.getString(R.string.widget_now_empty_subtitle);
        }
        v.setTextViewText(R.id.widget_now_label, "● " + s.nowLabel);
        v.setTextViewText(R.id.widget_now_date, s.dateLabel);
        v.setTextViewText(R.id.widget_now_title, s.title);
        v.setTextViewText(R.id.widget_now_subtitle, s.subtitle);
        v.setViewVisibility(R.id.widget_now_subtitle, s.subtitle.isEmpty() ? View.GONE : View.VISIBLE);

        if (s.progress >= 0) {
            v.setProgressBar(R.id.widget_now_progress, 100, s.progress, false);
            v.setViewVisibility(R.id.widget_now_progress, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.widget_now_progress, View.GONE);
        }

        if (s.nextTitle != null) {
            v.setTextViewText(R.id.widget_now_next_label, s.nextLabel);
            v.setTextViewText(R.id.widget_now_next_title, s.nextTitle);
            v.setTextViewText(R.id.widget_now_next_time, s.nextTime);
            v.setViewVisibility(R.id.widget_now_next_row, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.widget_now_next_row, View.GONE);
        }
        return v;
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---- refresh scheduling ----

    private static PendingIntent refreshIntent(Context context) {
        Intent intent = new Intent(context, NowWidgetProvider.class).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleRefresh(Context context, long at) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        // RTC (not _WAKEUP): never wakes the phone; a missed refresh runs when the screen turns on.
        alarms.set(AlarmManager.RTC, at, refreshIntent(context));
    }

    private static void cancelRefresh(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(refreshIntent(context));
    }

    private static JSONObject readPayload(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_NOW, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    // ---- what to show right now ----

    static final class Snapshot {
        boolean empty = false; // no usable data: render() shows the "open the app" message
        String nowLabel = "지금";
        String dateLabel = "";
        String title = "";
        String subtitle = "";
        int progress = -1; // -1 hides the bar
        String nextLabel = "";
        String nextTitle = null; // null hides the "next" row
        String nextTime = "";
        long nextRefreshAt;

        static Snapshot compute(JSONObject data, Calendar now) {
            Snapshot s = new Snapshot();
            long nowMs = now.getTimeInMillis();
            s.nextRefreshAt = Math.min(nowMs + MAX_REFRESH_MS, startOfNextDay(now));

            JSONArray days = data == null ? null : data.optJSONArray("days");
            int todayIndex = -1;
            String today = String.format(
                Locale.US, "%04d-%02d-%02d",
                now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
            if (days != null) {
                for (int i = 0; i < days.length(); i++) {
                    JSONObject day = days.optJSONObject(i);
                    if (day != null && today.equals(day.optString("date"))) {
                        todayIndex = i;
                        break;
                    }
                }
            }
            if (todayIndex < 0) {
                // No data yet, or older than the 8 days the app sent: ask to open the app once.
                s.empty = true;
                s.nextRefreshAt = startOfNextDay(now);
                return s;
            }

            JSONObject labels = data.optJSONObject("labels");
            JSONObject dur = data.optJSONObject("dur");
            s.nowLabel = label(labels, "now", "지금");
            JSONObject todayData = days.optJSONObject(todayIndex);
            s.dateLabel = todayData.optString("dateLabel", "");
            JSONArray items = todayData.optJSONArray("items");
            int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

            JSONObject current = null;
            JSONObject next = null;
            int count = items == null ? 0 : items.length();
            for (int i = 0; i < count; i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                int start = minutes(item.optString("s"));
                int end = minutes(item.optString("e"));
                if (current == null && start <= nowMin && nowMin < end) current = item;
                else if (next == null && start > nowMin) next = item;
            }

            if (current != null) {
                int start = minutes(current.optString("s"));
                int end = minutes(current.optString("e"));
                s.title = current.optString("t");
                s.subtitle = current.optString("b") + " · "
                    + fill(label(labels, "leftTpl", "{d} 남음"), duration(end - nowMin, dur));
                s.progress = Math.max(0, Math.min(100, (nowMin - start) * 100 / Math.max(1, end - start)));
                s.nextRefreshAt = Math.min(s.nextRefreshAt, atMinute(now, end));
            } else if (next != null) {
                int start = minutes(next.optString("s"));
                s.title = label(labels, "free", "지금은 빈 시간");
                s.subtitle = fill(label(labels, "untilNextTpl", "다음 수업까지 {d}"), duration(start - nowMin, dur));
            } else if (count > 0) {
                s.title = label(labels, "done", "오늘 일정 끝");
                s.subtitle = label(labels, "doneSub", "");
            } else {
                s.title = label(labels, "none", "오늘은 수업이 없어요");
                s.subtitle = label(labels, "noneSub", "");
            }

            s.nextLabel = label(labels, "next", "다음");
            if (next != null) {
                int start = minutes(next.optString("s"));
                s.nextTitle = next.optString("t");
                s.nextTime = next.optString("s") + " · "
                    + fill(label(labels, "laterTpl", "{d} 후"), duration(start - nowMin, dur));
                s.nextRefreshAt = Math.min(s.nextRefreshAt, atMinute(now, start));
            } else {
                // Nothing left today: show the first class of the coming days.
                for (int i = todayIndex + 1; i < days.length() && s.nextTitle == null; i++) {
                    JSONObject day = days.optJSONObject(i);
                    JSONArray dayItems = day == null ? null : day.optJSONArray("items");
                    JSONObject first = dayItems == null ? null : dayItems.optJSONObject(0);
                    if (first != null) {
                        s.nextTitle = first.optString("t");
                        String when = i == todayIndex + 1
                            ? label(labels, "tomorrow", "내일")
                            : day.optString("dateLabel");
                        s.nextTime = when + " " + first.optString("s");
                    }
                }
            }
            return s;
        }

        private static String label(JSONObject labels, String key, String fallback) {
            return labels == null ? fallback : labels.optString(key, fallback);
        }

        private static String fill(String template, String value) {
            return template.replace("{d}", value);
        }

        private static String duration(int minutes, JSONObject dur) {
            String h = dur == null ? "시간" : dur.optString("h", "시간");
            String m = dur == null ? "분" : dur.optString("m", "분");
            String sep = dur == null ? " " : dur.optString("sep", " ");
            int total = Math.max(0, minutes);
            int hours = total / 60;
            int mins = total % 60;
            if (hours > 0 && mins > 0) return hours + h + sep + mins + m;
            if (hours > 0) return hours + h;
            return mins + m;
        }

        private static int minutes(String hhmm) {
            try {
                String[] parts = hhmm.split(":");
                return Integer.parseInt(parts[0].trim()) * 60 + Integer.parseInt(parts[1].trim());
            } catch (Exception e) {
                return -1;
            }
        }

        private static long atMinute(Calendar now, int minuteOfDay) {
            Calendar c = (Calendar) now.clone();
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            c.add(Calendar.MINUTE, minuteOfDay);
            return c.getTimeInMillis();
        }

        private static long startOfNextDay(Calendar now) {
            return atMinute(now, 24 * 60) + 1000L;
        }
    }
}
