const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const MapGenerator = require('./utils/mapGenerator');
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
        map: gameMap,
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
        inventory: { 
          wood: 0, 
          stone: 0, 
          iron: 0, 
          diamond: 0
        },
        selectedSlot: 0,
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

  // 인벤토리 슬롯 변경
  socket.on('change-hotbar-slot', (slotNumber) => {
    console.log(`🎒 인벤토리 슬롯 변경: ${socket.id} → ${slotNumber}`);
    
    const player = players.get(socket.id);
    if (!player || slotNumber < 0 || slotNumber > 4) return;
    
    player.selectedSlot = slotNumber;
    
    io.to(player.roomId).emit('player-hotbar-changed', {
      playerId: socket.id,
      selectedSlot: slotNumber
    });
  });

    socket.on('mine-block', (data) => {
      console.log(`⛏️ 블록 채굴: ${socket.id} → (${data.x}, ${data.y})`);
      
      const player = players.get(socket.id);
      if (!player) return;
      
      const room = gameRooms.get(player.roomId);
      if (!room) return;
      
      // 블록 정보 확인
      const block = room.map.cells[data.y][data.x];
      if (!block || block.type === 'grass') return;
      
      // 🔨 새로운 도구 타입 기반 효율성
      const getToolEfficiency = (toolType, blockType) => {
        const efficiencyMap = {
          hand: { tree: 1, stone: 1, iron_ore: 0, diamond: 0 },
          pickaxe: { tree: 1, stone: 3, iron_ore: 3, diamond: 2 },
          axe: { tree: 3, stone: 1, iron_ore: 0, diamond: 0 },
          sword: { tree: 1, stone: 1, iron_ore: 1, diamond: 0 }
        };
        
        return efficiencyMap[toolType]?.[blockType] || 0;
      };
      
      // 현재 장착된 도구 타입
      const toolType = data.toolType || 'hand'; // 기본값은 맨손
      const damage = getToolEfficiency(toolType, block.type);
      
      console.log(`🔨 도구: ${toolType}, 블록: ${block.type}, 데미지: ${damage}`);
      
      // 채굴 불가능한 경우
      if (damage === 0) {
        console.log(`❌ ${block.type}은(는) ${toolType}으로 채굴할 수 없음`);
        
        socket.emit('mining-error', {
          message: `${block.type}은(는) 현재 도구로 채굴할 수 없습니다!`,
          blockType: block.type,
          toolType: toolType
        });
        return;
      }
      
      // 내구도 감소
      block.currentDurability = Math.max(0, block.currentDurability - damage);
      
      // 진행률 계산
      block.miningProgress = Math.min(100, 
        ((block.maxDurability - block.currentDurability) / block.maxDurability) * 100
      );
      
      console.log(`🔨 ${block.type} 채굴: ${block.currentDurability}/${block.maxDurability} (${Math.round(block.miningProgress)}%) [데미지: ${damage}]`);
      
      if (block.currentDurability <= 0) {
        // 완전히 파괴됨 - 자원 획득
        const resource = getResourceFromBlock(block.type);
        if (resource) {
          const dropAmount = {
            tree: Math.floor(Math.random() * 3) + 2,
            stone: Math.floor(Math.random() * 2) + 2,
            iron_ore: 1,
            diamond: 1
          };
          
          const amount = dropAmount[block.type] || 1;
          player.inventory[resource] = (player.inventory[resource] || 0) + amount;
          
          console.log(`✅ ${resource} ${amount}개 획득! (총 ${player.inventory[resource]}개)`);
        }
        
        // 잔디로 변경
        room.map.cells[data.y][data.x] = {
          type: 'grass',
          maxDurability: 1,
          currentDurability: 1,
          miningProgress: 0,
          resources: 0
        };
      }
      
      // 모든 플레이어에게 업데이트 전송
      io.to(player.roomId).emit('block-updated', {
        x: data.x,
        y: data.y,
        block: room.map.cells[data.y][data.x],
        playerId: socket.id,
        newInventory: player.inventory,
        damage: damage,
        toolType: toolType
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

// 유틸 함수들
function getResourceFromBlock(blockType) {
  const resourceMap = {
    tree: 'wood',
    stone: 'stone', 
    iron_ore: 'iron',
    diamond: 'diamond'
  };
  return resourceMap[blockType];
}

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
  
  // 🚧 새로운 블록 충돌 체크
  const cell = map.cells[y][x];
  if (!cell) return false;
  
  // 고체 블록들 (이동 불가)
  const solidBlocks = ['stone', 'tree', 'iron_ore', 'diamond'];
  
  if (solidBlocks.includes(cell.type)) {
    console.log(`🚧 이동 차단: ${cell.type} 블록 (${x}, ${y})`);
    return false;
  }
  
  // 잔디만 이동 가능
  return cell.type === 'grass';
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🎮 Minecraft Game Server Started!`);
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log('🚀 ================================');
});