package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.R;
import org.json.JSONArray;
import org.json.JSONObject;

/** 월간 캘린더: this month with a coloured dot per day for school / academy / other events. */
public class MonthCalendarWidgetProvider extends AppWidgetProvider {

    private static final int[] DOT_COLORS = {WidgetKit.SAGE, WidgetKit.ACCENT, WidgetKit.OTHER};

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
        JSONObject month = currentMonth(k);
        if (month == null) {
            WidgetKit.showOpenAppMessage(context, k, v);
            return v;
        }

        k.text(v, R.id.wd_title, month.optString("title"), k.text(), 13);
        String[] names = {k.label("school", "학교"), k.label("academy", "학원"), k.label("other", "기타")};
        SpannableStringBuilder legend = new SpannableStringBuilder();
        for (int i = 0; i < 3; i++) {
            if (i > 0) legend.append("  ");
            dot(legend, DOT_COLORS[i]);
            legend.append(" ").append(names[i]);
        }
        k.text(v, R.id.wd_right, legend, k.sub(), 10);
        v.removeAllViews(R.id.wd_body);

        RemoteViews head = new RemoteViews(pkg, R.layout.wd_row_head);
        JSONArray names7 = month.optJSONArray("head");
        for (int i = 0; i < 7; i++) {
            RemoteViews cell = new RemoteViews(pkg, R.layout.wd_cell);
            String name = names7 == null ? "" : names7.optString(i);
            k.text(cell, R.id.wd_cell, name, i == 0 ? k.accentText() : k.sub(), 10);
            head.addView(R.id.wd_row, cell);
        }
        v.addView(R.id.wd_body, head);

        JSONArray cells = month.optJSONArray("cells");
        int count = cells == null ? 0 : cells.length();
        for (int r = 0; r * 7 < count; r++) {
            RemoteViews row = new RemoteViews(pkg, R.layout.wd_row);
            for (int c = 0; c < 7 && r * 7 + c < count; c++) {
                row.addView(R.id.wd_row, dayCell(pkg, k, cells.optJSONObject(r * 7 + c)));
            }
            v.addView(R.id.wd_body, row);
        }
        v.setViewVisibility(R.id.wd_footer, View.GONE);
        return v;
    }

    /** The month (of the two sent) that contains today, or null when the data is too old. */
    private static JSONObject currentMonth(WidgetKit k) {
        JSONArray months = k.array("months");
        for (int m = 0; months != null && m < months.length(); m++) {
            JSONObject month = months.optJSONObject(m);
            JSONArray cells = month == null ? null : month.optJSONArray("cells");
            for (int i = 0; cells != null && i < cells.length(); i++) {
                JSONObject cell = cells.optJSONObject(i);
                if (cell != null && cell.optBoolean("in") && k.today.equals(cell.optString("date"))) return month;
            }
        }
        return null;
    }

    private static RemoteViews dayCell(String pkg, WidgetKit k, JSONObject cell) {
        RemoteViews v = new RemoteViews(pkg, R.layout.wd_month_cell);
        boolean isToday = k.today.equals(cell.optString("date"));
        boolean inMonth = cell.optBoolean("in");
        int color = isToday ? WidgetKit.PAPER : inMonth ? k.text() : k.muted();
        k.text(v, R.id.mc_day, WidgetKit.styled(String.valueOf(cell.optInt("dn")), isToday, false), color, 11);
        if (isToday) k.background(v, R.id.mc_cell, R.drawable.wd_month_today_l, R.drawable.wd_month_today_d);

        SpannableStringBuilder dots = new SpannableStringBuilder();
        JSONArray counts = cell.optJSONArray("c");
        for (int i = 0; counts != null && i < 3; i++) {
            if (counts.optInt(i, 0) > 0) dot(dots, isToday ? WidgetKit.PAPER : DOT_COLORS[i]);
        }
        // Keep the row height even on days without events.
        k.text(v, R.id.mc_dots, dots.length() > 0 ? dots : " ", k.text(), 7);
        return v;
    }

    private static void dot(SpannableStringBuilder out, int color) {
        int start = out.length();
        out.append("●");
        out.setSpan(new ForegroundColorSpan(color), start, out.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    }
}
