#!/bin/bash

# 🚀 서버 배포 스크립트
# 이 스크립트는 서버에서 실행해야 합니다.

echo "🔧 Minecraft 2D Game 서버 배포 시작..."

# 1. 빌드된 파일을 서버로 복사
echo "📁 프론트엔드 빌드 파일 복사 중..."
sudo rm -rf /var/www/minecrafton.store/*
sudo cp -r Front/build/* /var/www/minecrafton.store/
sudo chown -R www-data:www-data /var/www/minecrafton.store/
sudo chmod -R 755 /var/www/minecrafton.store/

# 2. Nginx 설정 파일 적용
echo "🔧 Nginx 설정 파일 적용 중..."
sudo cp nginx-minecrafton.conf /etc/nginx/sites-available/minecrafton.store
sudo ln -sf /etc/nginx/sites-available/minecrafton.store /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 3. Nginx 설정 테스트
echo "🧪 Nginx 설정 테스트 중..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 설정이 유효합니다."
    
    # 4. Nginx 재시작
    echo "🔄 Nginx 재시작 중..."
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo "✅ Nginx 재시작 완료!"
else
    echo "❌ Nginx 설정에 오류가 있습니다. 배포를 중단합니다."
    exit 1
fi

# 5. 백엔드 서비스 설정
echo "🔧 백엔드 서비스 설정 중..."

# PM2로 백엔드 실행
if command -v pm2 &> /dev/null; then
    echo "📦 PM2로 백엔드 실행 중..."
    pm2 stop minecraft-backend 2>/dev/null || true
    pm2 delete minecraft-backend 2>/dev/null || true
    pm2 start backend/server.js --name minecraft-backend
    pm2 startup
    pm2 save
else
    echo "⚠️  PM2가 설치되어 있지 않습니다. 백엔드를 수동으로 실행해야 합니다."
    echo "   다음 명령어를 실행하세요:"
    echo "   cd backend && nohup node server.js > server.log 2>&1 &"
fi

# 6. 방화벽 설정
echo "🔥 방화벽 설정 확인 중..."
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

# 7. SSL 인증서 설정 안내
echo ""
echo "🔐 SSL 인증서 설정이 필요합니다:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d minecrafton.store -d www.minecrafton.store"
echo ""

# 8. 서비스 상태 확인
echo "📊 서비스 상태 확인:"
echo "   - Nginx: $(sudo systemctl is-active nginx)"
echo "   - 백엔드: $(ps aux | grep -v grep | grep 'node server.js' | wc -l) 프로세스 실행 중"
echo ""

echo "🎯 배포 완료!"
echo "🌐 웹사이트: https://minecrafton.store"
echo "📡 API 상태: https://minecrafton.store/api/health"
echo ""
echo "🔍 문제 해결을 위한 로그 위치:"
echo "   - Nginx: /var/log/nginx/minecrafton.store.error.log"
echo "   - 백엔드: ./backend/server.log"