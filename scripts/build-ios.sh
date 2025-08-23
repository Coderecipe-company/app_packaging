#!/bin/bash

set -e

echo "🍎 Starting iOS build process..."

# macOS 환경 확인
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "❌ iOS builds can only be performed on macOS"
  exit 1
fi

# Xcode 설치 확인
if ! command -v xcodebuild &> /dev/null; then
  echo "❌ Xcode is not installed or not in PATH"
  exit 1
fi

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

# 환경변수 확인
BUILD_MODE=${BUILD_MODE:-"release"}
SCHEME_NAME=${SCHEME_NAME:-"AppPackaging"}
WORKSPACE_NAME=${WORKSPACE_NAME:-"AppPackaging"}

echo "📋 Build Configuration:"
echo "  Build Mode: $BUILD_MODE"
echo "  Scheme: $SCHEME_NAME"
echo "  Workspace: $WORKSPACE_NAME"
echo "  App Name: ${APP_NAME:-'AppPackaging'}"
echo "  Bundle ID: ${PACKAGE_NAME:-'com.apppackaging'}"

# Node.js 의존성 설치
echo "📦 Installing Node.js dependencies..."
npm install --production=false

# CocoaPods 설치 확인
if ! command -v pod &> /dev/null; then
  echo "📦 Installing CocoaPods..."
  sudo gem install cocoapods
fi

# iOS 디렉토리로 이동 및 CocoaPods 설치
echo "🏗️ Installing iOS dependencies with CocoaPods..."
cd ios
pod install --repo-update

# React Native Metro 번들러 캐시 클리어
echo "🧹 Clearing Metro bundler cache..."
cd ..
npx react-native start --reset-cache &
METRO_PID=$!
sleep 5
kill $METRO_PID 2>/dev/null || true

# iOS 디렉토리로 다시 이동
cd ios

# Xcode 프로젝트 정리
echo "🧹 Cleaning Xcode build cache..."
xcodebuild clean -workspace "${WORKSPACE_NAME}.xcworkspace" -scheme "$SCHEME_NAME"

# Derived Data 정리
echo "🧹 Clearing Derived Data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/AppPackaging-*

# 빌드 설정
if [ "$BUILD_MODE" = "release" ]; then
  CONFIGURATION="Release"
  echo "🔐 Building for App Store distribution..."
else
  CONFIGURATION="Debug"
  echo "🔧 Building for development/testing..."
fi

# Archive 생성
echo "📦 Creating iOS archive..."
ARCHIVE_PATH="build/${SCHEME_NAME}.xcarchive"

xcodebuild archive \
  -workspace "${WORKSPACE_NAME}.xcworkspace" \
  -scheme "$SCHEME_NAME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO

# Archive 생성 확인
if [ ! -d "$ARCHIVE_PATH" ]; then
  echo "❌ Archive creation failed"
  exit 1
fi

echo "✅ Archive created successfully: $ARCHIVE_PATH"

# IPA 생성
echo "📦 Exporting IPA from archive..."
IPA_PATH="build/${SCHEME_NAME}.ipa"
EXPORT_PLIST="ExportOptions.plist"

# Export Options plist 생성
cat > "$EXPORT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>uploadBitcode</key>
    <false/>
    <key>compileBitcode</key>
    <false/>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>teamID</key>
    <string></string>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF

# IPA 내보내기
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "build/" \
  -exportOptionsPlist "$EXPORT_PLIST"

# 생성된 IPA 파일 찾기 및 이름 변경
EXPORTED_IPA=$(find build -name "*.ipa" | head -1)
if [ -n "$EXPORTED_IPA" ] && [ -f "$EXPORTED_IPA" ]; then
  if [ "$EXPORTED_IPA" != "build/${SCHEME_NAME}.ipa" ]; then
    mv "$EXPORTED_IPA" "$IPA_PATH"
  fi
  echo "✅ IPA exported successfully: $IPA_PATH"
else
  echo "❌ IPA export failed"
  echo "Checking build directory contents:"
  ls -la build/
  exit 1
fi

# Export Options plist 정리
rm -f "$EXPORT_PLIST"

# 빌드 정보 출력
echo "📊 Build Summary:"
echo "=================="
echo "  Platform: iOS"
echo "  Build Mode: $BUILD_MODE"
echo "  Configuration: $CONFIGURATION"
echo "  Build Date: $(date)"

if [ -f "$IPA_PATH" ]; then
  IPA_SIZE=$(du -h "$IPA_PATH" | cut -f1)
  echo "  IPA Size: $IPA_SIZE"
  
  # IPA 내용 검증
  echo "📋 IPA Contents:"
  unzip -l "$IPA_PATH" | head -10
fi

echo "✅ iOS build process completed successfully!"

# 프로젝트 루트로 돌아가기
cd ..

# 빌드 결과물 정보를 환경변수로 설정 (후속 스크립트에서 사용)
if [ -f "ios/$IPA_PATH" ]; then
  export BUILD_OUTPUT_PATH="ios/$IPA_PATH"
  echo "📍 Build output path: $BUILD_OUTPUT_PATH"
else
  echo "❌ Build output file not found"
  exit 1
fi