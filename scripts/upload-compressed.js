#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const FormData = require('form-data');
const axios = require('axios');

class CompressedUploader {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.config = this.loadConfig();
  }

  loadConfig() {
    return {
      buildId: process.env.BUILD_ID || 'default-build',
      platform: process.env.PLATFORM || 'android',
      buildType: process.env.BUILD_TYPE || 'apk',
      buildFile: process.env.BUILD_FILE,
      s3UploadUrl: process.env.S3_UPLOAD_URL,
      refrigeratorEndpoint: 'http://refrigerator-env.eba-hmupckju.ap-northeast-2.elasticbeanstalk.com/v1/file',
      bucket: 'withcookie-bucket',
      uploadPath: 'app-builds',
      unlimitedKey: process.env.REFRIGERATOR_UNLIMITED_KEY || 'UNLIMITED2024'
    };
  }

  async compressFile(inputPath, outputPath) {
    console.log('🗜️ Creating ZIP archive...');
    const startSize = fs.statSync(inputPath).size;
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 최대 압축
      });
      
      output.on('close', () => {
        const endSize = archive.pointer();
        const reduction = ((1 - endSize / startSize) * 100).toFixed(1);
        
        console.log(`  Original size: ${(startSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Compressed size: ${(endSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Reduction: ${reduction}%`);
        
        resolve({
          originalSize: startSize,
          compressedSize: endSize,
          reduction: reduction
        });
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      
      // APK 파일만 ZIP에 추가 (파일명만 유지)
      const fileName = path.basename(inputPath);
      archive.file(inputPath, { name: fileName });
      
      archive.finalize();
    });
  }

  async uploadCompressed() {
    try {
      console.log('📦 Starting compressed upload process...');
      
      // 1. 빌드 파일 찾기
      const buildFilePath = this.config.buildFile;
      if (!buildFilePath || !fs.existsSync(buildFilePath)) {
        throw new Error(`Build file not found: ${buildFilePath}`);
      }
      
      console.log('📁 Found build file:', buildFilePath);
      const fileName = path.basename(buildFilePath);
      
      // 2. 압축 파일 경로 설정 (임시 zip 파일)
      const tempCompressedPath = buildFilePath + '.tmp.zip';
      const fileExtension = path.extname(buildFilePath); // .apk, .aab, .ipa
      const fileNameWithoutExt = path.basename(buildFilePath, fileExtension);
      // 압축 파일임을 명확히 표시 (.apk.zip, .aab.zip, .ipa.zip)
      const compressedFileName = fileNameWithoutExt + '.zip';
      
      // 3. 파일 압축 (임시 zip 파일로)
      const compressionResult = await this.compressFile(buildFilePath, tempCompressedPath);
      
      // 4. 압축 파일 크기 확인
      const compressedSizeMB = compressionResult.compressedSize / 1024 / 1024;
      console.log(`📏 Compressed file size: ${compressedSizeMB.toFixed(2)}MB`);
      
      // 5. S3 업로드 (압축된 파일을 원본 확장자로 업로드)
      let uploadResult;
      if (compressedSizeMB <= 20) {
        const rawResult = await this.uploadToRefrigerator(tempCompressedPath, compressedFileName);
        uploadResult = {
          fileUrl: rawResult.file || rawResult.url || rawResult.fileUrl,
          ...rawResult
        };
        console.log('✅ Uploaded to Refrigerator (S3):', uploadResult.fileUrl);
      } else {
        // 20MB 초과 시 압축 파일도 업로드 시도
        console.log('⚠️ Compressed file still exceeds 20MB, attempting with unlimited key...');
        const rawResult = await this.uploadToRefrigeratorUnlimited(tempCompressedPath, compressedFileName);
        uploadResult = {
          fileUrl: rawResult.file || rawResult.url || rawResult.fileUrl,
          ...rawResult
        };
        console.log('✅ Uploaded to Refrigerator (S3) with unlimited key:', uploadResult.fileUrl);
      }
      
      // 6. 임시 압축 파일 삭제 (정리)
      fs.unlinkSync(tempCompressedPath);
      console.log('🧹 Cleaned up temporary compressed file');
      
      // 7. 결과 반환
      const result = {
        ...uploadResult,
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        reduction: compressionResult.reduction,
        fileName: fileName,
        compressedFileName: compressedFileName
      };
      
      // 8. 업로드 완료 알림
      if (this.config.s3UploadUrl) {
        await this.notifyUploadComplete(result);
      }
      
      console.log('✅ Compressed upload completed successfully');
      console.log('🔗 Download URL:', result.fileUrl);
      console.log('');
      console.log('⚠️  IMPORTANT: File is ZIP compressed');
      console.log('📱 To install on Android:');
      console.log(`    1. Download: ${result.compressedFileName}`);
      console.log(`    2. Extract: unzip ${result.compressedFileName}`);
      console.log(`    3. Install: adb install ${result.fileName}`);
      return result;
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  async uploadToRefrigerator(filePath, fileName) {
    const fileStream = fs.createReadStream(filePath);
    const fileSizeMB = fs.statSync(filePath).size / 1024 / 1024;
    
    const form = new FormData();
    form.append('file', fileStream, fileName);
    form.append('bucket', this.config.bucket);
    form.append('path', `${this.config.uploadPath}/${this.config.buildId}`);
    
    // 20MB 이하인 경우 일반 업로드
    const response = await axios.post(this.config.refrigeratorEndpoint, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    
    return response.data;
  }

  async uploadToRefrigeratorUnlimited(filePath, fileName) {
    const fileStream = fs.createReadStream(filePath);
    
    const form = new FormData();
    // unlimitedKey를 먼저 추가
    form.append('unlimitedKey', this.config.unlimitedKey);
    form.append('file', fileStream, fileName);
    form.append('bucket', this.config.bucket);
    form.append('path', `${this.config.uploadPath}/${this.config.buildId}`);
    
    // URL에도 추가
    const uploadUrl = `${this.config.refrigeratorEndpoint}?unlimitedKey=${this.config.unlimitedKey}`;
    
    const response = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    
    return response.data;
  }

  async notifyUploadComplete(uploadResult) {
    try {
      console.log('📬 Notifying upload completion...');
      
      const notification = {
        build_id: this.config.buildId,
        platform: this.config.platform,
        build_type: this.config.buildType,
        upload_result: uploadResult,
        timestamp: new Date().toISOString(),
        compression_info: {
          original_size_mb: (uploadResult.originalSize / 1024 / 1024).toFixed(2),
          compressed_size_mb: (uploadResult.compressedSize / 1024 / 1024).toFixed(2),
          reduction_percent: uploadResult.reduction
        }
      };
      
      await axios.post(this.config.s3UploadUrl, notification);
      console.log('✅ Upload notification sent');
    } catch (error) {
      console.error('⚠️ Failed to send upload notification:', error.message);
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  const uploader = new CompressedUploader();
  uploader.uploadCompressed()
    .then((result) => {
      console.log('📊 Upload Summary:');
      console.log(`  Original file: ${result.fileName}`);
      console.log(`  Uploaded as: ${result.compressedFileName}`);
      console.log(`  Size reduction: ${result.reduction}%`);
      console.log(`  🔗 Download URL: ${result.fileUrl}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Upload failed:', error);
      process.exit(1);
    });
}

module.exports = CompressedUploader;