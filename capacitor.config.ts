import type { CapacitorConfig } from '@capacitor/cli';

// Android app shell for 틈틈 (TeumTeum).
// appId is the Play Store package name — it can never change after the first release.
const config: CapacitorConfig = {
  appId: 'com.gumurytv.teumteum',
  appName: '틈틈',
  webDir: 'dist',
  android: {
    // Organic paper colour, so no white flash shows before the web app paints.
    backgroundColor: '#f5ead8',
  },
  plugins: {
    SystemBars: {
      // Keep the WebView out from under the status/navigation bars (Android 15+ is edge-to-edge).
      insetsHandling: 'native',
      // Dark status-bar icons on the light paper header.
      style: 'LIGHT',
    },
  },
};

export default config;
