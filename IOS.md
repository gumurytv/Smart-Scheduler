# 틈틈 아이폰 앱 빌드 · 출시 가이드

안드로이드 앱과 **같은 웹앱(React + Vite)**을 [Capacitor](https://capacitorjs.com)로 감싸서 아이폰 앱으로 만듭니다.
안드로이드는 [ANDROID.md](ANDROID.md)를 보세요.

| 항목 | 값 |
|---|---|
| 번들 ID | `com.gumurytv.teumteum` (안드로이드 패키지 이름과 같음) — **출시 후 변경 불가** |
| 앱 이름 (홈 화면) | 틈틈 |
| 버전 | `ios/App/App.xcodeproj/project.pbxproj`의 `MARKETING_VERSION`(예: 1.4.10) / `CURRENT_PROJECT_VERSION`(빌드 번호, 올릴 때마다 +1) |
| 지원 기기 | 아이폰만 (iPad는 아이폰 화면 그대로 실행) · 세로 화면 · iOS 15 이상 |
| 아직 없는 것 | 홈 화면 위젯 (안드로이드 전용, 아이폰은 나중에 Swift로 따로 만들어야 함) |

## 1. 처음 한 번만: 맥북 준비

1. **App Store에서 Xcode 설치** (무료, 약 40GB 여유 공간 필요)
2. Xcode를 한 번 실행 → 「iOS」 플랫폼(시뮬레이터) 받기에 체크하고 설치
3. 터미널(Spotlight에서 "터미널")을 열고 아래를 한 줄씩 실행
   ```bash
   xcode-select --install          # 명령줄 도구 (이미 있으면 "already installed")
   node -v                         # v22 이상이 나오면 OK, 없으면 https://nodejs.org 에서 LTS 설치
   ```
4. 저장소 받기 (처음 한 번)
   ```bash
   cd ~/Documents
   git clone https://github.com/gumurytv/Smart-Scheduler.git
   cd Smart-Scheduler
   ```

## 2. 시뮬레이터에서 실행하기 (Apple 개발자 가입 없이 무료)

```bash
cd ~/Documents/Smart-Scheduler
git pull                 # 최신 코드 받기
npm install
npm run build            # 웹앱 빌드
npx cap sync ios         # ios 프로젝트에 반영
npx cap open ios         # Xcode가 열려요
```

Xcode가 열리면:
1. 맨 위 가운데의 기기 선택에서 **iPhone 16 Pro Max**(또는 원하는 아이폰)를 고릅니다.
2. 왼쪽 위 **▶ (Run)** 버튼을 누르면 시뮬레이터가 뜨고 틈틈이 실행돼요.
   - 처음에는 Swift 패키지를 받느라 1~2분 걸려요.
3. 확인할 것
   - 화면 위(노치)와 아래(홈 표시줄)에 메뉴가 가려지지 않는지
   - 보강 알림: 설정 → 보강 알림 켜기 → 허용 → 보강 추가 후 시뮬레이터 홈으로 나가서 알림 확인
   - 프로필 사진: 맥의 사진을 시뮬레이터 창으로 끌어다 놓으면 사진 앱에 들어가요 → 설정 → 내 정보 → 내 사진 올리기
   - 백업: 설정 → 백업 · 복원 → 내보내기 → 「파일에 저장」

코드를 바꾼 뒤에는 `npm run build && npx cap sync ios` 후 Xcode에서 다시 ▶.

## 3. 출시 준비: Apple Developer Program

- https://developer.apple.com/programs/ 에서 **개인**으로 가입 (연 US$99). 승인 1~2일.
- 가입 후 Xcode → **Settings → Accounts → +** 로 Apple ID 추가.
- Xcode 왼쪽에서 **App** 프로젝트 → **Signing & Capabilities** → **Team**에서 내 이름 선택
  (「Automatically manage signing」 켜 둠).

## 4. App Store Connect에 앱 만들기 (처음 한 번)

https://appstoreconnect.apple.com → **앱 → + → 신규 앱**
- 플랫폼: iOS · 이름: `틈틈 – 학교·학원 시간표 플래너` · 기본 언어: 한국어
- 번들 ID: `com.gumurytv.teumteum` · SKU: `teumteum`
- 스토어 문구 · 스크린샷은 `PLAY_STORE.md` / `store-assets/` 를 바탕으로 따로 준비합니다(아이폰 규격 6.9인치 1320×2868).
- **앱 개인정보 보호**: 「데이터를 수집하지 않음」 (개인정보처리방침 URL은 Play와 같음)

## 5. 빌드 올리기 (TestFlight → 심사)

1. `project.pbxproj`의 `CURRENT_PROJECT_VERSION`을 올린다 (Claude에게 "iOS 출시 준비해줘").
2. Xcode 위쪽 기기 선택에서 **Any iOS Device (arm64)** 선택
3. 메뉴 **Product → Archive** → 끝나면 Organizer 창 → **Distribute App → App Store Connect → Upload**
4. 10~30분 뒤 App Store Connect의 **TestFlight**에 빌드가 보여요 → 지인 아이폰으로 테스트
5. **앱 스토어 탭 → 빌드 선택 → 심사에 제출** (보통 1~3일)

## 6. 나중에 할 수 있는 것
- GitHub Actions(맥 러너)로 TestFlight 자동 업로드 — 안드로이드처럼 "출시해줘" 한 번에
- 아이폰 홈 화면 위젯 (WidgetKit)
- 권한 안내 문구 · 앱 이름의 영어 · 중국어 번역 (`InfoPlist.strings`)
