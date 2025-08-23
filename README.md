# 📱 App Packaging - 모바일 앱 자동 빌드 시스템

모바일 웹을 패키징하여 Android/iOS 앱으로 변환하고, 플레이스토어/앱스토어에 등록 가능한 결과물을 생성하는 React Native 프로젝트입니다.

## 🎯 주요 기능

### 1. **WebView 기반 앱 구현**
- 지정된 URL을 웹뷰로 표시하여 네이티브 앱처럼 작동
- FCM 토큰을 URL 파라미터로 자동 전달 (`https://withcookie.com?token=tokenvalue`)
- 웹페이지와 네이티브 앱 간의 양방향 통신 지원

### 2. **Firebase Cloud Messaging (FCM) 지원**
- 푸시 알림 수신 및 처리
- 앱 시작 시 FCM 토큰 자동 생성
- 포어그라운드/백그라운드 알림 처리
- 알림 탭 시 딥링크 지원

### 3. **딥링크 (Deep Link) 기능**
- 커스텀 스킴 및 Universal Links 지원
- 외부 링크를 통한 앱 실행 및 특정 페이지 이동
- FCM 푸시 알림과 연동된 딥링크 처리

### 4. **자동 빌드 시스템**
- GitHub Actions를 통한 CI/CD 파이프라인
- 외부 API 호출로 빌드 트리거
- 동적 앱 설정 (이름, 패키지명, 아이콘 등)
- 빌드 결과물 자동 업로드

## 🛠 기술 스택

- **React Native**: 0.75.2 (2025.08 기준 최신)
- **Firebase**: FCM, Analytics
- **WebView**: react-native-webview
- **GitHub Actions**: 자동 빌드 및 배포
- **S3 업로드**: 냉장고(Refrigerator) API 활용

## 🚀 빌드 파라미터

빌드 실행 시 다음 파라미터를 전달받습니다:

| 파라미터 | 설명 | 예시 | 필수 |
|---------|------|------|------|
| `build_id` | 빌드요청 고유번호 | `build-2025-001` | ✅ |
| `app_name` | 앱 이름 | `MyApp` | ✅ |
| `package_name` | 패키지명/Bundle ID | `com.company.myapp` | ✅ |
| `platform` | 플랫폼 | `android` 또는 `ios` | ✅ |
| `base_url` | 기본 웹 URL | `https://withcookie.com` | ❌ |
| `version_name` | 버전명 (사용자에게 표시) | `1.2.3` | ❌ |
| `version_code` | 버전 코드 (Android) | `123` | ❌ |
| `build_number` | 빌드 번호 (iOS) | `123` | ❌ |
| `marketing_version` | 마케팅 버전 (iOS) | `1.2.3` | ❌ |
| `app_icon_url` | 앱 아이콘 이미지 URL | `https://example.com/icon.png` | ❌ |
| `firebase_config_url` | Firebase 설정 파일 URL | `https://example.com/google-services.json` | ❌ |
| `keystore_url` | Android 서명 키스토어 URL | `https://example.com/release.keystore` | ❌ |
| `keystore_password` | 키스토어 암호 | `mypassword` | ❌ |
| `key_alias` | 키 별칭 | `mykey` | ❌ |
| `key_password` | 키 암호 | `mykeypassword` | ❌ |
| `build_type` | 빌드 방식 | `apk`, `aab`, `ipa` | ✅ |
| `s3_upload_url` | 결과 전달 URL | `https://api.example.com/build-complete` | ❌ |

## 📞 빌드 실행 방법

GitHub Repository Dispatch API를 사용하여 빌드를 트리거합니다:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/app_packaging/dispatches \
  -d '{
    "event_type": "build-app",
    "client_payload": {
      "build_id": "build-2025-001",
      "app_name": "MyApp",
      "package_name": "com.company.myapp",
      "platform": "android",
      "build_type": "apk",
      "base_url": "https://withcookie.com",
      "version_name": "1.2.3",
      "version_code": "123",
      "app_icon_url": "https://example.com/icon.png",
      "firebase_config_url": "https://example.com/google-services.json",
      "keystore_url": "https://example.com/release.keystore",
      "keystore_password": "mypassword",
      "key_alias": "mykey",
      "key_password": "mykeypassword",
      "s3_upload_url": "https://api.example.com/build-complete"
    }
  }'
```

### iOS 빌드 예시:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/YOUR_USERNAME/app_packaging/dispatches \
  -d '{
    "event_type": "build-app",
    "client_payload": {
      "build_id": "build-ios-2025-001",
      "app_name": "MyApp",
      "package_name": "com.company.myapp",
      "platform": "ios",
      "build_type": "ipa",
      "base_url": "https://withcookie.com",
      "version_name": "1.2.3",
      "build_number": "123",
      "marketing_version": "1.2.3",
      "app_icon_url": "https://example.com/icon.png",
      "firebase_config_url": "https://example.com/GoogleService-Info.plist",
      "s3_upload_url": "https://api.example.com/build-complete"
    }
  }'
```

## 📁 프로젝트 구조

```
app_packaging/
├── src/
│   ├── components/
│   │   └── WebViewContainer.js      # WebView 컴포넌트
│   └── services/
│       ├── FCMService.js            # FCM 서비스
│       └── DeepLinkService.js       # 딥링크 서비스
├── android/                         # Android 네이티브 설정
├── ios/                            # iOS 네이티브 설정
├── scripts/
│   ├── configure-app.js            # 앱 설정 스크립트
│   ├── build-android.sh            # Android 빌드 스크립트
│   ├── build-ios.sh                # iOS 빌드 스크립트
│   └── upload-to-s3.js             # S3 업로드 스크립트
├── .github/
│   └── workflows/
│       └── build-app.yml           # GitHub Actions 워크플로우
├── App.js                          # 메인 앱 컴포넌트
└── package.json
```

## 🔧 로컬 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. Android 개발환경 설정
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

### 3. iOS 개발환경 설정 (macOS만)
```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

## 📋 빌드 프로세스

1. **설정 단계**: 앱 이름, 패키지명, 아이콘 등 동적 설정
2. **Firebase 설정**: `google-services.json` 또는 `GoogleService-Info.plist` 적용
3. **서명 설정**: Android 키스토어 또는 iOS 프로비저닝 프로필 적용
4. **빌드 실행**: 플랫폼별 네이티브 빌드
5. **결과물 업로드**: 냉장고 API를 통한 S3 업로드
6. **완료 알림**: 지정된 URL로 빌드 결과 전달

## 🔐 보안 고려사항

- 모든 민감한 정보는 환경변수로 관리
- 키스토어 및 인증서는 HTTPS를 통해서만 다운로드
- 빌드 완료 후 임시 파일 자동 정리
- GitHub Secrets를 통한 토큰 및 키 관리

## 📊 지원되는 빌드 타입

### Android
- **APK**: 직접 설치 가능한 패키지
- **AAB**: Google Play Store용 Android App Bundle

### iOS
- **IPA**: iOS 애플리케이션 아카이브

## 📊 버전 관리

### Android 버전 설정
- **Version Code**: 정수 값, 스토어에서 앱 업데이트 판단에 사용 (예: `123`)
- **Version Name**: 사용자에게 표시되는 버전 (예: `1.2.3`)

### iOS 버전 설정  
- **Build Number**: 정수 값, App Store Connect에서 빌드 식별에 사용 (예: `123`)
- **Marketing Version**: 사용자에게 표시되는 버전 (예: `1.2.3`)

### 버전 자동 설정 로직
```javascript
// 기본값 설정
VERSION_CODE = process.env.VERSION_CODE || '1'
VERSION_NAME = process.env.VERSION_NAME || '1.0.0'
BUILD_NUMBER = process.env.BUILD_NUMBER || process.env.VERSION_CODE || '1'
MARKETING_VERSION = process.env.MARKETING_VERSION || process.env.VERSION_NAME || '1.0.0'
```

### 버전 파라미터 우선순위
1. **명시적 설정**: `version_code`, `version_name`, `build_number`, `marketing_version`
2. **자동 매핑**: iOS의 경우 `version_code` → `build_number`, `version_name` → `marketing_version`
3. **기본값**: Android(1, "1.0.0"), iOS(1, "1.0.0")

## 🌐 S3 업로드 (냉장고 API)

빌드 완료 후 냉장고(Refrigerator) API를 사용하여 결과물을 S3에 업로드합니다:

```javascript
// 업로드 예시
const formData = new FormData();
formData.append('file', buildFile);
formData.append('bucket', 'withcookie-bucket');
formData.append('path', 'app-builds');

const response = await axios.post(
  'https://refrigerator.logipasta.com/v1/file',
  formData
);
```

## 🚨 문제 해결

### 빌드 실패 시
1. GitHub Actions 로그 확인
2. 환경변수 설정 검증
3. Firebase 설정 파일 유효성 확인
4. 서명 키 및 인증서 검증

### FCM 토큰 수신 안 됨
1. Firebase 프로젝트 설정 확인
2. `google-services.json` 파일 검증
3. 앱 패키지명과 Firebase 프로젝트 일치 여부 확인

### 딥링크 작동 안 됨
1. AndroidManifest.xml의 intent-filter 설정 확인
2. iOS Info.plist의 URL Scheme 설정 확인
3. 커스텀 스킴 형식 검증

## 📞 지원

문제가 발생하거나 개선 사항이 있으면 GitHub Issues를 통해 문의해주세요.