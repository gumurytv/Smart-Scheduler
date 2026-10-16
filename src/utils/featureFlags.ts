// Feature flags for experimental features.
//
// AI 시간표 이미지 인식 (AI timetable recognition) is an experimental feature.
// It is OFF by default: users see what it does, but the controls are disabled.
//
// Ways to turn it on:
//  - Whole build (e.g. a private-test deployment): set VITE_FEATURE_AI_TIMETABLE=true at build time.
//  - One device (owner / private testers): open the app once with `?labs=ai-on`
//    (`?labs=ai-off` turns it back off). The choice is remembered on that device.
// The server must also allow it: AI_TIMETABLE_ENABLED=true (see server.ts), otherwise
// /api/parse-timetable answers 403 even if the UI is unlocked.

const AI_TIMETABLE_LABS_KEY = 'labs.aiTimetable';

function readLabsParam(): void {
  try {
    const labs = new URLSearchParams(window.location.search).get('labs');
    if (labs === 'ai-on') localStorage.setItem(AI_TIMETABLE_LABS_KEY, '1');
    if (labs === 'ai-off') localStorage.removeItem(AI_TIMETABLE_LABS_KEY);
  } catch {
    // Storage or URL access can be blocked; fall back to the build-time flag.
  }
}

readLabsParam();

export function isAiTimetableEnabled(): boolean {
  if (import.meta.env.VITE_FEATURE_AI_TIMETABLE === 'true') return true;
  try {
    return localStorage.getItem(AI_TIMETABLE_LABS_KEY) === '1';
  } catch {
    return false;
  }
}

// Home-screen widgets need native Android code (AppWidgetProvider) that is not built yet.
// Until then Settings shows the widget gallery as a preview marked "곧 지원 예정" (coming soon).
export const HOME_WIDGETS_AVAILABLE = false;
