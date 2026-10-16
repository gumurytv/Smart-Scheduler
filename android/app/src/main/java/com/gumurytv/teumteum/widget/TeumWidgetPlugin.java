package com.gumurytv.teumteum.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for the home-screen widgets (see src/native/nowWidget.ts). */
@CapacitorPlugin(name = "TeumWidget")
public class TeumWidgetPlugin extends Plugin {

    @PluginMethod
    public void updateNow(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        NowWidgetProvider.saveAndRefresh(getContext(), json);
        call.resolve();
    }

    @PluginMethod
    public void pinNow(PluginCall call) {
        boolean requested = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
            if (manager.isRequestPinAppWidgetSupported()) {
                requested = manager.requestPinAppWidget(
                    new ComponentName(getContext(), NowWidgetProvider.class), null, null);
            }
        }
        JSObject result = new JSObject();
        result.put("requested", requested);
        call.resolve(result);
    }
}
