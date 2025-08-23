#!/usr/bin/env node

const axios = require('axios');

class ArtifactUrlGenerator {
  constructor() {
    this.config = {
      token: process.env.GITHUB_TOKEN,
      repository: process.env.GITHUB_REPOSITORY || 'Coderecipe-company/app_packaging',
      runId: process.env.GITHUB_RUN_ID,
      artifactName: process.env.ARTIFACT_NAME || 'build-android',
      buildId: process.env.BUILD_ID || 'default-build',
      platform: process.env.PLATFORM || 'android',
      buildType: process.env.BUILD_TYPE || 'apk',
      s3UploadUrl: process.env.S3_UPLOAD_URL
    };
  }

  async generateDownloadInfo() {
    try {
      console.log('🔗 Generating download information...');
      
      // GitHub Actions 페이지 URL
      const actionsUrl = `https://github.com/${this.config.repository}/actions/runs/${this.config.runId}`;
      
      // Artifact 다운로드를 위한 직접 링크 (GitHub 로그인 필요)
      const artifactPageUrl = `${actionsUrl}#artifacts`;
      
      // 다운로드 정보 생성
      const downloadInfo = {
        success: true,
        buildId: this.config.buildId,
        platform: this.config.platform,
        buildType: this.config.buildType,
        downloadMethod: 'GitHub Artifacts',
        downloadUrl: artifactPageUrl,
        actionsUrl: actionsUrl,
        artifactName: `${this.config.artifactName}-${this.config.buildId}`,
        instructions: {
          ko: [
            '1. 아래 링크를 클릭하여 GitHub Actions 페이지로 이동',
            '2. 페이지 하단의 "Artifacts" 섹션 확인',
            '3. APK/AAB 파일 다운로드 클릭',
            '4. ZIP 파일 압축 해제 후 설치'
          ],
          en: [
            '1. Click the link below to go to GitHub Actions page',
            '2. Check the "Artifacts" section at the bottom',
            '3. Click to download APK/AAB file',
            '4. Extract ZIP file and install'
          ]
        },
        fileInfo: await this.getFileInfo(),
        generatedAt: new Date().toISOString()
      };

      // 파일 크기가 20MB 이하인 경우 Refrigerator 업로드 시도
      if (downloadInfo.fileInfo && downloadInfo.fileInfo.sizeMB <= 20) {
        console.log('📦 File size is under 20MB, attempting Refrigerator upload...');
        downloadInfo.alternativeDownload = {
          method: 'Refrigerator',
          note: 'File is small enough for direct upload'
        };
      }

      return downloadInfo;
    } catch (error) {
      console.error('❌ Error generating download info:', error);
      throw error;
    }
  }

  async getFileInfo() {
    try {
      // 빌드 파일 정보 수집
      const fs = require('fs');
      const path = require('path');
      
      let filePath;
      if (this.config.platform === 'android') {
        if (this.config.buildType === 'aab') {
          filePath = 'android/app/build/outputs/bundle/release/app-release.aab';
        } else {
          filePath = 'android/app/build/outputs/apk/release/app-release.apk';
        }
      } else {
        filePath = 'ios/build/AppPackaging.ipa';
      }

      const fullPath = path.resolve(process.cwd(), filePath);
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        return {
          fileName: path.basename(fullPath),
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          sizeBytes: stats.size,
          path: filePath
        };
      }
      
      return null;
    } catch (error) {
      console.error('Could not get file info:', error);
      return null;
    }
  }

  async sendNotification(downloadInfo) {
    if (!this.config.s3UploadUrl) {
      console.log('📝 No notification URL provided, skipping...');
      return;
    }

    try {
      console.log('📬 Sending download notification...');
      
      const response = await axios.post(this.config.s3UploadUrl, downloadInfo, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });
      
      console.log('✅ Download notification sent successfully');
      return response.data;
    } catch (error) {
      console.error('⚠️ Failed to send notification:', error.message);
      // 알림 실패는 전체 프로세스를 중단시키지 않음
    }
  }

  formatDownloadMessage(downloadInfo) {
    const message = `
✅ Build Completed Successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Platform: ${downloadInfo.platform.toUpperCase()}
📦 Build Type: ${downloadInfo.buildType.toUpperCase()}
📏 File Size: ${downloadInfo.fileInfo ? downloadInfo.fileInfo.sizeMB + ' MB' : 'Unknown'}
🆔 Build ID: ${downloadInfo.buildId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 Download Instructions:
${downloadInfo.instructions.en.map((step, i) => `   ${step}`).join('\n')}

🔗 Download Link:
   ${downloadInfo.downloadUrl}

💡 Note: GitHub login required to download artifacts
`;
    return message;
  }
}

// 스크립트 실행
if (require.main === module) {
  const generator = new ArtifactUrlGenerator();
  
  generator.generateDownloadInfo()
    .then(async (downloadInfo) => {
      // 콘솔에 다운로드 정보 출력
      console.log(generator.formatDownloadMessage(downloadInfo));
      
      // 환경 변수로 URL 내보내기 (GitHub Actions에서 사용)
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `download_url=${downloadInfo.downloadUrl}\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `artifact_name=${downloadInfo.artifactName}\n`);
      }
      
      // 알림 전송
      await generator.sendNotification(downloadInfo);
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to generate download info:', error);
      process.exit(1);
    });
}

module.exports = ArtifactUrlGenerator;