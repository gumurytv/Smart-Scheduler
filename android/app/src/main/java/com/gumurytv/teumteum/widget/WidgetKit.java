package com.gumurytv.teumteum.widget;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.widget.RemoteViews;
import com.gumurytv.teumteum.MainActivity;
import com.gumurytv.teumteum.R;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Shared state for drawing one round of widgets: the payload the app sent
 * (buildNativeWidgets in src/utils/widgetSync.ts), the clock, the theme and the font scale.
 */
final class WidgetKit {

    static final String PREFS = "teumteum_widgets";
    static final String KEY = "widgets_json";

    // Organic palette (src/index.css)
    static final int PAPER = 0xFFF5EAD8;
    static final int INK = 0xFF201E1D;
    static final int SLATE_100 = 0xFFEEE7DB;
    static final int SLATE_400 = 0xFFA19786;
    static final int SLATE_500 = 0xFF82796A;
    static final int SLATE_600 = 0xFF645C50;
    static final int ACCENT = 0xFFC67139;
    static final int ACCENT_200 = 0xFFFFE1D0;
    static final int ACCENT_300 = 0xFFFFC6A5;
    static final int ACCENT_400 = 0xFFF6A06B;
    static final int ACCENT_700 = 0xFF8C491A;
    static final int ACCENT_800 = 0xFF643312;
    static final int ACCENT_900 = 0xFF402310;
    static final int SAGE = 0xFF7A8A5E;
    static final int SAGE_100 = 0xFFF0FAE1;
    static final int SAGE_200 = 0xFFE1EECC;
    static final int SAGE_400 = 0xFFAEBF92;
    static final int SAGE_700 = 0xFF56633F;
    static final int SAGE_900 = 0xFF272E1B;
    static final int OTHER = 0xFF5B7393;

    final JSONObject data; // null when the app hasn't sent anything yet
    final boolean dark;
    final float font;
    final Calendar now;
    final int nowMin;
    final String today;

    private final JSONObject labels;
    private final JSONObject dur;

    private WidgetKit(JSONObject data, Calendar now) {
        this.data = data;
        this.now = now;
        this.nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        this.today = dateKey(now);
        this.dark = data != null && "dark".equals(data.optString("theme"));
        float f = data == null ? 1f : (float) data.optDouble("font", 1.0);
        this.font = (f < 0.7f || f > 2.0f) ? 1f : f;
        this.labels = data == null ? null : data.optJSONObject("labels");
        this.dur = data == null ? null : data.optJSONObject("dur");
    }

    static WidgetKit load(Context context, Calendar now) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        JSONObject data = null;
        if (raw != null) {
            try {
                data = new JSONObject(raw);
            } catch (Exception ignored) {
                // Unreadable payload: draw the "open the app" state.
            }
        }
        return new WidgetKit(data, now);
    }

    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
    }

    // ---- theme ----

    int pick(int light, int darkColor) {
        return dark ? darkColor : light;
    }

    int text() {
        return pick(INK, SLATE_100);
    }

    int sub() {
        return pick(SLATE_600, SLATE_400);
    }

    int muted() {
        return pick(SLATE_400, SLATE_500);
    }

    int accentText() {
        return pick(ACCENT_700, ACCENT_300);
    }

    int res(int lightRes, int darkRes) {
        return dark ? darkRes : lightRes;
    }

    void background(RemoteViews v, int viewId, int lightRes, int darkRes) {
        v.setInt(viewId, "setBackgroundResource", res(lightRes, darkRes));
    }

    void clearBackground(RemoteViews v, int viewId) {
        v.setInt(viewId, "setBackgroundResource", 0);
    }

    /** Text size in sp, scaled by the user's widget font setting. */
    void size(RemoteViews v, int viewId, float sp) {
        v.setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, sp * font);
    }

    void text(RemoteViews v, int viewId, CharSequence value, int color, float sp) {
        v.setTextViewText(viewId, value);
        v.setTextColor(viewId, color);
        size(v, viewId, sp);
    }

    /** The themed frame with the click-to-open handler. */
    void frame(Context context, RemoteViews v) {
        background(v, R.id.wd_root, R.drawable.wd_frame_l, R.drawable.wd_frame_d);
        v.setOnClickPendingIntent(R.id.wd_root, openApp(context));
    }

    // ---- data ----

    String label(String key, String fallback) {
        return labels == null ? fallback : labels.optString(key, fallback);
    }

    String duration(int minutes) {
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

    JSONArray array(String key) {
        return data == null ? null : data.optJSONArray(key);
    }

    /** Index in `days` of today, or -1 when the data is missing or older than what was sent. */
    int todayIndex() {
        JSONArray days = array("days");
        if (days == null) return -1;
        for (int i = 0; i < days.length(); i++) {
            JSONObject day = days.optJSONObject(i);
            if (day != null && today.equals(day.optString("date"))) return i;
        }
        return -1;
    }

    /** Index of the week (in schoolWeeks / academyWeeks) whose Mon–Sun contains today, or -1. */
    int weekIndex() {
        JSONArray weeks = array("academyWeeks");
        if (weeks == null) return -1;
        for (int i = 0; i < weeks.length(); i++) {
            JSONObject week = weeks.optJSONObject(i);
            JSONArray days = week == null ? null : week.optJSONArray("days");
            if (days == null) continue;
            for (int d = 0; d < days.length(); d++) {
                JSONObject day = days.optJSONObject(d);
                if (day != null && today.equals(day.optString("date"))) return i;
            }
        }
        return -1;
    }

    // ---- helpers ----

    static String dateKey(Calendar c) {
        return String.format(
            Locale.US, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static int minutes(String hhmm) {
        try {
            String[] parts = hhmm.split(":");
            return Integer.parseInt(parts[0].trim()) * 60 + Integer.parseInt(parts[1].trim());
        } catch (Exception e) {
            return -1;
        }
    }

    static long atMinute(Calendar now, int minuteOfDay) {
        Calendar c = (Calendar) now.clone();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.MINUTE, minuteOfDay);
        return c.getTimeInMillis();
    }

    /** Bold and/or struck-through text (RemoteViews keep parcelable spans). */
    static CharSequence styled(String value, boolean bold, boolean strike) {
        if (!bold && !strike) return value;
        SpannableString out = new SpannableString(value);
        if (bold) out.setSpan(new StyleSpan(Typeface.BOLD), 0, value.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        if (strike) out.setSpan(new StrikethroughSpan(), 0, value.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return out;
    }

    static String fill(String template, String key, String value) {
        return template.replace("{" + key + "}", value);
    }

    static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Frame body that asks to open the app once (no data, or the data is too old). */
    static void showOpenAppMessage(Context context, WidgetKit k, RemoteViews v) {
        v.removeAllViews(R.id.wd_body);
        k.text(v, R.id.wd_title, context.getString(R.string.widget_empty_title), k.text(), 13);
        k.text(v, R.id.wd_right, "", k.sub(), 11);
        RemoteViews msg = new RemoteViews(context.getPackageName(), R.layout.wd_row);
        RemoteViews cell = new RemoteViews(context.getPackageName(), R.layout.wd_cell);
        k.text(cell, R.id.wd_cell, context.getString(R.string.widget_empty_subtitle), k.sub(), 12);
        msg.addView(R.id.wd_row, cell);
        v.addView(R.id.wd_body, msg);
        v.setViewVisibility(R.id.wd_footer, android.view.View.GONE);
    }
}
