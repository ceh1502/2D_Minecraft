const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS 설정
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"]
}));

app.use(express.json());

// Socket.io 설정
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 게임 상태 저장
const gameRooms = new Map();
const players = new Map();

// API 라우트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '🎮 Minecraft Game Server Running!',
    timestamp: new Date().toISOString(),
    activeRooms: gameRooms.size,
    activePlayers: players.size
  });
});

// Socket 연결 처리
io.on('connection', (socket) => {
  console.log(`🎮 플레이어 연결: ${socket.id}`);
  
  // 테스트 메시지
  socket.on('test-message', (data) => {
    console.log('📨 클라이언트 메시지:', data);
    socket.emit('test-response', { 
      message: '🎯 서버 응답 성공!', 
      receivedData: data,
      timestamp: new Date().toISOString(),
      playerId: socket.id
    });
  });

  // 방 생성
  socket.on('create-room', (roomId) => {
    console.log(`🏠 방 생성: ${roomId}`);
    
    if (!gameRooms.has(roomId)) {
      const newRoom = {
        roomId: roomId,
        players: [],
        createdAt: new Date().toISOString()
      };
      
      gameRooms.set(roomId, newRoom);
      socket.join(roomId);
      
      socket.emit('room-created', {
        success: true,
        room: newRoom
      });
    } else {
      socket.emit('room-error', {
        message: '이미 존재하는 방입니다.'
      });
    }
  });

  // 방 입장
  socket.on('join-room', (roomId) => {
    console.log(`🚪 방 입장 시도: ${roomId} by ${socket.id}`);
    
    const room = gameRooms.get(roomId);
    if (room) {
      // 플레이어 정보 생성
      const player = {
        playerId: socket.id,
        username: `Player_${socket.id.slice(0, 4)}`,
        position: { x: 25, y: 25 },
        inventory: { wood: 0, stone: 0, iron: 0, coal: 0 },
        joinedAt: new Date().toISOString()
      };

      room.players.push(player);
      players.set(socket.id, { ...player, roomId: roomId });
      
      socket.join(roomId);
      
      // 방에 있는 모든 플레이어에게 알림
      io.to(roomId).emit('player-joined', {
        player: player,
        room: room
      });

      console.log(`✅ ${socket.id} 님이 ${roomId} 방에 입장했습니다.`);
    } else {
      socket.emit('room-error', {
        message: '존재하지 않는 방입니다.'
      });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log(`👋 플레이어 연결 해제: ${socket.id}`);
    
    const player = players.get(socket.id);
    if (player) {
      const room = gameRooms.get(player.roomId);
      if (room) {
        // 방에서 플레이어 제거
        room.players = room.players.filter(p => p.playerId !== socket.id);
        
        // 방이 비었으면 삭제
        if (room.players.length === 0) {
          gameRooms.delete(player.roomId);
          console.log(`🗑️ 빈 방 삭제: ${player.roomId}`);
        } else {
          // 다른 플레이어들에게 알림
          io.to(player.roomId).emit('player-left', {
            playerId: socket.id,
            room: room
          });
        }
      }
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🎮 Minecraft Game Server Started!`);
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log('🚀 ================================');
});
