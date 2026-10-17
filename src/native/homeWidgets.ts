// Bridge to the native home-screen widgets (android/.../widget/). No-ops in the browser.
import { registerPlugin } from '@capacitor/core';
import type { HomeWidgetId } from '../types';
import { isNativeApp } from './androidShell';

interface TeumWidgetPlugin {
  /** Store the widget payload (JSON from buildNativeWidgets) and redraw every placed widget. */
  update(options: { json: string }): Promise<void>;
  /** Ask the launcher to pin a widget. `requested` is false when the launcher can't do that. */
  pin(options: { id: HomeWidgetId }): Promise<{ requested: boolean }>;
  /** How many of each widget are on the home screen. */
  placed(): Promise<Partial<Record<HomeWidgetId, number>>>;
}

const TeumWidget = registerPlugin<TeumWidgetPlugin>('TeumWidget');

let lastJson = '';

export function pushHomeWidgets(json: string): void {
  if (!isNativeApp || json === lastJson) return;
  lastJson = json;
  TeumWidget.update({ json }).catch((e) => console.warn('TeumWidget.update failed:', e));
}

/** Resolves true when the launcher showed its "add widget" prompt. */
export async function pinHomeWidget(id: HomeWidgetId): Promise<boolean> {
  if (!isNativeApp) return false;
  try {
    const { requested } = await TeumWidget.pin({ id });
    return requested;
  } catch {
    return false;
  }
}

export async function getPlacedHomeWidgets(): Promise<Partial<Record<HomeWidgetId, number>>> {
  if (!isNativeApp) return {};
  try {
    return await TeumWidget.placed();
  } catch {
    return {};
  }
}
