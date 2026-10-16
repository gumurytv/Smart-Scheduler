package com.gumurytv.teumteum.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.util.Calendar;

/**
 * Redraws every placed widget and books the next redraw: at the next class boundary or within
 * 5 minutes while a 「지금」 or timeline widget is placed, otherwise just after midnight.
 * Uses a non-waking alarm, so a missed redraw happens when the screen turns on.
 */
final class WidgetRefresher {

    static final String ACTION_REFRESH = "com.gumurytv.teumteum.widget.REFRESH";
    private static final long LIVE_REFRESH_MS = 5 * 60 * 1000L;

    /** Every widget kind: the id the app uses (HomeWidgetId) and its provider. */
    enum Kind {
        NOW("now", NowWidgetProvider.class),
        WEEKLY_SCHOOL("weeklySchool", WeeklySchoolWidgetProvider.class),
        WEEKLY_ACADEMY("weeklyAcademy", WeeklyAcademyWidgetProvider.class),
        TIMELINE("timeline", TimelineWidgetProvider.class),
        MONTH_CALENDAR("monthCalendar", MonthCalendarWidgetProvider.class);

        final String id;
        final Class<?> provider;

        Kind(String id, Class<?> provider) {
            this.id = id;
            this.provider = provider;
        }

        static Kind fromId(String id) {
            for (Kind k : values()) if (k.id.equals(id)) return k;
            return null;
        }
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Calendar now = Calendar.getInstance();
        WidgetKit kit = WidgetKit.load(context, now);
        long next = startOfNextDay(now);
        boolean any = false;

        for (Kind kind : Kind.values()) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, kind.provider));
            if (ids.length == 0) continue;
            any = true;
            RemoteViews views;
            switch (kind) {
                case NOW: {
                    NowWidgetProvider.Snapshot s = NowWidgetProvider.Snapshot.compute(kit);
                    views = NowWidgetProvider.render(context, kit, s);
                    next = Math.min(next, s.nextBoundaryAt);
                    next = Math.min(next, now.getTimeInMillis() + LIVE_REFRESH_MS);
                    break;
                }
                case WEEKLY_SCHOOL:
                    views = WeeklySchoolWidgetProvider.render(context, kit);
                    break;
                case WEEKLY_ACADEMY:
                    views = WeeklyAcademyWidgetProvider.render(context, kit);
                    break;
                case TIMELINE:
                    views = TimelineWidgetProvider.render(context, kit);
                    next = Math.min(next, now.getTimeInMillis() + LIVE_REFRESH_MS);
                    break;
                default:
                    views = MonthCalendarWidgetProvider.render(context, kit);
                    break;
            }
            for (int id : ids) manager.updateAppWidget(id, views);
        }

        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        if (any) alarms.set(AlarmManager.RTC, next, refreshIntent(context));
        else alarms.cancel(refreshIntent(context));
    }

    static int placedCount(Context context, Kind kind) {
        return AppWidgetManager.getInstance(context)
            .getAppWidgetIds(new ComponentName(context, kind.provider)).length;
    }

    private static PendingIntent refreshIntent(Context context) {
        Intent intent = new Intent(context, WidgetRefreshReceiver.class).setAction(ACTION_REFRESH);
        return PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static long startOfNextDay(Calendar now) {
        return WidgetKit.atMinute(now, 24 * 60) + 1000L;
    }

    private WidgetRefresher() {}
}
