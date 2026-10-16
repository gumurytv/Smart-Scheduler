# 틈틈 안드로이드 앱 빌드 · 출시 가이드

웹앱(React + Vite)을 [Capacitor](https://capacitorjs.com)로 감싸서 안드로이드 앱으로 만듭니다.

| 항목 | 값 |
|---|---|
| 앱 ID (패키지 이름) | `com.gumurytv.teumteum` — **출시 후 변경 불가** |
| 앱 이름 | 틈틈 |
| 버전 | `android/app/build.gradle`의 `versionCode` / `versionName` |
| 최소/대상 SDK | `android/variables.gradle` (minSdk 24, targetSdk 36) |

## 1. 준비물
- Node.js 22 이상
- [Android Studio](https://developer.android.com/studio) (JDK와 Android SDK 포함)

## 2. 웹 빌드 → 안드로이드 프로젝트에 반영
코드를 바꿀 때마다 실행합니다.

```bash
npm install
npm run android:sync   # vite build + cap sync android
npm run android:open   # Android Studio로 열기
```

Android Studio에서 ▶ Run을 누르면 연결된 휴대폰이나 에뮬레이터에서 바로 실행됩니다.

## 3. 업로드 키 만들기 (처음 한 번)
```bash
cd android
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

`android/keystore.properties` 파일을 만들어요. 이 파일과 `.jks`는 `.gitignore`에 들어 있어 커밋되지 않습니다.

```properties
storeFile=../upload-keystore.jks
storePassword=키스토어 비밀번호
keyAlias=upload
keyPassword=키 비밀번호
```

> ⚠️ `upload-keystore.jks`와 비밀번호는 **반드시 따로 백업**하세요. 잃어버리면 업데이트를 올릴 수 없습니다. 교대근무 앱과 다른 키를 쓰는 것을 권장합니다.

## 4. 출시용 AAB 만들기
```bash
npm run android:sync
cd android && ./gradlew bundleRelease
```

결과물 `android/app/build/outputs/bundle/release/app-release.aab`를 Play Console에 올립니다. Android Studio의 **Build → Generate Signed App Bundle**로 만들어도 됩니다.

업데이트할 때마다 `android/app/build.gradle`의 `versionCode`를 1씩 올리고 `versionName`도 바꿔 주세요.

## 5. 아이콘 · 시작 화면
- 원본 이미지는 `resources/` 폴더에 있습니다: `icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`.
- 이미지를 바꾼 뒤 아래 명령으로 모든 해상도를 다시 만듭니다.

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#b2622d' --splashBackgroundColor '#f5ead8' --splashBackgroundColorDark '#f5ead8'
```

## 6. 앱에서 동작이 다른 부분
- **뒤로가기 버튼:** 열린 시트나 팝업이 있으면 먼저 닫습니다. 다른 탭에 있으면 시간표로 돌아가고, 시간표에서 누르면 앱을 종료합니다. (`src/native/androidShell.ts`)
- **상태 표시줄:** 앱 화면이 상태 표시줄 아래로 들어가지 않고(`SystemBars.insetsHandling: native`), 밝은 배경에 맞게 어두운 아이콘으로 표시됩니다. (`capacitor.config.ts`)
- **데이터:** 웹과 똑같이 기기 안(localStorage)에만 저장됩니다.
- **AI 시간표 인식(실험 기능):** 앱 안에는 서버가 없습니다. 쓰려면 서버(`server.ts`)를 따로 배포한 뒤 아래처럼 설정해요.
  - 빌드 전에 `.env`에 `VITE_API_BASE_URL=https://서버주소`를 넣습니다.
  - 서버 쪽에는 `AI_TIMETABLE_ENABLED=true`, `GEMINI_API_KEY`, `CORS_ALLOWED_ORIGINS=https://localhost`를 설정합니다.
  - 기본값은 꺼짐이라 1차 출시는 서버 없이 해도 됩니다.
- **홈 화면 위젯:** 앱은 이미 `window.AndroidWidgetBridge.updateWidget(json)`으로 위젯 데이터를 넘기고 있습니다. 실제 위젯을 띄우려면 안드로이드 쪽 위젯 코드(AppWidgetProvider + JavascriptInterface)를 추가해야 하며, 이는 다음 단계 작업입니다.

## 7. Play Console 등록 체크리스트
- [ ] 앱 만들기 (기본 언어: 한국어, 무료)
- [ ] 스토어 등록정보: 앱 이름 "틈틈 – 학교·학원 시간표 플래너", 짧은 설명, 자세한 설명
- [ ] 그래픽: 아이콘 512×512, 그래픽 이미지 1024×500, 휴대폰 스크린샷 2장 이상
- [ ] 개인정보처리방침 URL
- [ ] 데이터 보안 양식 (현재: 수집·공유 없음, 기기 내 저장)
- [ ] 콘텐츠 등급 설문, 광고 포함 여부
- [ ] 타겟 연령층 (13세 미만 포함 시 가족 정책 적용 — 처음에는 13세 이상 권장)
- [ ] 비공개 테스트 (개인 개발자 계정은 테스터 12명·14일 조건을 Play Console에서 확인)
- [ ] 프로덕션 출시 요청
