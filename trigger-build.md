# GitHub Actions 빌드 트리거 방법

## 방법 1: GitHub Personal Access Token 사용

1. GitHub에서 Personal Access Token 생성:
   - https://github.com/settings/tokens 접속
   - "Generate new token" 클릭
   - "repo" 권한 체크
   - 토큰 생성 및 복사

2. 터미널에서 실행:
```bash
export GITHUB_TOKEN=your_token_here
node scripts/trigger-build.js
```

## 방법 2: curl 직접 사용

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/Coderecipe-company/app_packaging/dispatches \
  -d '{
    "event_type": "build_mobile_app",
    "client_payload": {
      "build_id": "test-build-001",
      "app_name": "TestApp",
      "package_name": "com.test.app",
      "platform": "android",
      "build_type": "apk",
      "base_url": "https://withcookie.com",
      "version_name": "1.0.0",
      "version_code": "1"
    }
  }'
```

## 방법 3: GitHub Actions 페이지에서 수동 실행

1. https://github.com/Coderecipe-company/app_packaging/actions 접속
2. 최근 실행된 workflow 확인
3. "Re-run jobs" 버튼 클릭

## 방법 4: 코드 변경으로 자동 트리거

```bash
# 작은 변경 만들기
echo "# Trigger build $(date)" >> README.md
git add README.md
git commit -m "Trigger build"
git push
```

## 빌드 상태 확인

빌드가 트리거되면:
1. https://github.com/Coderecipe-company/app_packaging/actions 에서 진행상황 확인
2. 빌드 로그에서 업로드 성공/실패 확인
3. APK 파일 다운로드 (Artifacts 섹션)