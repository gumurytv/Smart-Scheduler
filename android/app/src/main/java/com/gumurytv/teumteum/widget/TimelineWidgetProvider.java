package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.R;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** 오늘 타임라인: today's classes, events and free time in order, focused around now. */
public class TimelineWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetRefresher.refreshAll(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefresher.refreshAll(context);
    }

    /** One line of the list: a class/event (item != null) or a free gap. */
    private static final class Row implements Comparable<Row> {
        final String start;
        final JSONObject item;
        final JSONObject free;

        Row(String start, JSONObject item, JSONObject free) {
            this.start = start;
            this.item = item;
            this.free = free;
        }

        @Override
        public int compareTo(Row other) {
            return start.compareTo(other.start);
        }
    }

    static RemoteViews render(Context context, WidgetKit k) {
        String pkg = context.getPackageName();
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_frame);
        k.frame(context, v);
        int todayIndex = k.todayIndex();
        if (todayIndex < 0) {
            WidgetKit.showOpenAppMessage(context, k, v);
            return v;
        }
        JSONObject day = k.array("days").optJSONObject(todayIndex);
        k.header(v, R.drawable.ic_wd_clock, R.drawable.wd_icon_bg_accent,
            k.label("today", "오늘") + " · " + day.optString("dateLabel"),
            WidgetKit.fill(k.label("freeTotalTpl", "빈 시간 {d}"), "d", day.optString("freeTotal")));
        v.removeAllViews(R.id.wd_body);

        List<Row> rows = new ArrayList<>();
        JSONArray items = day.optJSONArray("items");
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it != null) rows.add(new Row(it.optString("s"), it, null));
        }
        JSONArray frees = day.optJSONArray("free");
        for (int i = 0; frees != null && i < frees.length(); i++) {
            JSONObject f = frees.optJSONObject(i);
            if (f != null) rows.add(new Row(f.optString("s"), null, f));
        }
        Collections.sort(rows);

        if (rows.isEmpty()) {
            RemoteViews line = new RemoteViews(pkg, R.layout.wd_timeline_row);
            line.setViewVisibility(R.id.tl_bar, View.GONE);
            line.setViewVisibility(R.id.tl_time, View.GONE);
            line.setViewVisibility(R.id.tl_kind, View.GONE);
            line.setViewVisibility(R.id.tl_tag, View.GONE);
            k.text(line, R.id.tl_title, k.label("nothingToday", "오늘 일정이 없어요"), k.muted(), 12);
            v.addView(R.id.wd_body, line);
            v.setViewVisibility(R.id.wd_footer, View.GONE);
            return v;
        }

        // Keep the list around "now": at most two finished lines before the first upcoming one.
        int max = Math.max(4, Math.round(8 / k.font));
        int firstUpcoming = -1;
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            if (r.item != null && k.nowMin < end(r.item)) {
                firstUpcoming = i;
                break;
            }
        }
        int startIdx = firstUpcoming < 0 ? Math.max(0, rows.size() - max) : Math.max(0, firstUpcoming - 2);
        int endIdx = Math.min(rows.size(), startIdx + max);

        for (int i = startIdx; i < endIdx; i++) {
            Row r = rows.get(i);
            v.addView(R.id.wd_body, r.item != null ? itemLine(pkg, k, r.item) : freeLine(pkg, k, r.free));
        }

        int hidden = rows.size() - (endIdx - startIdx);
        if (hidden > 0) {
            k.text(v, R.id.wd_footer, WidgetKit.fill(k.label("moreTpl", "외 {n}개"), "n", String.valueOf(hidden)), k.sub(), 10);
            v.setViewVisibility(R.id.wd_footer, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.wd_footer, View.GONE);
        }
        return v;
    }

    private static int end(JSONObject item) {
        int start = WidgetKit.minutes(item.optString("s"));
        int end = WidgetKit.minutes(item.optString("e"));
        return end > start ? end : start + 1; // events have no length
    }

    private static RemoteViews itemLine(String pkg, WidgetKit k, JSONObject it) {
        RemoteViews line = new RemoteViews(pkg, R.layout.wd_timeline_row);
        String kind = it.optString("k");
        boolean cancelled = it.optInt("x", 0) == 1;
        int start = WidgetKit.minutes(it.optString("s"));
        boolean past = k.nowMin >= end(it);
        boolean current = !past && start <= k.nowMin;

        int bar = cancelled ? R.drawable.wd_bar_cancel
            : "school".equals(kind) ? R.drawable.wd_bar_school
            : "academy".equals(kind) ? R.drawable.wd_bar_academy
            : R.drawable.wd_bar_event;
        line.setInt(R.id.tl_bar, "setBackgroundResource", bar);
        if (current) k.background(line, R.id.tl_row, R.drawable.wd_current_l, R.drawable.wd_current_d);

        int main = past ? k.muted() : k.text();
        String time = "event".equals(kind) ? it.optString("s") : it.optString("s") + "~" + it.optString("e");
        k.text(line, R.id.tl_time, time, past ? k.muted() : k.sub(), 11);
        k.text(line, R.id.tl_kind, "school".equals(kind) ? "" : it.optString("kl"), past ? k.muted() : k.sub(), 10);
        if ("school".equals(kind)) line.setViewVisibility(R.id.tl_kind, View.GONE);
        k.text(line, R.id.tl_title, WidgetKit.styled(it.optString("t"), true, cancelled), main, 12);

        String tag = null;
        int tagColor = k.accentText();
        if (cancelled) {
            tag = k.label("cancelled", "휴강");
            tagColor = k.muted();
        } else if (current) {
            tag = k.label("now", "지금");
        } else if (!it.optString("st", "").isEmpty()) {
            tag = it.optString("st");
            tagColor = k.pick(WidgetKit.SAGE_700, WidgetKit.SAGE_400);
        }
        if (tag != null) {
            k.text(line, R.id.tl_tag, tag, tagColor, 10);
        } else {
            line.setViewVisibility(R.id.tl_tag, View.GONE);
        }
        return line;
    }

    private static RemoteViews freeLine(String pkg, WidgetKit k, JSONObject f) {
        RemoteViews line = new RemoteViews(pkg, R.layout.wd_timeline_row);
        k.background(line, R.id.tl_row, R.drawable.wd_free_l, R.drawable.wd_free_d);
        line.setViewVisibility(R.id.tl_bar, View.GONE);
        line.setViewVisibility(R.id.tl_kind, View.GONE);
        line.setViewVisibility(R.id.tl_tag, View.GONE);
        k.text(line, R.id.tl_time, f.optString("s") + "~" + f.optString("e"), k.sub(), 11);
        k.text(line, R.id.tl_title, k.label("freeShort", "빈 시간") + " · " + f.optString("d"), k.sub(), 11);
        return line;
    }
}
