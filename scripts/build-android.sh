#!/bin/bash

set -e

echo "🤖 Starting Android build process..."

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

# 환경변수 확인
BUILD_TYPE=${BUILD_TYPE:-"apk"}
BUILD_MODE=${BUILD_MODE:-"release"}

echo "📋 Build Configuration:"
echo "  Build Type: $BUILD_TYPE"
echo "  Build Mode: $BUILD_MODE"
echo "  App Name: ${APP_NAME:-'AppPackaging'}"
echo "  Package Name: ${PACKAGE_NAME:-'com.apppackaging'}"

# Node.js 의존성 설치
echo "📦 Installing Node.js dependencies..."
npm install --production=false

# React Native Metro 번들러 캐시 클리어
echo "🧹 Clearing Metro bundler cache..."
npx react-native start --reset-cache --port 8081 > /dev/null 2>&1 &
METRO_PID=$!
sleep 3
kill $METRO_PID 2>/dev/null || true
sleep 1

# Android 디렉토리로 이동
cd android

# Gradle 환경 설정 - 기존 환경변수 정리 후 재설정
unset GRADLE_OPTS
unset JAVA_OPTS
export GRADLE_OPTS="-Xmx2048m -Xms512m -XX:MaxMetaspaceSize=512m"
export JAVA_OPTS="-Xmx2048m -Xms512m"
echo "✅ Gradle environment configured:"
echo "  GRADLE_OPTS: $GRADLE_OPTS"
echo "  JAVA_OPTS: $JAVA_OPTS"

# 기존 Gradle 프로세스 종료
pkill -f gradle || true
sleep 2

# Gradle 캐시 클리어
echo "🧹 Cleaning Gradle build cache..."
./gradlew clean --no-daemon --stacktrace

# Gradle Wrapper 권한 설정
chmod +x gradlew

# 서명 설정 확인
if [ "$BUILD_MODE" = "release" ]; then
  echo "🔐 Checking release signing configuration..."
  
  if [ -n "$KEYSTORE_URL" ] && [ -n "$KEYSTORE_PASSWORD" ]; then
    echo "✅ Release signing configuration found"
  else
    echo "⚠️  No release signing configuration, building unsigned release"
  fi
fi

# 빌드 실행
echo "🔨 Building Android $BUILD_TYPE in $BUILD_MODE mode..."

if [ "$BUILD_TYPE" = "aab" ]; then
  echo "📦 Building Android App Bundle (AAB)..."
  if [ "$BUILD_MODE" = "release" ]; then
    ./gradlew bundleRelease --no-daemon --stacktrace
  else
    ./gradlew bundleDebug --no-daemon --stacktrace
  fi
  
  # AAB 파일 위치 확인
  if [ "$BUILD_MODE" = "release" ]; then
    AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
  else
    AAB_PATH="app/build/outputs/bundle/debug/app-debug.aab"
  fi
  
  if [ -f "$AAB_PATH" ]; then
    echo "✅ AAB build completed: $AAB_PATH"
    ls -la "$AAB_PATH"
  else
    echo "❌ AAB build failed - file not found: $AAB_PATH"
    exit 1
  fi
  
else
  echo "📦 Building Android APK..."
  if [ "$BUILD_MODE" = "release" ]; then
    ./gradlew assembleRelease --no-daemon --stacktrace
  else
    ./gradlew assembleDebug --no-daemon --stacktrace
  fi
  
  # APK 파일 위치 확인
  if [ "$BUILD_MODE" = "release" ]; then
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
    APK_UNSIGNED_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
  else
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
  fi
  
  if [ -f "$APK_PATH" ]; then
    echo "✅ APK build completed: $APK_PATH"
    ls -la "$APK_PATH"
  elif [ -f "$APK_UNSIGNED_PATH" ]; then
    echo "✅ Unsigned APK build completed: $APK_UNSIGNED_PATH"
    ls -la "$APK_UNSIGNED_PATH"
  else
    echo "❌ APK build failed - file not found"
    echo "Checking available files in outputs directory:"
    find app/build/outputs -name "*.apk" -o -name "*.aab" | head -10
    exit 1
  fi
fi

# 빌드 정보 출력
echo "📊 Build Summary:"
echo "=================="
echo "  Platform: Android"
echo "  Build Type: $BUILD_TYPE"
echo "  Build Mode: $BUILD_MODE"
echo "  Build Date: $(date)"

if [ "$BUILD_TYPE" = "aab" ] && [ -f "$AAB_PATH" ]; then
  AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
  echo "  AAB Size: $AAB_SIZE"
elif [ -f "$APK_PATH" ]; then
  APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo "  APK Size: $APK_SIZE"
elif [ -f "$APK_UNSIGNED_PATH" ]; then
  APK_SIZE=$(du -h "$APK_UNSIGNED_PATH" | cut -f1)
  echo "  APK Size: $APK_SIZE (unsigned)"
fi

echo "✅ Android build process completed successfully!"

# 프로젝트 루트로 돌아가기
cd ..

# 빌드 결과물 정보를 환경변수로 설정 (후속 스크립트에서 사용)
if [ "$BUILD_TYPE" = "aab" ] && [ -f "android/$AAB_PATH" ]; then
  export BUILD_OUTPUT_PATH="android/$AAB_PATH"
elif [ -f "android/$APK_PATH" ]; then
  export BUILD_OUTPUT_PATH="android/$APK_PATH"
elif [ -f "android/$APK_UNSIGNED_PATH" ]; then
  export BUILD_OUTPUT_PATH="android/$APK_UNSIGNED_PATH"
fi

echo "📍 Build output path: $BUILD_OUTPUT_PATH"