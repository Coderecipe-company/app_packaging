#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AppConfigurator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildConfig = this.loadBuildConfig();
  }

  loadBuildConfig() {
    try {
      // GitHub Actions 환경변수 또는 설정 파일에서 빌드 설정 로드
      return {
        buildId: process.env.BUILD_ID || 'default-build',
        appName: process.env.APP_NAME || 'AppPackaging',
        packageName: process.env.PACKAGE_NAME || 'com.apppackaging',
        platform: process.env.PLATFORM || 'android', // android, ios
        baseUrl: process.env.BASE_URL || 'https://withcookie.com',
        appIconUrl: process.env.APP_ICON_URL,
        firebaseConfigUrl: process.env.FIREBASE_CONFIG_URL,
        keystoreUrl: process.env.KEYSTORE_URL,
        keystorePassword: process.env.KEYSTORE_PASSWORD,
        keyAlias: process.env.KEY_ALIAS,
        keyPassword: process.env.KEY_PASSWORD,
        buildType: process.env.BUILD_TYPE || 'apk', // apk, aab, ipa
        outputPath: process.env.OUTPUT_PATH,
        s3UploadUrl: process.env.S3_UPLOAD_URL,
        versionCode: process.env.VERSION_CODE || '1',
        versionName: process.env.VERSION_NAME || '1.0.0',
        buildNumber: process.env.BUILD_NUMBER || '1', // iOS Build Number
        marketingVersion: process.env.MARKETING_VERSION || process.env.VERSION_NAME || '1.0.0' // iOS Marketing Version
      };
    } catch (error) {
      console.error('Error loading build config:', error);
      throw error;
    }
  }

  async configureApp() {
    try {
      console.log('🔧 Configuring app with build ID:', this.buildConfig.buildId);
      
      // 1. 앱 이름 및 패키지명 설정
      await this.updateAppIdentity();
      
      // 2. 베이스 URL 설정
      await this.updateBaseUrl();
      
      // 3. 앱 아이콘 다운로드 및 적용
      if (this.buildConfig.appIconUrl) {
        await this.downloadAndApplyAppIcon();
      } else {
        // 아이콘 URL이 없으면 기본 아이콘 생성
        console.log('🎨 No icon URL provided, generating default icon...');
        const generateDefaultIcon = require('./generate-default-icon');
        await generateDefaultIcon();
      }
      
      // 4. Firebase 설정 파일 다운로드 및 적용
      if (this.buildConfig.firebaseConfigUrl) {
        await this.downloadAndApplyFirebaseConfig();
      }
      
      // 5. 서명 키 파일 다운로드 (Android만)
      if (this.buildConfig.platform === 'android' && this.buildConfig.keystoreUrl) {
        await this.downloadAndApplyKeystore();
      }
      
      // 6. 플랫폼별 추가 설정
      if (this.buildConfig.platform === 'android') {
        await this.configureAndroid();
      } else if (this.buildConfig.platform === 'ios') {
        await this.configureIOS();
      }
      
      console.log('✅ App configuration completed successfully');
    } catch (error) {
      console.error('❌ App configuration failed:', error);
      throw error;
    }
  }

  async updateAppIdentity() {
    console.log('📝 Updating app identity...');
    
    // Android strings.xml 업데이트
    const stringsPath = path.join(this.projectRoot, 'android/app/src/main/res/values/strings.xml');
    if (fs.existsSync(stringsPath)) {
      let stringsContent = fs.readFileSync(stringsPath, 'utf8');
      stringsContent = stringsContent.replace(
        /<string name="app_name">[^<]*<\/string>/,
        `<string name="app_name">${this.buildConfig.appName}</string>`
      );
      fs.writeFileSync(stringsPath, stringsContent);
    }
    
    // Android AndroidManifest.xml 업데이트
    const manifestPath = path.join(this.projectRoot, 'android/app/src/main/AndroidManifest.xml');
    if (fs.existsSync(manifestPath)) {
      let manifestContent = fs.readFileSync(manifestPath, 'utf8');
      manifestContent = manifestContent.replace(
        /package="[^"]*"/,
        `package="${this.buildConfig.packageName}"`
      );
      manifestContent = manifestContent.replace(
        /com\.apppackaging/g,
        this.buildConfig.packageName
      );
      fs.writeFileSync(manifestPath, manifestContent);
    }
    
    // Android build.gradle 업데이트
    const buildGradlePath = path.join(this.projectRoot, 'android/app/build.gradle');
    if (fs.existsSync(buildGradlePath)) {
      let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
      buildGradleContent = buildGradleContent.replace(
        /namespace '[^']*'/,
        `namespace '${this.buildConfig.packageName}'`
      );
      buildGradleContent = buildGradleContent.replace(
        /applicationId "[^"]*"/,
        `applicationId "${this.buildConfig.packageName}"`
      );
      buildGradleContent = buildGradleContent.replace(
        /versionCode \d+/,
        `versionCode ${this.buildConfig.versionCode}`
      );
      buildGradleContent = buildGradleContent.replace(
        /versionName "[^"]*"/,
        `versionName "${this.buildConfig.versionName}"`
      );
      fs.writeFileSync(buildGradlePath, buildGradleContent);
    }
    
    // iOS Info.plist 업데이트
    const infoPlistPath = path.join(this.projectRoot, 'ios/AppPackaging/Info.plist');
    if (fs.existsSync(infoPlistPath)) {
      let infoPlistContent = fs.readFileSync(infoPlistPath, 'utf8');
      infoPlistContent = infoPlistContent.replace(
        /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleDisplayName</key>\n\t<string>${this.buildConfig.appName}</string>`
      );
      fs.writeFileSync(infoPlistPath, infoPlistContent);
    }
  }

  async updateBaseUrl() {
    console.log('🌐 Updating base URL...');
    
    // React Native AsyncStorage에 기본 URL 설정
    const appJsPath = path.join(this.projectRoot, 'App.js');
    if (fs.existsSync(appJsPath)) {
      let appJsContent = fs.readFileSync(appJsPath, 'utf8');
      // Update the default URL
      appJsContent = appJsContent.replace(
        /const defaultUrl = '[^']*'/,
        `const defaultUrl = '${this.buildConfig.baseUrl}'`
      );
      fs.writeFileSync(appJsPath, appJsContent);
    }
  }

  async downloadAndApplyAppIcon() {
    console.log('🎨 Downloading and applying app icon...');
    
    try {
      const axios = require('axios');
      const sharp = require('sharp');
      
      // 아이콘 다운로드
      const response = await axios.get(this.buildConfig.appIconUrl, { responseType: 'arraybuffer' });
      const iconBuffer = Buffer.from(response.data);
      
      // Android 아이콘 생성
      await this.generateAndroidIcons(iconBuffer);
      
      // iOS 아이콘 생성
      if (this.buildConfig.platform === 'ios') {
        await this.generateIOSIcons(iconBuffer);
      }
      
    } catch (error) {
      console.error('Icon processing failed:', error);
      console.log('🎨 Falling back to default icon generation...');
      // 아이콘 다운로드 실패 시 기본 아이콘 생성
      const generateDefaultIcon = require('./generate-default-icon');
      await generateDefaultIcon();
    }
  }

  async generateAndroidIcons(iconBuffer) {
    const sharp = require('sharp');
    const androidIconSizes = [
      { size: 48, density: 'mdpi' },
      { size: 72, density: 'hdpi' },
      { size: 96, density: 'xhdpi' },
      { size: 144, density: 'xxhdpi' },
      { size: 192, density: 'xxxhdpi' }
    ];
    
    for (const { size, density } of androidIconSizes) {
      const outputPath = path.join(
        this.projectRoot,
        `android/app/src/main/res/mipmap-${density}/ic_launcher.png`
      );
      
      await sharp(iconBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      // 라운드 아이콘도 생성
      const roundOutputPath = path.join(
        this.projectRoot,
        `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`
      );
      
      await sharp(iconBuffer)
        .resize(size, size)
        .png()
        .toFile(roundOutputPath);
    }
  }

  async generateIOSIcons(iconBuffer) {
    const sharp = require('sharp');
    const iosIconSizes = [
      { size: 20, scale: 2 }, { size: 20, scale: 3 },
      { size: 29, scale: 2 }, { size: 29, scale: 3 },
      { size: 40, scale: 2 }, { size: 40, scale: 3 },
      { size: 60, scale: 2 }, { size: 60, scale: 3 },
      { size: 1024, scale: 1 }
    ];
    
    for (const { size, scale } of iosIconSizes) {
      const actualSize = size * scale;
      const filename = scale === 1 ? 
        `icon-${size}.png` : 
        `icon-${size}@${scale}x.png`;
      
      const outputPath = path.join(
        this.projectRoot,
        `ios/AppPackaging/Images.xcassets/AppIcon.appiconset/${filename}`
      );
      
      await sharp(iconBuffer)
        .resize(actualSize, actualSize)
        .png()
        .toFile(outputPath);
    }
  }

  async downloadAndApplyFirebaseConfig() {
    console.log('🔥 Downloading Firebase configuration...');
    
    try {
      const axios = require('axios');
      
      if (this.buildConfig.platform === 'android') {
        const response = await axios.get(this.buildConfig.firebaseConfigUrl);
        const configPath = path.join(this.projectRoot, 'android/app/google-services.json');
        fs.writeFileSync(configPath, JSON.stringify(response.data, null, 2));
      } else if (this.buildConfig.platform === 'ios') {
        const response = await axios.get(this.buildConfig.firebaseConfigUrl, { responseType: 'arraybuffer' });
        const configPath = path.join(this.projectRoot, 'ios/AppPackaging/GoogleService-Info.plist');
        fs.writeFileSync(configPath, Buffer.from(response.data));
      }
      
    } catch (error) {
      console.error('Firebase config download failed:', error);
      throw error;
    }
  }

  async downloadAndApplyKeystore() {
    console.log('🔐 Downloading keystore file...');
    
    try {
      const axios = require('axios');
      const response = await axios.get(this.buildConfig.keystoreUrl, { responseType: 'arraybuffer' });
      const keystorePath = path.join(this.projectRoot, 'android/app/release.keystore');
      fs.writeFileSync(keystorePath, Buffer.from(response.data));
      
      // gradle.properties에 서명 정보 추가
      const gradlePropsPath = path.join(this.projectRoot, 'android/gradle.properties');
      let gradlePropsContent = fs.readFileSync(gradlePropsPath, 'utf8');
      
      const signingConfig = `
MYAPP_UPLOAD_STORE_FILE=release.keystore
MYAPP_UPLOAD_STORE_PASSWORD=${this.buildConfig.keystorePassword}
MYAPP_UPLOAD_KEY_ALIAS=${this.buildConfig.keyAlias}
MYAPP_UPLOAD_KEY_PASSWORD=${this.buildConfig.keyPassword}
`;
      
      gradlePropsContent += signingConfig;
      fs.writeFileSync(gradlePropsPath, gradlePropsContent);
      
    } catch (error) {
      console.error('Keystore download failed:', error);
      throw error;
    }
  }

  async configureAndroid() {
    console.log('🤖 Configuring Android specific settings...');
    
    // Java 패키지명 변경
    const oldPackagePath = path.join(this.projectRoot, 'android/app/src/main/java/com/apppackaging');
    const newPackagePath = path.join(this.projectRoot, `android/app/src/main/java/${this.buildConfig.packageName.replace(/\./g, '/')}`);
    
    if (fs.existsSync(oldPackagePath) && oldPackagePath !== newPackagePath) {
      // 새 디렉토리 생성
      fs.mkdirSync(newPackagePath, { recursive: true });
      
      // 파일들 복사 및 패키지명 변경
      const javaFiles = fs.readdirSync(oldPackagePath);
      for (const file of javaFiles) {
        const oldFilePath = path.join(oldPackagePath, file);
        const newFilePath = path.join(newPackagePath, file);
        
        let content = fs.readFileSync(oldFilePath, 'utf8');
        content = content.replace(/package com\.apppackaging;/, `package ${this.buildConfig.packageName};`);
        fs.writeFileSync(newFilePath, content);
      }
      
      // 기존 디렉토리 삭제 (다른 패키지명인 경우만)
      if (this.buildConfig.packageName !== 'com.apppackaging') {
        fs.rmSync(oldPackagePath, { recursive: true, force: true });
      }
    }
  }

  async configureIOS() {
    console.log('🍎 Configuring iOS specific settings...');
    
    // Info.plist 파일 업데이트
    const infoPlistPath = path.join(this.projectRoot, 'ios/AppPackaging/Info.plist');
    if (fs.existsSync(infoPlistPath)) {
      let infoPlistContent = fs.readFileSync(infoPlistPath, 'utf8');
      
      // Bundle Identifier 업데이트
      infoPlistContent = infoPlistContent.replace(
        /com\.apppackaging/g,
        this.buildConfig.packageName
      );
      
      // CFBundleShortVersionString (Marketing Version) 업데이트
      if (infoPlistContent.includes('<key>CFBundleShortVersionString</key>')) {
        infoPlistContent = infoPlistContent.replace(
          /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
          `$1${this.buildConfig.marketingVersion}$2`
        );
      } else {
        // CFBundleShortVersionString이 없으면 추가
        infoPlistContent = infoPlistContent.replace(
          /(<key>CFBundleVersion<\/key>)/,
          `<key>CFBundleShortVersionString</key>\n\t<string>${this.buildConfig.marketingVersion}</string>\n\t$1`
        );
      }
      
      // CFBundleVersion (Build Number) 업데이트
      if (infoPlistContent.includes('<key>CFBundleVersion</key>')) {
        infoPlistContent = infoPlistContent.replace(
          /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
          `$1${this.buildConfig.buildNumber}$2`
        );
      }
      
      fs.writeFileSync(infoPlistPath, infoPlistContent);
    }
    
    // project.pbxproj 파일에서 버전 정보 업데이트 (간단한 방식)
    const pbxprojPath = path.join(this.projectRoot, 'ios/AppPackaging.xcodeproj/project.pbxproj');
    if (fs.existsSync(pbxprojPath)) {
      let pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');
      
      // MARKETING_VERSION 업데이트
      pbxprojContent = pbxprojContent.replace(
        /MARKETING_VERSION = [^;]*/g,
        `MARKETING_VERSION = ${this.buildConfig.marketingVersion}`
      );
      
      // CURRENT_PROJECT_VERSION (Build Number) 업데이트
      pbxprojContent = pbxprojContent.replace(
        /CURRENT_PROJECT_VERSION = [^;]*/g,
        `CURRENT_PROJECT_VERSION = ${this.buildConfig.buildNumber}`
      );
      
      // PRODUCT_BUNDLE_IDENTIFIER 업데이트
      pbxprojContent = pbxprojContent.replace(
        /PRODUCT_BUNDLE_IDENTIFIER = [^;]*/g,
        `PRODUCT_BUNDLE_IDENTIFIER = ${this.buildConfig.packageName}`
      );
      
      fs.writeFileSync(pbxprojPath, pbxprojContent);
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  const configurator = new AppConfigurator();
  configurator.configureApp()
    .then(() => {
      console.log('✅ Configuration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Configuration failed:', error);
      process.exit(1);
    });
}

module.exports = AppConfigurator;