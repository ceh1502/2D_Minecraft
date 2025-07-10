const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const MapGenerator = require('./utils/mapGenerator'); // ← 맨 위에!
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

  // 방 생성 (맵 생성 포함)
  socket.on('create-room', (roomId) => {
    console.log(`🏠 방 생성: ${roomId}`);
    
    if (!gameRooms.has(roomId)) {
      // 맵 생성
      const mapGenerator = new MapGenerator(50, 50);
      const gameMap = mapGenerator.generateMap();
      
      const newRoom = {
        roomId: roomId,
        players: [],
        map: gameMap,  // ← 맵 추가!
        createdAt: new Date().toISOString()
      };
      
      gameRooms.set(roomId, newRoom);
      socket.join(roomId);
      
      socket.emit('room-created', {
        success: true,
        room: newRoom
      });
      
      console.log(`✅ 방 생성 완료: ${roomId} (맵 크기: ${gameMap.width}x${gameMap.height})`);
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

  // 플레이어 이동
  socket.on('move-player', (direction) => {
    console.log(`🚶 플레이어 이동: ${socket.id} → ${direction}`);
    
    const player = players.get(socket.id);
    if (!player) return;
    
    const room = gameRooms.get(player.roomId);
    if (!room) return;
    
    // 새 위치 계산
    const newPosition = calculateNewPosition(player.position, direction);
    
    // 맵 경계 체크
    if (isValidPosition(newPosition, room.map)) {
      // 플레이어 위치 업데이트
      player.position = newPosition;
      
      // 방의 플레이어 정보도 업데이트
      const roomPlayer = room.players.find(p => p.playerId === socket.id);
      if (roomPlayer) {
        roomPlayer.position = newPosition;
      }
      
      // 방의 모든 플레이어에게 이동 알림
      io.to(player.roomId).emit('player-moved', {
        playerId: socket.id,
        position: newPosition,
        timestamp: new Date().toISOString()
      });
    } else {
      // 잘못된 이동 시 에러 전송
      socket.emit('move-error', {
        message: '이동할 수 없는 위치입니다.',
        currentPosition: player.position
      });
    }
  });

  // 맵 정보 요청
  socket.on('request-map', () => {
    const player = players.get(socket.id);
    if (!player) return;
    
    const room = gameRooms.get(player.roomId);
    if (!room) return;
    
    socket.emit('map-data', {
      map: room.map,
      playerPosition: player.position,
      allPlayers: room.players.map(p => ({
        playerId: p.playerId,
        username: p.username,
        position: p.position
      }))
    });
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

// 유틸 함수들 (io.on() 밖에!)
function calculateNewPosition(currentPos, direction) {
  const { x, y } = currentPos;
  
  switch (direction) {
    case 'up': return { x, y: y - 1 };
    case 'down': return { x, y: y + 1 };
    case 'left': return { x: x - 1, y };
    case 'right': return { x: x + 1, y };
    default: return currentPos;
  }
}

function isValidPosition(position, map) {
  const { x, y } = position;
  
  // 맵 경계 체크
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
    return false;
  }
  
  return true; // 일단 모든 위치 이동 가능
}

const PORT = process.env.PORT || 5001; // ← 5001로!
server.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🎮 Minecraft Game Server Started!`);
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log('🚀 ================================');
});