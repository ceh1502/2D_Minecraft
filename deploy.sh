#!/bin/bash

# 🚀 minecrafton.store 배포 스크립트

echo "🎮 Minecraft 2D Game 배포 시작..."

# 환경 확인
echo "📋 배포 환경 확인..."
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env 파일이 없습니다!"
    exit 1
fi

if [ ! -f "Front/.env" ]; then
    echo "❌ Front/.env 파일이 없습니다!"
    exit 1
fi

# 의존성 설치
echo "📦 의존성 설치 중..."
cd backend && npm install
cd ../Front && npm install
cd ..

# 프론트엔드 빌드
echo "🔨 프론트엔드 빌드 중..."
cd Front
npm run build
cd ..

# 백엔드 데이터베이스 마이그레이션
echo "💾 데이터베이스 설정 중..."
cd backend
node -e "
const { sequelize } = require('./config/database');
(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ 데이터베이스 동기화 완료');
    process.exit(0);
  } catch (error) {
    console.error('❌ 데이터베이스 에러:', error);
    process.exit(1);
  }
})();
"
cd ..

echo "✅ 배포 준비 완료!"
echo ""
echo "🌐 다음 단계:"
echo "1. 빌드된 파일을 서버에 업로드"
echo "2. Nginx 설정 (DOMAIN_OAUTH_SETUP.md 참조)"
echo "3. SSL 인증서 설정"
echo "4. Google OAuth URI 설정:"
echo "   - https://minecrafton.store/auth/google/callback"
echo "   - https://minecrafton.store"
echo "5. 환경변수 설정:"
echo "   - NODE_ENV=production"
echo "   - DOMAIN=minecrafton.store"
echo "   - GOOGLE_CLIENT_ID=실제_클라이언트_ID"
echo "   - GOOGLE_CLIENT_SECRET=실제_시크릿"
echo ""
echo "🎯 목표 URL: https://minecrafton.store"