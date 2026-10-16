// Bridge to the native 「지금」 home-screen widget (android/.../widget/NowWidgetProvider.java).
// No-ops in the browser.
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './androidShell';

interface TeumWidgetPlugin {
  /** Store the widget payload (JSON from buildNativeNowWidget) and redraw every placed widget. */
  updateNow(options: { json: string }): Promise<void>;
  /** Ask the launcher to pin the widget. `requested` is false when the launcher can't do that. */
  pinNow(): Promise<{ requested: boolean }>;
}

const TeumWidget = registerPlugin<TeumWidgetPlugin>('TeumWidget');

let lastJson = '';

export function pushNowWidget(json: string): void {
  if (!isNativeApp || json === lastJson) return;
  lastJson = json;
  TeumWidget.updateNow({ json }).catch((e) => console.warn('TeumWidget.updateNow failed:', e));
}

/** Resolves true when the launcher showed its "add widget" prompt. */
export async function pinNowWidget(): Promise<boolean> {
  if (!isNativeApp) return false;
  try {
    const { requested } = await TeumWidget.pinNow();
    return requested;
  } catch {
    return false;
  }
}
