# 🚀 minecrafton.store 배포 가이드

## 📋 현재 상황
- **문제**: minecrafton.store 접속 시 "500 Internal Server Error nginx/1.18.0 (Ubuntu)" 발생
- **원인**: 서버에 nginx 설정이 없거나 백엔드 서버가 실행되지 않음
- **해결**: 아래 단계별 배포 가이드를 따라 진행

## 🔧 1단계: 서버 기본 설정 (EC2에서 실행)

```bash
# production-setup.sh 스크립트를 서버에 업로드하고 실행
chmod +x production-setup.sh
sudo ./production-setup.sh
```

## 📁 2단계: 프로젝트 파일 업로드

### 백엔드 파일 업로드
```bash
# 로컬에서 서버로 백엔드 파일 업로드
scp -r backend/ ubuntu@your-server-ip:/opt/minecraft2d/
```

### 프론트엔드 빌드 파일 업로드
```bash
# 로컬에서 서버로 프론트엔드 빌드 파일 업로드
scp -r Front/build/* ubuntu@your-server-ip:/var/www/minecrafton.store/
```

## 🔧 3단계: 서버에서 환경 설정

### 환경변수 설정
```bash
# 서버에 SSH 접속 후
cd /opt/minecraft2d/backend

# .env 파일 생성
cat > .env << 'EOF'
PORT=5001
NODE_ENV=production

# JWT 설정
JWT_SECRET=minecraft-game-jwt-secret-key-2024
SESSION_SECRET=minecraft-session-secret-key-2024

# Google OAuth 설정
GOOGLE_CLIENT_ID=988669439007-ltc413t8h5cp460ct50rnd5dmkhcvdeq.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# OAuth 콜백 URL 설정 (프로덕션)
OAUTH_CALLBACK_URL=https://minecrafton.store/auth/google/callback

# 데이터베이스 설정
DATABASE_URL=sqlite:database.sqlite

# CORS 설정
ALLOWED_ORIGINS=https://minecrafton.store,https://www.minecrafton.store

# 도메인 설정
DOMAIN=minecrafton.store
EOF
```

### 의존성 설치
```bash
# Node.js 의존성 설치
npm install
```

## 🚀 4단계: 서비스 시작

```bash
# systemd 서비스 시작
sudo systemctl start minecraft2d
sudo systemctl enable minecraft2d

# 서비스 상태 확인
sudo systemctl status minecraft2d
```

## 🔍 5단계: 로그 확인 및 디버깅

### 백엔드 로그 확인
```bash
# 실시간 로그 확인
sudo journalctl -u minecraft2d -f

# 최근 로그 확인
sudo journalctl -u minecraft2d -n 50
```

### Nginx 로그 확인
```bash
# 에러 로그 확인
sudo tail -f /var/log/nginx/minecrafton.store.error.log

# 액세스 로그 확인
sudo tail -f /var/log/nginx/minecrafton.store.access.log
```

### 포트 및 프로세스 확인
```bash
# 5001 포트 확인
sudo netstat -tlnp | grep 5001

# Node.js 프로세스 확인
ps aux | grep node
```

## 🔧 6단계: 문제 해결

### 만약 500 오류가 계속 발생한다면:

1. **nginx 설정 확인**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

2. **백엔드 서버 수동 실행 테스트**
```bash
cd /opt/minecraft2d/backend
node server.js
```

3. **방화벽 확인**
```bash
sudo ufw status
sudo ufw allow 5001
```

4. **Google OAuth 설정 확인**
   - Google Cloud Console에서 OAuth 설정 확인
   - 승인된 리디렉션 URI에 `https://minecrafton.store/auth/google/callback` 추가

## 📝 7단계: 테스트

1. **기본 접속 테스트**
   - https://minecrafton.store 접속
   - 로딩 화면이 나타나는지 확인

2. **API 테스트**
   - https://minecrafton.store/api/health 접속
   - JSON 응답이 나오는지 확인

3. **게스트 로그인 테스트**
   - 게스트로 로그인 시도
   - 게임 화면이 정상적으로 나타나는지 확인

## 🎯 성공 확인

모든 단계가 완료되면:
- ✅ https://minecrafton.store에서 게임 로딩 화면 표시
- ✅ 게스트 로그인 정상 작동
- ✅ Google OAuth 로그인 정상 작동
- ✅ 랭킹 시스템 정상 작동
- ✅ 게임 플레이 가능

## 🚨 긴급 문제 해결

만약 여전히 500 오류가 발생한다면:

```bash
# 1. 서비스 재시작
sudo systemctl restart minecraft2d
sudo systemctl restart nginx

# 2. 로그 실시간 확인
sudo journalctl -u minecraft2d -f

# 3. 수동 백엔드 실행으로 오류 확인
cd /opt/minecraft2d/backend
node server.js
```

이 가이드를 따라 진행하면 minecrafton.store의 500 오류가 해결됩니다!