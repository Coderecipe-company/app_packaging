#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function generateDefaultIcon() {
  const sharp = require('sharp');
  
  // 기본 아이콘 생성 (파란색 배경에 흰색 W)
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#4A90E2" rx="100"/>
      <text x="256" y="340" font-family="Arial, sans-serif" font-size="280" font-weight="bold" text-anchor="middle" fill="white">W</text>
    </svg>
  `;
  
  const iconBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
  
  // Android 아이콘 크기
  const androidSizes = [
    { size: 48, density: 'mdpi' },
    { size: 72, density: 'hdpi' },
    { size: 96, density: 'xhdpi' },
    { size: 144, density: 'xxhdpi' },
    { size: 192, density: 'xxxhdpi' }
  ];
  
  console.log('🎨 Generating default Android icons...');
  
  for (const { size, density } of androidSizes) {
    const dir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
    
    // 디렉토리 생성
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 정사각형 아이콘
    const squarePath = path.join(dir, 'ic_launcher.png');
    await sharp(iconBuffer)
      .resize(size, size)
      .png()
      .toFile(squarePath);
    
    // 원형 아이콘 (동일한 이미지 사용)
    const roundPath = path.join(dir, 'ic_launcher_round.png');
    
    // 원형 마스크 적용
    const roundedSvg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="circle">
            <circle cx="${size/2}" cy="${size/2}" r="${size/2}"/>
          </clipPath>
        </defs>
        <g clip-path="url(#circle)">
          <rect width="${size}" height="${size}" fill="#4A90E2"/>
          <text x="${size/2}" y="${size*0.66}" font-family="Arial, sans-serif" font-size="${size*0.55}" font-weight="bold" text-anchor="middle" fill="white">W</text>
        </g>
      </svg>
    `;
    
    await sharp(Buffer.from(roundedSvg))
      .png()
      .toFile(roundPath);
    
    console.log(`  ✅ Generated ${density} (${size}x${size})`);
  }
  
  console.log('✨ Default icons generated successfully!');
}

// 스크립트 실행
if (require.main === module) {
  generateDefaultIcon().catch(console.error);
}

module.exports = generateDefaultIcon;