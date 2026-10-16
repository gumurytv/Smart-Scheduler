package com.gumurytv.teumteum.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Scheduled redraws and clock changes (time set, time zone, new day) redraw every widget. */
public class WidgetRefreshReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        WidgetRefresher.refreshAll(context);
    }
}
