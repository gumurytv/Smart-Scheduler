package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for the home-screen widgets (see src/native/homeWidgets.ts). */
@CapacitorPlugin(name = "TeumWidget")
public class TeumWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        WidgetKit.save(getContext(), json);
        WidgetRefresher.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void pin(PluginCall call) {
        WidgetRefresher.Kind kind = WidgetRefresher.Kind.fromId(call.getString("id", ""));
        if (kind == null) {
            call.reject("unknown widget id");
            return;
        }
        boolean requested = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
            if (manager.isRequestPinAppWidgetSupported()) {
                requested = manager.requestPinAppWidget(new ComponentName(getContext(), kind.provider), null, null);
            }
        }
        JSObject result = new JSObject();
        result.put("requested", requested);
        call.resolve(result);
    }

    @PluginMethod
    public void placed(PluginCall call) {
        JSObject result = new JSObject();
        for (WidgetRefresher.Kind kind : WidgetRefresher.Kind.values()) {
            result.put(kind.id, WidgetRefresher.placedCount(getContext(), kind));
        }
        call.resolve(result);
    }
}
