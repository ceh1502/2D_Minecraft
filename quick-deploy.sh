#!/bin/bash

echo "🚀 OAuth 수정사항 빠른 배포 스크립트"
echo "======================================"

# 서버 연결 정보
SERVER="ubuntu@minecrafton.store"
SERVER_PATH="/opt/minecraft2d"

echo "📥 서버에서 최신 코드 받기..."
ssh $SERVER << 'EOF'
cd /opt/minecraft2d
git fetch origin
git checkout oauth-fix
git pull origin oauth-fix

echo "🔨 프론트엔드 빌드..."
cd frontend
npm run build

echo "🔄 서비스 재시작..."
sudo systemctl restart minecraft2d
sudo systemctl restart nginx

echo "✅ 배포 완료!"
echo "🌐 https://minecrafton.store 에서 테스트 가능합니다"
EOF

echo "✅ 배포 스크립트 실행 완료!"
echo "🌐 https://minecrafton.store 에서 테스트해보세요"
echo ""
echo "🔍 테스트 방법:"
echo "1. Google 로그인 시도"
echo "2. 실패 후 새로고침"
echo "3. 이제 맵 로딩 중이 아닌 로그인 화면이 나와야 합니다"