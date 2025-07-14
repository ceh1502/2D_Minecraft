#!/bin/bash

# 🚀 minecrafton.store 서버 설정 스크립트

echo "🎮 Minecraft 2D Game 서버 설정 시작..."

# Node.js 서버 상태 확인
echo "📋 Node.js 서버 상태 확인..."
if ! pgrep -f "node server.js" > /dev/null; then
    echo "❌ Node.js 서버가 실행되지 않고 있습니다!"
    echo "다음 명령어로 서버를 시작하세요:"
    echo "cd /path/to/backend && node server.js &"
    exit 1
else
    echo "✅ Node.js 서버 실행 중"
fi

# 포트 5001 확인
echo "📋 포트 5001 확인..."
if ! netstat -tuln | grep :5001 > /dev/null; then
    echo "❌ 포트 5001이 열려있지 않습니다!"
    exit 1
else
    echo "✅ 포트 5001 정상"
fi

# Nginx 설정 확인
echo "📋 Nginx 설정 확인..."
if ! nginx -t 2>/dev/null; then
    echo "❌ Nginx 설정에 오류가 있습니다!"
    echo "다음 설정 파일을 확인하세요:"
    echo "- /etc/nginx/sites-available/minecrafton.store"
    echo "- /etc/nginx/sites-enabled/minecrafton.store"
    exit 1
else
    echo "✅ Nginx 설정 정상"
fi

# API 엔드포인트 테스트
echo "📋 API 엔드포인트 테스트..."
if curl -sf http://localhost:5001/api/health > /dev/null; then
    echo "✅ API 엔드포인트 정상"
else
    echo "❌ API 엔드포인트 응답 없음"
    exit 1
fi

# 프론트엔드 빌드 파일 확인
echo "📋 프론트엔드 빌드 파일 확인..."
if [ ! -f "/var/www/minecrafton.store/index.html" ]; then
    echo "❌ 프론트엔드 빌드 파일이 없습니다!"
    echo "다음 명령어로 빌드하고 배포하세요:"
    echo "cd /path/to/Front && npm run build"
    echo "sudo cp -r build/* /var/www/minecrafton.store/"
    exit 1
else
    echo "✅ 프론트엔드 빌드 파일 존재"
fi

echo ""
echo "🎯 설정 완료! 다음을 확인하세요:"
echo "1. 🌐 도메인 접속: http://minecrafton.store"
echo "2. 🔗 API 테스트: http://minecrafton.store/api/health"
echo "3. 🎮 게임 실행: 게스트 로그인으로 테스트"
echo ""
echo "🐛 문제 해결:"
echo "- 500 에러: sudo tail -f /var/log/nginx/minecrafton.store.error.log"
echo "- API 에러: 백엔드 로그 확인"
echo "- 연결 에러: 방화벽 설정 확인 (포트 80, 443, 5001)"