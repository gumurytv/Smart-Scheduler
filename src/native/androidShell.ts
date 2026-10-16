// Native (Capacitor) glue for the Android app. Everything here is a no-op in the browser.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNativeApp = Capacitor.isNativePlatform();

// Mark the document so CSS can opt out of effects the Android WebView repaints badly
// (see `.native-app` in index.css).
if (isNativeApp && typeof document !== 'undefined') {
  document.documentElement.classList.add('native-app');
}

// Every bottom sheet / popup in the app is a full-screen `fixed inset-0` backdrop that closes
// when the backdrop itself is clicked (the sheet body stops propagation). Android's back
// button should close the topmost one first, the same way tapping outside would.
function closeTopOverlay(): boolean {
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0'));
  const top = overlays[overlays.length - 1];
  if (!top) return false;
  top.click();
  return true;
}

/**
 * Android back button: close an open sheet → otherwise return to the timetable tab →
 * otherwise leave the app. Returns a cleanup function.
 */
export function registerBackButton(handlers: {
  isOnHomeTab: () => boolean;
  goHome: () => void;
}): () => void {
  if (!isNativeApp) return () => {};
  const listener = App.addListener('backButton', () => {
    if (closeTopOverlay()) return;
    if (!handlers.isOnHomeTab()) {
      handlers.goHome();
      return;
    }
    void App.exitApp();
  });
  return () => {
    void listener.then((l) => l.remove());
  };
}

/**
 * Base URL for the app's own server API. In the browser the API is served from the same
 * origin, so this is ''. Inside the Android app the web files are bundled locally, so the
 * server must be addressed explicitly via VITE_API_BASE_URL (e.g. https://teumteum.example.com).
 */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
