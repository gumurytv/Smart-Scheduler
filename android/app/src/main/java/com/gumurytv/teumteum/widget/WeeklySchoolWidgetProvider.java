package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.R;
import org.json.JSONArray;
import org.json.JSONObject;

/** 주간 학교 시간표: Mon–Fri × periods grid for the week containing today, today highlighted. */
public class WeeklySchoolWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetRefresher.refreshAll(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetRefresher.refreshAll(context);
    }

    static RemoteViews render(Context context, WidgetKit k) {
        String pkg = context.getPackageName();
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_frame);
        k.frame(context, v);
        int weekIndex = k.weekIndex();
        JSONArray weeks = k.array("schoolWeeks");
        JSONObject week = weeks == null || weekIndex < 0 ? null : weeks.optJSONObject(weekIndex);
        if (week == null) {
            WidgetKit.showOpenAppMessage(context, k, v);
            return v;
        }

        k.text(v, R.id.wd_title, week.optString("title"), k.text(), 13);
        k.text(v, R.id.wd_right, k.label("monFri", "월~금"), k.sub(), 11);
        v.removeAllViews(R.id.wd_body);
        JSONArray days = week.optJSONArray("days");
        int dayCount = days == null ? 0 : Math.min(5, days.length());
        int periods = Math.max(1, Math.min(8, week.optInt("periods", 1)));

        // Header: weekday + date, today highlighted
        RemoteViews head = new RemoteViews(pkg, R.layout.wd_row_head);
        head.addView(R.id.wd_row, sideCell(pkg, k, ""));
        for (int d = 0; d < dayCount; d++) {
            JSONObject day = days.optJSONObject(d);
            boolean isToday = k.today.equals(day.optString("date"));
            RemoteViews cell = new RemoteViews(pkg, R.layout.wd_cell);
            String label = day.optString("dl") + "\n" + day.optInt("dn");
            k.text(cell, R.id.wd_cell, WidgetKit.styled(label, true, false),
                isToday ? k.pick(WidgetKit.ACCENT_800, WidgetKit.ACCENT_300) : k.text(), 11);
            if (isToday) k.background(cell, R.id.wd_cell, R.drawable.wd_head_today_l, R.drawable.wd_head_today_d);
            head.addView(R.id.wd_row, cell);
        }
        v.addView(R.id.wd_body, head);

        for (int p = 0; p < periods; p++) {
            RemoteViews row = new RemoteViews(pkg, R.layout.wd_row);
            row.addView(R.id.wd_row, sideCell(pkg, k, String.valueOf(p + 1)));
            for (int d = 0; d < dayCount; d++) {
                JSONObject day = days.optJSONObject(d);
                boolean isToday = k.today.equals(day.optString("date"));
                JSONArray cells = day.optJSONArray("cells");
                JSONObject c = cells == null ? null : cells.optJSONObject(p);
                row.addView(R.id.wd_row, periodCell(pkg, k, c, isToday));
            }
            v.addView(R.id.wd_body, row);
        }
        v.setViewVisibility(R.id.wd_footer, android.view.View.GONE);
        return v;
    }

    private static RemoteViews sideCell(String pkg, WidgetKit k, String value) {
        RemoteViews cell = new RemoteViews(pkg, R.layout.wd_cell_side);
        k.text(cell, R.id.wd_cell, value, k.sub(), 10);
        return cell;
    }

    private static RemoteViews periodCell(String pkg, WidgetKit k, JSONObject c, boolean isToday) {
        RemoteViews cell = new RemoteViews(pkg, R.layout.wd_cell);
        if (c == null) {
            k.text(cell, R.id.wd_cell, "-", k.muted(), 11);
            return cell;
        }
        String title = c.optString("t");
        boolean cancelled = c.optInt("x", 0) == 1;
        String status = c.optString("st", "");
        if (cancelled) {
            k.text(cell, R.id.wd_cell, WidgetKit.styled(title, false, true), k.muted(), 11);
        } else if ("absent".equals(status)) {
            k.text(cell, R.id.wd_cell, WidgetKit.styled(title, true, false), k.pick(WidgetKit.ACCENT_900, WidgetKit.ACCENT_200), 11);
            k.background(cell, R.id.wd_cell, R.drawable.wd_cell_absent_l, R.drawable.wd_cell_absent_d);
        } else if ("selfStudy".equals(status)) {
            k.text(cell, R.id.wd_cell, title, k.text(), 11);
            k.background(cell, R.id.wd_cell, R.drawable.wd_cell_self_l, R.drawable.wd_cell_self_d);
        } else if (isToday) {
            k.text(cell, R.id.wd_cell, WidgetKit.styled(title, true, false), k.pick(WidgetKit.SAGE_900, WidgetKit.SAGE_100), 11);
            k.background(cell, R.id.wd_cell, R.drawable.wd_cell_today_l, R.drawable.wd_cell_today_d);
        } else {
            k.text(cell, R.id.wd_cell, title, k.pick(WidgetKit.SAGE_900, WidgetKit.SAGE_200), 11);
            k.background(cell, R.id.wd_cell, R.drawable.wd_cell_school_l, R.drawable.wd_cell_school_d);
        }
        return cell;
    }
}
