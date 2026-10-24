# 틈틈 – Play 비공개 테스트 자동 출시

`android/app/build.gradle`의 버전(versionCode · versionName)을 올린 PR이 **main에 머지되면**,
GitHub Actions(`.github/workflows/android-release.yml`)가 자동으로 다음을 처리해요.

1. 웹 앱 빌드 → `npx cap sync android`
2. AAB 빌드 · 업로드 키로 서명
3. Play Console **비공개 테스트 - Alpha** 트랙에 업로드 (전체 출시)
4. 출시 노트(한국어 · 영어 · 중국어) 입력: `src/data/changelog.ts` 맨 위 항목에서 만들어요 (`android/release-notes.ts`)

사람이 할 일은 **버전을 올린 PR을 머지하는 것뿐**이에요. Android Studio · 터미널 · Play Console 업로드가 필요 없어요.

## 업데이트를 낼 때 (매번)

버전을 올리는 PR에 세 가지를 같이 넣어요 (Claude에게 "버전 올려줘"라고 하면 함께 해요).

| 파일 | 바꿀 것 |
|---|---|
| `android/app/build.gradle` | `versionCode` +1, `versionName` 새 버전 |
| `src/data/changelog.ts` | 맨 위에 새 버전 항목 (`version`이 versionName과 같아야 해요) |

`changelog.ts` 맨 위 버전과 `versionName`이 다르면 빌드가 멈춰요. 출시 노트가 엉뚱하게 나가는 걸 막기 위해서예요.

## 처음 한 번만: Secrets 넣기

GitHub → Smart-Scheduler 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| Name | 값 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | 맥 터미널에서 `base64 -i upload-keystore.jks \| pbcopy` 실행 후 붙여넣기 |
| `ANDROID_KEYSTORE_PASSWORD` | `android/keystore.properties`의 storePassword (Android Studio에서 AAB 만들 때 넣던 Key store password) |
| `ANDROID_KEY_ALIAS` | keyAlias (보통 `upload`) |
| `ANDROID_KEY_PASSWORD` | keyPassword |
| `PLAY_SERVICE_ACCOUNT_JSON` | 교대근무 앱에 넣은 것과 **같은** 서비스 계정 JSON 내용 전체 |

- 서명 키는 **틈틈을 처음 Play에 올릴 때 쓴 키**여야 해요 (교대근무 앱 키 아님).
- `.jks` 경로는 Android Studio의 서명 화면 **Key store path**에 보여요. 터미널에 `base64 -i ` 까지 입력하고 파일을 끌어다 놓으면 경로가 들어가요.

## 처음 한 번만: 서비스 계정에 틈틈 권한 주기

교대근무 앱에서 만든 서비스 계정을 그대로 써요.

1. Play Console → **사용자 및 권한** → 기존 서비스 계정(`…@….iam.gserviceaccount.com`) 선택
2. **앱 권한 → 앱 추가 → 틈틈** 추가
3. **테스트 트랙에 앱 출시**, **테스트 트랙 관리** 켜고 저장

## 선택: 다른 트랙에 올리기

- 저장소 **Variables**에 `PLAY_TRACK`을 넣으면 기본 트랙이 바뀌어요 (`alpha` = 비공개 테스트, `internal` = 내부 테스트, `production` = 프로덕션).
- Actions → **Android release → Run workflow**로 직접 실행할 수도 있어요. 「Play에 올리기」를 끄면 빌드만 해서 결과물(Artifacts)로 남겨요.

## 확인하는 법

- GitHub → **Actions → Android release**: 마지막 실행이 초록색이면 성공이에요.
- Play Console → **게시 개요** 또는 **비공개 테스트 - Alpha**에 새 버전(예: `1.4.2 (10)`)이 보여요.
- 만든 AAB와 출시 노트는 실행 화면 아래 **Artifacts**에도 30일 동안 남아요.

PR에서는(워크플로 파일을 고친 PR) 임시 키로 **빌드만** 해서 빌드가 깨지지 않았는지 미리 확인하고, Play에는 올리지 않아요.

## 문제 해결

| 증상 | 원인 · 해결 |
|---|---|
| `Version code N has already been used` | Play에 이미 같은 번호가 있어요. `versionCode`를 더 큰 번호로 올린 PR을 다시 머지하세요. |
| `403` / `The caller does not have permission` | 서비스 계정에 틈틈 앱 권한이 없어요. 위 「서비스 계정에 틈틈 권한 주기」를 확인하세요. |
| `The Android App Bundle was signed with the wrong key` | `ANDROID_KEYSTORE_BASE64`가 틈틈 업로드 키가 아니에요. 처음 Play에 올린 `.jks`로 다시 넣으세요. |
| `keystore password was incorrect` | 비밀번호 Secret이 틀렸어요. |
| `CHANGELOG top is … but build.gradle versionName is …` | `changelog.ts` 맨 위 버전을 `versionName`과 같게 맞추세요. |
| `PLAY_SERVICE_ACCOUNT_JSON secret is missing` | JSON Secret이 비었어요. |
