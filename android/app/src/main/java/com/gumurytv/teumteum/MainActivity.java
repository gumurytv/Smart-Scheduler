package com.gumurytv.teumteum;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.gumurytv.teumteum.widget.TeumWidgetPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(TeumWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
