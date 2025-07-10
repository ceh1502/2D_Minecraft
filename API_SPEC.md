# 🎮 Minecraft Game API 명세서

## 📡 Socket.io 이벤트

### 🔗 연결 관리

#### `connection`
- **설명**: 클라이언트가 서버에 연결
- **자동 발생**: 클라이언트 접속시
- **응답**: `connect` 이벤트

#### `disconnect`
- **설명**: 클라이언트 연결 해제
- **자동 발생**: 클라이언트 종료시

---

### 🧪 테스트 이벤트

#### `test-message`
- **보내는 데이터**: 
```json
"Hello from React!"
```
- **받는 데이터**:
```json
{
  "message": "🎯 서버 응답 성공!",
  "receivedData": "Hello from React!",
  "timestamp": "2025-07-10T10:30:00.000Z",
  "playerId": "socket_id"
}
```

---

### 🏠 방 관리

#### `create-room`
- **보내는 데이터**:
```json
"room_12345"
```
- **성공 응답**:
```json
{
  "success": true,
  "room": {
    "roomId": "room_12345",
    "players": [],
    "createdAt": "2025-07-10T10:30:00.000Z"
  }
}
```
- **실패 응답**:
```json
{
  "message": "이미 존재하는 방입니다."
}
```

#### `join-room`
- **보내는 데이터**:
```json
"room_12345"
```
- **성공 응답** (방의 모든 플레이어에게):
```json
{
  "player": {
    "playerId": "socket_id",
    "username": "Player_1234",
    "position": { "x": 25, "y": 25 },
    "inventory": { "wood": 0, "stone": 0, "iron": 0, "coal": 0 },
    "joinedAt": "2025-07-10T10:30:00.000Z"
  },
  "room": {
    "roomId": "room_12345",
    "players": ["플레이어 배열"]
  }
}
```

---

### 🎮 게임 이벤트 (다음에 구현 예정)

#### `move-player`
- **보내는 데이터**:
```json
{ "direction": "up" | "down" | "left" | "right" }
```

#### `collect-resource`
- **보내는 데이터**:
```json
{ "x": 10, "y": 15 }
```

#### `place-building`
- **보내는 데이터**:
```json
{ "type": "fence", "x": 10, "y": 15 }
```

---

## 🌐 REST API

### `GET /api/health`
- **설명**: 서버 상태 확인
- **응답**:
```json
{
  "status": "OK",
  "message": "🎮 Minecraft Game Server Running!",
  "timestamp": "2025-07-10T10:30:00.000Z",
  "activeRooms": 0,
  "activePlayers": 0
}
```

---

## 📱 프론트엔드 개발 가이드

### Socket.io 연결
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5001');

// 연결 확인
socket.on('connect', () => {
  console.log('서버 연결됨:', socket.id);
});

// 테스트 메시지 보내기
socket.emit('test-message', 'Hello Server!');

// 응답 받기
socket.on('test-response', (data) => {
  console.log('서버 응답:', data);
});
```

### 방 생성/입장
```javascript
// 방 생성
socket.emit('create-room', 'my_room_123');

// 방 입장
socket.emit('join-room', 'my_room_123');

// 입장 성공 처리
socket.on('player-joined', (data) => {
  console.log('플레이어 입장:', data);
});
```
```

---

## 🤝 **친구에게 보낼 메시지**

```
🎮 백엔드 서버 완성! 프론트엔드 시작 가능!

📂 GitHub: https://github.com/ceh1502/2D_Minecraft
🔄 브랜치: develop

🚀 프론트엔드 시작 가이드:
1. git clone https://github.com/ceh1502/2D_Minecraft.git
2. cd 2D_Minecraft/frontend
3. npx create-react-app .
4. npm install socket.io-client

🔗 서버 주소: http://localhost:5001
📖 API 명세서: 프로젝트 루트의 API_SPEC.md 확인

✅ 현재 작동하는 기능:
- Socket.io 연결
- test-message 테스트
- 방 생성/입장
- 헬스체크 API

📞 연결 테스트하고 알려주세요!