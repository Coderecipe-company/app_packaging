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
      console.log('📱 App Name:', this.buildConfig.appName);
      console.log('📦 Package Name:', this.buildConfig.packageName);
      console.log('🌐 Base URL:', this.buildConfig.baseUrl);
      console.log('🎨 Icon URL:', this.buildConfig.appIconUrl);
      
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
    console.log('🌐 Updating base URL to:', this.buildConfig.baseUrl);
    
    // React Native AsyncStorage에 기본 URL 설정
    const appJsPath = path.join(this.projectRoot, 'App.js');
    if (fs.existsSync(appJsPath)) {
      let appJsContent = fs.readFileSync(appJsPath, 'utf8');
      
      // Check current default URL
      const currentMatch = appJsContent.match(/const defaultUrl = '([^']*)'/);
      console.log('  Current default URL:', currentMatch ? currentMatch[1] : 'not found');
      
      // Update the default URL
      appJsContent = appJsContent.replace(
        /const defaultUrl = '[^']*'/,
        `const defaultUrl = '${this.buildConfig.baseUrl}'`
      );
      
      // Verify the change
      const newMatch = appJsContent.match(/const defaultUrl = '([^']*)'/);
      console.log('  New default URL:', newMatch ? newMatch[1] : 'not set');
      
      fs.writeFileSync(appJsPath, appJsContent);
    } else {
      console.log('  ❌ App.js not found at:', appJsPath);
    }
  }

  async downloadAndApplyAppIcon() {
    console.log('🎨 Downloading and applying app icon from:', this.buildConfig.appIconUrl);
    
    try {
      const axios = require('axios');
      const sharp = require('sharp');
      
      console.log('  📥 Downloading icon from URL...');
      // 아이콘 다운로드
      const response = await axios.get(this.buildConfig.appIconUrl, { responseType: 'arraybuffer' });
      const iconBuffer = Buffer.from(response.data);
      
      console.log('  ✅ Icon downloaded successfully, generating Android icons...');
      // Android 아이콘 생성
      await this.generateAndroidIcons(iconBuffer);
      console.log('  ✅ Android icons generated successfully');
      
      // iOS 아이콘 생성
      if (this.buildConfig.platform === 'ios') {
        await this.generateIOSIcons(iconBuffer);
        console.log('  ✅ iOS icons generated successfully');
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
      
      // Convert to PNG first to ensure compatibility
      const processedIcon = await sharp(iconBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      
      await sharp(processedIcon)
        .toFile(outputPath);
      
      // 라운드 아이콘도 생성
      const roundOutputPath = path.join(
        this.projectRoot,
        `android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`
      );
      
      await sharp(processedIcon)
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
    console.log('🔥 Downloading Firebase configuration from:', this.buildConfig.firebaseConfigUrl);
    
    try {
      const axios = require('axios');
      
      if (this.buildConfig.platform === 'android') {
        console.log('  📥 Downloading Firebase config (any filename -> google-services.json)...');
        const response = await axios.get(this.buildConfig.firebaseConfigUrl);
        const configPath = path.join(this.projectRoot, 'android/app/google-services.json');
        
        // URL의 파일명과 관계없이 항상 google-services.json으로 저장
        // response.data가 이미 객체인 경우와 문자열인 경우를 모두 처리
        let configData;
        if (typeof response.data === 'string') {
          try {
            configData = JSON.parse(response.data);
          } catch {
            configData = response.data;
          }
        } else {
          configData = response.data;
        }
        
        // JSON 형식으로 저장
        if (typeof configData === 'object') {
          fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
        } else {
          fs.writeFileSync(configPath, configData);
        }
        
        console.log('  ✅ google-services.json saved successfully (from ' + this.buildConfig.firebaseConfigUrl.split('/').pop() + ')');
      } else if (this.buildConfig.platform === 'ios') {
        console.log('  📥 Downloading Firebase config (any filename -> GoogleService-Info.plist)...');
        const response = await axios.get(this.buildConfig.firebaseConfigUrl, { responseType: 'arraybuffer' });
        const configPath = path.join(this.projectRoot, 'ios/AppPackaging/GoogleService-Info.plist');
        fs.writeFileSync(configPath, Buffer.from(response.data));
        console.log('  ✅ GoogleService-Info.plist saved successfully (from ' + this.buildConfig.firebaseConfigUrl.split('/').pop() + ')');
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
      // Fix CDN domain: cdn.withcookie.com -> withcookie.b-cdn.net
      let keystoreUrl = this.buildConfig.keystoreUrl;
      if (keystoreUrl.includes('cdn.withcookie.com')) {
        keystoreUrl = keystoreUrl.replace('cdn.withcookie.com', 'withcookie.b-cdn.net');
        console.log(`  📝 Fixed keystore URL: ${keystoreUrl}`);
      }
      
      const response = await axios.get(keystoreUrl, { responseType: 'arraybuffer' });
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

  async updateAndroidJavaFiles() {
    console.log('📦 Updating Android Java files for package:', this.buildConfig.packageName);
    
    const javaBasePath = path.join(this.projectRoot, 'android/app/src/main/java');
    const newPackagePath = this.buildConfig.packageName.replace(/\./g, '/');
    const newPackageDir = path.join(javaBasePath, newPackagePath);
    
    // Find existing Java files (MainActivity.java and MainApplication.java)
    const findJavaFiles = (dir) => {
      const files = [];
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            files.push(...findJavaFiles(path.join(dir, item.name)));
          } else if (item.name.endsWith('.java') && 
                    (item.name === 'MainActivity.java' || item.name === 'MainApplication.java')) {
            files.push(path.join(dir, item.name));
          }
        }
      }
      return files;
    };
    
    const existingJavaFiles = findJavaFiles(javaBasePath);
    console.log('  Found Java files:', existingJavaFiles);
    
    // Create new package directory structure
    if (!fs.existsSync(newPackageDir)) {
      fs.mkdirSync(newPackageDir, { recursive: true });
      console.log('  Created package directory:', newPackageDir);
    }
    
    // Move and update Java files
    for (const oldFilePath of existingJavaFiles) {
      const fileName = path.basename(oldFilePath);
      const newFilePath = path.join(newPackageDir, fileName);
      
      // Read the file content
      let content = fs.readFileSync(oldFilePath, 'utf8');
      
      // Update package declaration
      content = content.replace(
        /^package\s+[^;]+;/m,
        `package ${this.buildConfig.packageName};`
      );
      
      // Write to new location
      fs.writeFileSync(newFilePath, content);
      console.log(`  ✅ Updated ${fileName} with new package name`);
      
      // Delete old file if it's in a different location
      if (oldFilePath !== newFilePath) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    // Clean up old empty directories
    const cleanEmptyDirs = (dir) => {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        let items = fs.readdirSync(dir);
        if (items.length === 0) {
          fs.rmdirSync(dir);
          // Check parent directory
          const parentDir = path.dirname(dir);
          if (parentDir !== javaBasePath) {
            cleanEmptyDirs(parentDir);
          }
        } else {
          // Check subdirectories
          items.forEach(item => {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
              cleanEmptyDirs(itemPath);
            }
          });
          // Re-check if this directory is now empty
          items = fs.readdirSync(dir);
          if (items.length === 0 && dir !== javaBasePath) {
            fs.rmdirSync(dir);
          }
        }
      }
    };
    
    // Clean up com directory (but not the new package directory)
    const comDir = path.join(javaBasePath, 'com');
    if (fs.existsSync(comDir)) {
      cleanEmptyDirs(comDir);
    }
    
    console.log('  ✅ Java files updated successfully');
  }

  async configureAndroid() {
    console.log('🤖 Configuring Android specific settings...');
    
    // Update Java files with new package name
    await this.updateAndroidJavaFiles();
    
    console.log('✅ Android configuration completed');
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