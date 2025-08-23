#!/usr/bin/env node

const axios = require('axios');

async function triggerBuild() {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.log('Please set it with: export GITHUB_TOKEN=your_github_personal_access_token');
    process.exit(1);
  }

  const payload = {
    event_type: 'build_mobile_app',
    client_payload: {
      build_id: `test-build-${Date.now()}`,
      app_name: 'TestApp',
      package_name: 'com.test.app',
      platform: 'android',
      build_type: 'apk',
      base_url: 'https://withcookie.com',
      version_name: '1.0.0',
      version_code: '1'
    }
  };

  try {
    console.log('🚀 Triggering GitHub Actions build...');
    console.log('📋 Build configuration:', JSON.stringify(payload.client_payload, null, 2));
    
    const response = await axios.post(
      'https://api.github.com/repos/Coderecipe-company/app_packaging/dispatches',
      payload,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 204) {
      console.log('✅ Build triggered successfully!');
      console.log('🔗 Check progress at: https://github.com/Coderecipe-company/app_packaging/actions');
      console.log(`📝 Build ID: ${payload.client_payload.build_id}`);
    } else {
      console.log('⚠️ Unexpected response:', response.status, response.data);
    }
  } catch (error) {
    console.error('❌ Failed to trigger build:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('🔑 Please check your GitHub token has the "repo" scope');
    }
  }
}

triggerBuild();