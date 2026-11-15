# 틈틈 (TeumTeum) — notes for Claude

One React + Vite web app (`src/`), shipped three ways. Keep them apart:

| Target | Folder | Version lives in | How it ships | Docs |
|---|---|---|---|---|
| **Android app** (Google Play, **live in production**) | `android/` | `android/app/build.gradle` `versionCode` / `versionName` | PR that bumps the version merged to main → `.github/workflows/android-release.yml` builds, signs and uploads to **Play Alpha**; the owner promotes it to production in Play Console | `ANDROID.md`, `docs/android-release.md` |
| **iPhone app** (App Store, **not published yet**) | `ios/` | `ios/App/App.xcodeproj/project.pbxproj` `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` | Built and uploaded by hand from the owner's Mac (Xcode → Archive → TestFlight). No CI yet | `IOS.md` |
| **Web preview** | `dist/` → GitHub Pages `/app/` | — | Every merge to main (`pages.yml`) | — |

## Rules
- Shared code is in `src/`. Platform checks: `isNativeApp` (any app), `isAndroidApp`, `isIosApp` in `src/native/androidShell.ts`.
  Home-screen widgets and the back button are **Android only**; never call the `TeumWidget` plugin on iOS.
- `src/data/changelog.ts` is shared: its top entry is the in-app 「업데이트 이력」 and the Play release notes
  (`android/release-notes.ts` fails the build if it doesn't match `versionName`).
- **"출시해줘"** means: bump the **Android** version + changelog, open the PR, merge, watch the Android release run.
  It does **not** touch iOS unless the owner says iOS. For iOS, bump `CURRENT_PROJECT_VERSION` (+1 per upload)
  and keep `MARKETING_VERSION` equal to the changelog version.
- After changing `src/`, `capacitor.config.ts` or plugins: `npm run build && npx cap sync android` / `npx cap sync ios`.
- appId / bundle ID `com.gumurytv.teumteum` must never change.
- Store texts and images: `PLAY_STORE.md`, `store-assets/` (ko at the root, `en/`, `zh/`). Privacy policy: `docs/privacy.html`.
- The owner speaks Korean and prefers short, step-by-step answers; merge only on "머지해줘".
