#!/bin/bash

# 🚀 minecrafton.store 프로덕션 배포 스크립트
# 이 스크립트를 서버에서 실행하세요

set -e

echo "🎮 minecrafton.store 프로덕션 배포 시작..."

# 변수 설정
DOMAIN="minecrafton.store"
WEB_ROOT="/var/www/${DOMAIN}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
PROJECT_DIR="/opt/minecraft2d"  # 서버에서 프로젝트가 위치할 경로

# 1. 시스템 패키지 업데이트
echo "📦 시스템 패키지 업데이트..."
sudo apt update
sudo apt install -y nginx nodejs npm curl

# 2. 웹 루트 디렉토리 생성
echo "📁 웹 루트 디렉토리 생성..."
sudo mkdir -p ${WEB_ROOT}
sudo chown -R www-data:www-data ${WEB_ROOT}

# 3. Nginx 설정 파일 생성
echo "⚙️ Nginx 설정 파일 생성..."
sudo tee ${NGINX_AVAILABLE} > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    root ${WEB_ROOT};
    index index.html;
    
    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # React 앱 서빙 (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # API 프록시
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # OAuth 프록시
    location /auth/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Socket.IO 프록시
    location /socket.io/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # 정적 파일 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    
    # 로그
    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log /var/log/nginx/${DOMAIN}.error.log;
}
EOF

# 4. Nginx 설정 활성화
echo "🔗 Nginx 설정 활성화..."
sudo ln -sf ${NGINX_AVAILABLE} ${NGINX_ENABLED}

# 5. Nginx 설정 테스트
echo "🔍 Nginx 설정 테스트..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 설정 테스트 통과"
    sudo systemctl reload nginx
else
    echo "❌ Nginx 설정 오류"
    exit 1
fi

# 6. 프로젝트 디렉토리 생성
echo "📁 프로젝트 디렉토리 생성..."
sudo mkdir -p ${PROJECT_DIR}
sudo chown -R \$USER:\$USER ${PROJECT_DIR}

# 7. 서비스 파일 생성 (systemd)
echo "🔧 systemd 서비스 파일 생성..."
sudo tee /etc/systemd/system/minecraft2d.service > /dev/null <<EOF
[Unit]
Description=Minecraft 2D Game Server
After=network.target

[Service]
Type=simple
User=\$USER
WorkingDirectory=${PROJECT_DIR}/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5001

[Install]
WantedBy=multi-user.target
EOF

# 8. systemd 서비스 활성화
echo "🔄 systemd 서비스 활성화..."
sudo systemctl daemon-reload
sudo systemctl enable minecraft2d

echo ""
echo "🎯 기본 설정 완료! 이제 다음 단계를 진행하세요:"
echo ""
echo "1. 📁 프로젝트 파일 업로드:"
echo "   scp -r /path/to/project/backend user@server:${PROJECT_DIR}/"
echo "   scp -r /path/to/project/Front/build/* user@server:${WEB_ROOT}/"
echo ""
echo "2. 🔧 환경변수 설정:"
echo "   cd ${PROJECT_DIR}/backend"
echo "   cp .env.example .env"
echo "   nano .env  # 실제 값으로 수정"
echo ""
echo "3. 📦 의존성 설치:"
echo "   cd ${PROJECT_DIR}/backend"
echo "   npm install"
echo ""
echo "4. 🚀 서비스 시작:"
echo "   sudo systemctl start minecraft2d"
echo "   sudo systemctl status minecraft2d"
echo ""
echo "5. 🔍 로그 확인:"
echo "   sudo journalctl -u minecraft2d -f"
echo "   sudo tail -f /var/log/nginx/${DOMAIN}.error.log"
echo ""
echo "✅ 완료 후 https://${DOMAIN} 에서 게임 테스트!"
EOF