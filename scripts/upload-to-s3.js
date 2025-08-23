#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

class S3Uploader {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.config = this.loadConfig();
  }

  loadConfig() {
    return {
      buildId: process.env.BUILD_ID || 'default-build',
      platform: process.env.PLATFORM || 'android',
      buildType: process.env.BUILD_TYPE || 'apk',
      outputPath: process.env.OUTPUT_PATH,
      s3UploadUrl: process.env.S3_UPLOAD_URL,
      refrigeratorEndpoint: 'https://refrigerator.logipasta.com/v1/file',
      bucket: 'withcookie-bucket',
      uploadPath: 'app-builds',
      unlimitedKey: process.env.REFRIGERATOR_UNLIMITED_KEY || 'UNLIMITED2024'
    };
  }

  async uploadBuildResult() {
    try {
      console.log('📦 Starting build result upload...');
      
      // 1. 빌드 결과물 찾기
      const buildFilePath = await this.findBuildFile();
      if (!buildFilePath || !fs.existsSync(buildFilePath)) {
        throw new Error('Build file not found');
      }
      
      console.log('📁 Found build file:', buildFilePath);
      
      // 2. 냉장고 API를 통해 S3에 업로드
      const uploadResult = await this.uploadToRefrigerator(buildFilePath);
      
      // 3. 업로드 결과를 지정된 경로로 전달
      if (this.config.s3UploadUrl) {
        await this.notifyUploadComplete(uploadResult);
      }
      
      console.log('✅ Build result uploaded successfully:', uploadResult.fileUrl);
      return uploadResult;
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  async findBuildFile() {
    let searchPaths = [];
    let fileExtension = '';
    
    if (this.config.platform === 'android') {
      if (this.config.buildType === 'aab') {
        searchPaths = [
          'android/app/build/outputs/bundle/release/app-release.aab'
        ];
        fileExtension = '.aab';
      } else {
        searchPaths = [
          'android/app/build/outputs/apk/release/app-release.apk',
          'android/app/build/outputs/apk/release/app-release-unsigned.apk'
        ];
        fileExtension = '.apk';
      }
    } else if (this.config.platform === 'ios') {
      searchPaths = [
        'ios/build/AppPackaging.ipa',
        'ios/AppPackaging.xcarchive/AppPackaging.ipa'
      ];
      fileExtension = '.ipa';
    }
    
    // 빌드 파일 찾기
    for (const searchPath of searchPaths) {
      const fullPath = path.join(this.projectRoot, searchPath);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // 파일을 찾지 못한 경우 디렉토리에서 확장자로 검색
    const outputDir = this.config.platform === 'android' 
      ? path.join(this.projectRoot, 'android/app/build/outputs')
      : path.join(this.projectRoot, 'ios/build');
    
    if (fs.existsSync(outputDir)) {
      const files = this.findFilesByExtension(outputDir, fileExtension);
      if (files.length > 0) {
        return files[0]; // 첫 번째 파일 반환
      }
    }
    
    return null;
  }

  findFilesByExtension(dir, extension) {
    let results = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        results = results.concat(this.findFilesByExtension(fullPath, extension));
      } else if (path.extname(fullPath).toLowerCase() === extension.toLowerCase()) {
        results.push(fullPath);
      }
    }
    
    return results;
  }

  async uploadToRefrigerator(filePath) {
    console.log('☁️ Uploading to Refrigerator...');
    
    try {
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const uploadFileName = `${this.config.buildId}-${timestamp}-${fileName}`;
      
      // 파일 크기 확인
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      console.log(`📏 File size: ${fileSizeMB.toFixed(2)} MB`);
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), uploadFileName);
      formData.append('bucket', this.config.bucket);
      formData.append('path', this.config.uploadPath);
      
      // 20MB 이상인 경우 무제한 키 추가
      if (fileSizeMB > 20) {
        console.log('🔓 Adding unlimited key for large file upload...');
        formData.append('unlimitedKey', this.config.unlimitedKey);
      }
      
      const response = await axios.post(this.config.refrigeratorEndpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          'Access-Control-Allow-Origin': '*',
        },
        timeout: 300000, // 5분 타임아웃 (큰 파일 고려)
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      if (response.data && response.data.file) {
        return {
          success: true,
          fileUrl: response.data.file,
          fileName: uploadFileName,
          originalPath: filePath,
          buildId: this.config.buildId,
          platform: this.config.platform,
          buildType: this.config.buildType,
          uploadedAt: new Date().toISOString()
        };
      } else {
        throw new Error('Invalid response from Refrigerator API');
      }
      
    } catch (error) {
      console.error('Refrigerator upload error:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async notifyUploadComplete(uploadResult) {
    console.log('📬 Notifying upload completion...');
    
    try {
      const notificationData = {
        buildId: this.config.buildId,
        status: 'completed',
        result: uploadResult,
        timestamp: new Date().toISOString()
      };
      
      const response = await axios.post(this.config.s3UploadUrl, notificationData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30초 타임아웃
      });
      
      console.log('✅ Upload notification sent successfully');
      return response.data;
      
    } catch (error) {
      console.error('Upload notification failed:', error);
      // 알림 실패는 전체 프로세스를 중단시키지 않음
    }
  }

  // 빌드 메타데이터 생성
  generateBuildMetadata(uploadResult) {
    const metadata = {
      buildId: this.config.buildId,
      platform: this.config.platform,
      buildType: this.config.buildType,
      fileUrl: uploadResult.fileUrl,
      fileName: uploadResult.fileName,
      buildDate: new Date().toISOString(),
      fileSize: this.getFileSize(uploadResult.originalPath),
      checksum: this.calculateChecksum(uploadResult.originalPath)
    };
    
    return metadata;
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      console.error('Error getting file size:', error);
      return null;
    }
  }

  calculateChecksum(filePath) {
    try {
      const crypto = require('crypto');
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch (error) {
      console.error('Error calculating checksum:', error);
      return null;
    }
  }

  // 업로드 진행상황 리포터
  createProgressReporter() {
    let uploadedBytes = 0;
    let totalBytes = 0;
    
    return {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.lengthComputable) {
          uploadedBytes = progressEvent.loaded;
          totalBytes = progressEvent.total;
          const percentCompleted = Math.round((uploadedBytes * 100) / totalBytes);
          console.log(`📊 Upload progress: ${percentCompleted}% (${this.formatBytes(uploadedBytes)}/${this.formatBytes(totalBytes)})`);
        }
      }
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 스크립트 실행
if (require.main === module) {
  const uploader = new S3Uploader();
  uploader.uploadBuildResult()
    .then((result) => {
      console.log('✅ Upload completed successfully');
      console.log('📄 Build file URL:', result.fileUrl);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Upload failed:', error);
      process.exit(1);
    });
}

module.exports = S3Uploader;