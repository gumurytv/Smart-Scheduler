package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.R;
import org.json.JSONArray;
import org.json.JSONObject;

/** 「지금」 widget: the class happening now (time left, progress) and the next one. */
public class NowWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetRefresher.refreshAll(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefresher.refreshAll(context);
    }

    static RemoteViews render(Context context, WidgetKit k, Snapshot s) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.wd_now);
        k.frame(context, v);

        if (s.empty) {
            s.title = context.getString(R.string.widget_empty_title);
            s.subtitle = context.getString(R.string.widget_empty_subtitle);
        }
        k.text(v, R.id.now_label, "● " + s.nowLabel, k.pick(WidgetKit.ACCENT_700, WidgetKit.ACCENT_400), 12);
        k.text(v, R.id.now_date, s.dateLabel, k.sub(), 12);
        v.setTextColor(R.id.now_clock, k.text());
        k.size(v, R.id.now_clock, 15);
        k.text(v, R.id.now_title, s.title, k.text(), 20);
        k.text(v, R.id.now_subtitle, s.subtitle, k.sub(), 13);
        v.setViewVisibility(R.id.now_subtitle, s.subtitle.isEmpty() ? View.GONE : View.VISIBLE);

        int shown = k.dark ? R.id.now_progress_d : R.id.now_progress_l;
        int hidden = k.dark ? R.id.now_progress_l : R.id.now_progress_d;
        v.setViewVisibility(hidden, View.GONE);
        if (s.progress >= 0) {
            v.setProgressBar(shown, 100, s.progress, false);
            v.setViewVisibility(shown, View.VISIBLE);
        } else {
            v.setViewVisibility(shown, View.GONE);
        }

        if (s.nextTitle != null) {
            k.background(v, R.id.now_next_row, R.drawable.wd_panel_l, R.drawable.wd_panel_d);
            k.text(v, R.id.now_next_label, s.nextLabel, k.pick(WidgetKit.SAGE_700, WidgetKit.SAGE_400), 12);
            k.text(v, R.id.now_next_title, s.nextTitle, k.text(), 13);
            k.text(v, R.id.now_next_time, s.nextTime, k.accentText(), 12);
            v.setViewVisibility(R.id.now_next_row, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.now_next_row, View.GONE);
        }
        return v;
    }

    /** What to show right now, worked out from the payload and the clock. */
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
        long nextBoundaryAt = Long.MAX_VALUE; // when the current class ends / the next one starts

        static Snapshot compute(WidgetKit k) {
            Snapshot s = new Snapshot();
            int todayIndex = k.todayIndex();
            if (todayIndex < 0) {
                s.empty = true;
                return s;
            }
            JSONArray days = k.array("days");
            s.nowLabel = k.label("now", "지금");
            s.nextLabel = k.label("next", "다음");
            JSONObject todayData = days.optJSONObject(todayIndex);
            s.dateLabel = todayData.optString("dateLabel", "");

            JSONObject current = null;
            JSONObject next = null;
            int classes = 0;
            JSONArray items = todayData.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (!isClass(item)) continue;
                classes++;
                int start = WidgetKit.minutes(item.optString("s"));
                int end = WidgetKit.minutes(item.optString("e"));
                if (current == null && start <= k.nowMin && k.nowMin < end) current = item;
                else if (next == null && start > k.nowMin) next = item;
            }

            if (current != null) {
                int start = WidgetKit.minutes(current.optString("s"));
                int end = WidgetKit.minutes(current.optString("e"));
                s.title = current.optString("t");
                s.subtitle = current.optString("b") + " · "
                    + WidgetKit.fill(k.label("leftTpl", "{d} 남음"), "d", k.duration(end - k.nowMin));
                s.progress = Math.max(0, Math.min(100, (k.nowMin - start) * 100 / Math.max(1, end - start)));
                s.nextBoundaryAt = WidgetKit.atMinute(k.now, end);
            } else if (next != null) {
                int start = WidgetKit.minutes(next.optString("s"));
                s.title = k.label("free", "지금은 빈 시간");
                s.subtitle = WidgetKit.fill(k.label("untilNextTpl", "다음 수업까지 {d}"), "d", k.duration(start - k.nowMin));
            } else if (classes > 0) {
                s.title = k.label("done", "오늘 일정 끝");
                s.subtitle = k.label("doneSub", "");
            } else {
                s.title = k.label("none", "오늘은 수업이 없어요");
                s.subtitle = k.label("noneSub", "");
            }

            if (next != null) {
                int start = WidgetKit.minutes(next.optString("s"));
                s.nextTitle = next.optString("t");
                s.nextTime = next.optString("s") + " · "
                    + WidgetKit.fill(k.label("laterTpl", "{d} 후"), "d", k.duration(start - k.nowMin));
                s.nextBoundaryAt = Math.min(s.nextBoundaryAt, WidgetKit.atMinute(k.now, start));
            } else {
                // Nothing left today: the first class of the coming days.
                for (int i = todayIndex + 1; i < days.length() && s.nextTitle == null; i++) {
                    JSONObject day = days.optJSONObject(i);
                    JSONArray dayItems = day == null ? null : day.optJSONArray("items");
                    for (int j = 0; dayItems != null && j < dayItems.length(); j++) {
                        JSONObject first = dayItems.optJSONObject(j);
                        if (!isClass(first)) continue;
                        String when = i == todayIndex + 1 ? k.label("tomorrow", "내일") : day.optString("dateLabel");
                        s.nextTitle = first.optString("t");
                        s.nextTime = when + " " + first.optString("s");
                        break;
                    }
                }
            }
            return s;
        }

        /** School/academy classes that take place (not events, not cancelled). */
        private static boolean isClass(JSONObject item) {
            return item != null && !"event".equals(item.optString("k")) && item.optInt("x", 0) != 1;
        }
    }
}
