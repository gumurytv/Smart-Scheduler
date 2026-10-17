package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.R;
import org.json.JSONArray;
import org.json.JSONObject;

/** 주간 학원 시간표: Mon–Sun rows with up to two academy chips each, today highlighted. */
public class WeeklyAcademyWidgetProvider extends AppWidgetProvider {

    private static final int MAX_CHIPS = 2;

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
        JSONArray weeks = k.array("academyWeeks");
        JSONObject week = weeks == null || weekIndex < 0 ? null : weeks.optJSONObject(weekIndex);
        if (week == null) {
            WidgetKit.showOpenAppMessage(context, k, v);
            return v;
        }

        k.header(v, R.drawable.ic_wd_academy, R.drawable.wd_icon_bg_accent, week.optString("title"), k.label("monSun", "월~일"));
        v.removeAllViews(R.id.wd_body);
        JSONArray days = week.optJSONArray("days");
        int[] chipIds = {R.id.ac_chip1, R.id.ac_chip2};

        for (int d = 0; days != null && d < days.length(); d++) {
            JSONObject day = days.optJSONObject(d);
            boolean isToday = k.today.equals(day.optString("date"));
            RemoteViews row = new RemoteViews(pkg, R.layout.wd_academy_row);
            if (isToday) k.background(row, R.id.ac_row, R.drawable.wd_row_today_l, R.drawable.wd_row_today_d);
            k.text(row, R.id.ac_day, day.optString("dl"),
                isToday ? k.pick(WidgetKit.ACCENT_800, WidgetKit.ACCENT_300) : k.text(), 11);

            JSONArray items = day.optJSONArray("items");
            int count = items == null ? 0 : items.length();
            for (int c = 0; c < MAX_CHIPS; c++) {
                int id = chipIds[c];
                if (c >= count) {
                    if (c == 0) {
                        k.text(row, id, k.label("noneShort", "없음"), k.muted(), 10);
                        row.setViewVisibility(id, View.VISIBLE);
                    } else {
                        row.setViewVisibility(id, View.GONE);
                    }
                    continue;
                }
                JSONObject it = items.optJSONObject(c);
                boolean cancelled = it.optInt("x", 0) == 1;
                String label = it.optString("s") + " " + it.optString("t");
                if (it.optInt("added", 0) == 1 && !cancelled) label += " · " + k.label("makeupShort", "보강");
                if (cancelled) {
                    k.text(row, id, WidgetKit.styled(label, false, true), k.muted(), 10);
                    k.background(row, id, R.drawable.wd_chip_x_l, R.drawable.wd_chip_x_d);
                } else if ("selfStudy".equals(it.optString("st", ""))) {
                    k.text(row, id, label, k.text(), 10);
                    k.background(row, id, R.drawable.wd_cell_self_l, R.drawable.wd_cell_self_d);
                } else {
                    k.text(row, id, WidgetKit.styled(label, true, false), k.pick(WidgetKit.ACCENT_800, WidgetKit.ACCENT_200), 10);
                    k.background(row, id, R.drawable.wd_chip_l, R.drawable.wd_chip_d);
                }
                row.setViewVisibility(id, View.VISIBLE);
            }
            if (count > MAX_CHIPS) {
                k.text(row, R.id.ac_more, "+" + (count - MAX_CHIPS), k.sub(), 10);
                row.setViewVisibility(R.id.ac_more, View.VISIBLE);
            } else {
                row.setViewVisibility(R.id.ac_more, View.GONE);
            }
            v.addView(R.id.wd_body, row);
        }
        v.setViewVisibility(R.id.wd_footer, View.GONE);
        return v;
    }
}
