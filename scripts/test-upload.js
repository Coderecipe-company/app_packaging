#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
  console.log('🧪 Testing Refrigerator upload with small file...');
  
  const testFile = '/tmp/test.txt';
  const formData = new FormData();
  
  // Test with unlimitedKey
  formData.append('unlimitedKey', 'UNLIMITED2024');
  formData.append('bucket', 'withcookie-bucket');
  formData.append('path', 'app-builds');
  formData.append('file', fs.createReadStream(testFile), 'test.txt');
  
  try {
    const response = await axios.post('https://refrigerator.logipasta.com/v1/file', formData, {
      headers: {
        ...formData.getHeaders(),
        'Access-Control-Allow-Origin': '*',
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    console.log('✅ Upload successful!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.status, error.response?.statusText);
    console.error('Error details:', error.response?.data);
  }
}

testUpload();