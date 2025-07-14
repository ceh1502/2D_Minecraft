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
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());

// Socket.io 설정
const io = socketIo(server, {
  cors: {
    origin: "*",
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

// 랜덤 플레이어 색상 함수
function getRandomPlayerColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

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
    console.log('=== CREATE-ROOM 디버깅 ===');
    console.log('방 생성 요청:', roomId);
    console.log('현재 방들:', Array.from(gameRooms.keys()));
    
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
      
      console.log(`✅ 방 생성 완료: ${roomId}`);
      console.log('업데이트된 방 목록:', Array.from(gameRooms.keys()));
      
      socket.emit('room-created', {
        success: true,
        room: newRoom
      });
    } else {
      console.log('⚠️ 이미 존재하는 방:', roomId);
      socket.emit('room-error', {
        message: '이미 존재하는 방입니다.'
      });
    }
  });

  // 🔧 수정된 방 입장 처리
  socket.on('join-room', (data) => {
    console.log('=== JOIN-ROOM 디버깅 ===');
    console.log('받은 데이터:', data);
    console.log('데이터 타입:', typeof data);
    console.log('JSON 문자열:', JSON.stringify(data));
    console.log('========================');
    
    let roomId, username;
    
    // 데이터 타입에 따라 처리
    if (typeof data === 'string') {
      roomId = data;
      username = `Player_${socket.id.slice(0, 4)}`;
      console.log('📝 문자열 모드:', roomId, username);
    } else if (typeof data === 'object' && data !== null) {
      roomId = data.roomId;
      username = data.username || `Player_${socket.id.slice(0, 4)}`;
      console.log('📝 객체 모드:', roomId, username);
    } else {
      console.log('❌ 알 수 없는 데이터:', data);
      return;
    }
    
    console.log(`🚪 최종 파싱: 방=${roomId}, 유저=${username}`);
    
    const room = gameRooms.get(roomId);
    console.log('🏠 방 존재 여부:', !!room);
    
    if (room) {
      // 플레이어 정보 생성 (닉네임 포함)
      const player = {
        playerId: socket.id,
        username: username,
        position: { x: 25, y: 25 },
        color: getRandomPlayerColor(),
        inventory: { 
          tree: 0,  // wood → tree 수정
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
      
      console.log(`✅ ${username} (${socket.id})님이 ${roomId} 방에 입장했습니다.`);
      console.log('현재 방 플레이어 수:', room.players.length);
      
      // 새 플레이어 입장 알림 (모든 플레이어에게)
      io.to(roomId).emit('player-joined', {
        player: player,
        room: room
      });

    } else {
      console.log('❌ 방을 찾을 수 없음:', roomId);
      console.log('📋 현재 방 목록:', Array.from(gameRooms.keys()));
      
      socket.emit('room-error', {
        message: '존재하지 않는 방입니다.'
      });
    }
  });

// 플레이어 이동
socket.on('move-player', (direction) => {
  console.log(`🚶 플레이어 이동: ${socket.id} → ${direction}`);
  
  const player = players.get(socket.id);
  if (!player) {
    console.log(`❌ 플레이어를 찾을 수 없음: ${socket.id}`);
    return;
  }
  
  const room = gameRooms.get(player.roomId);
  if (!room) {
    console.log(`❌ 방을 찾을 수 없음: ${player.roomId}`);
    return;
  }
  
  // 새 위치 계산
  const newPosition = calculateNewPosition(player.position, direction);
  
  // 맵 경계 체크
  if (isValidPosition(newPosition, room.map)) {
    // 🎯 중요: 이동한 플레이어의 정보만 업데이트
    player.position = newPosition;
    
    // 방의 플레이어 정보도 업데이트
    const roomPlayer = room.players.find(p => p.playerId === socket.id);
    if (roomPlayer) {
      roomPlayer.position = newPosition;
    }
    
    console.log(`✅ ${player.username} 이동: (${newPosition.x}, ${newPosition.y})`);
    
    // 🎯 중요: 이동한 플레이어 ID 명시해서 전송
    io.to(player.roomId).emit('player-moved', {
      playerId: socket.id,          // ← 이동한 플레이어 ID
      username: player.username,    // ← 플레이어 이름 추가
      position: newPosition,
      timestamp: new Date().toISOString()
    });
  } else {
    // 잘못된 이동 시 본인에게만 에러 전송
    socket.emit('move-error', {
      message: '이동할 수 없는 위치입니다.',
      currentPosition: player.position
    });
  }
});

  // 맵 정보 요청
  socket.on('request-map', () => {
    console.log(`🗺️ 맵 정보 요청: ${socket.id}`);
    
    const player = players.get(socket.id);
    if (!player) {
      console.log('❌ 플레이어를 찾을 수 없음:', socket.id);
      return;
    }
    
    const room = gameRooms.get(player.roomId);
    if (!room) {
      console.log('❌ 방을 찾을 수 없음:', player.roomId);
      return;
    }
    
    console.log(`✅ 맵 정보 전송: ${player.roomId} → ${socket.id}`);
    
    socket.emit('map-data', {
      map: room.map,
      playerPosition: player.position,
      allPlayers: room.players.map(p => ({
        playerId: p.playerId,
        username: p.username,
        position: p.position,
        color: p.color
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

  // 🔨 수정된 블록 채굴 시스템
  socket.on('mine-block', (data) => {
    console.log(`⛏️ 블록 채굴: ${socket.id} → (${data.x}, ${data.y})`);
    
    const player = players.get(socket.id);
    if (!player) return;
    
    const room = gameRooms.get(player.roomId);
    if (!room) return;
    
    // 블록 정보 확인
    const block = room.map.cells[data.y][data.x];
    if (!block || block.type === 'grass') return;
    
    // 🔨 새로운 도구 타입 기반 효율성 (세분화)
    const getToolEfficiency = (toolType, blockType) => {
      const efficiencyMap = {
        // 맨손
        hand: { tree: 1, stone: 1, iron_ore: 0, diamond: 0 },
        
        // 곡괭이류
        wooden_pickaxe: { tree: 1, stone: 2, iron_ore: 1, diamond: 0 },
        stone_pickaxe: { tree: 1, stone: 4, iron_ore: 2, diamond: 1 },
        iron_pickaxe: { tree: 1, stone: 6, iron_ore: 6, diamond: 4 },
        diamond_pickaxe: { tree: 1, stone: 12, iron_ore: 12, diamond: 8 },
        
        // 도끼류
        iron_axe: { tree: 6, stone: 1, iron_ore: 0, diamond: 0 },
        diamond_axe: { tree: 12, stone: 1, iron_ore: 0, diamond: 0 },
        
        // 검류 (기본값과 동일)
        iron_sword: { tree: 1, stone: 1, iron_ore: 1, diamond: 0 },
        diamond_sword: { tree: 1, stone: 1, iron_ore: 1, diamond: 0 }
      };
      
      return efficiencyMap[toolType]?.[blockType] || 0;
    };
    
    const toolType = data.toolType || 'hand';
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

  // 거래 아이템
  socket.on('trade-item', (data) => {
    console.log(`🛒 거래 요청: ${socket.id} → ${data.itemName}`);
    
    const player = players.get(socket.id);
    if (!player) return;
    
    // 간단한 거래 로직 (나무 10개 → 곡괭이 1개)
    const trades = {
      iron_pickaxe: { cost: { tree: 10 }, item: 'iron_pickaxe' },
      diamond_pickaxe: { cost: { tree: 20, stone: 10 }, item: 'diamond_pickaxe' },
      iron_axe: { cost: { tree: 15 }, item: 'iron_axe' },
      diamond_axe: { cost: { tree: 25, stone: 15 }, item: 'diamond_axe' }
    };
    
    const trade = trades[data.itemName];
    if (!trade) {
      socket.emit('trade-error', { message: '존재하지 않는 아이템입니다.' });
      return;
    }
    
    // 비용 확인
    for (const [resource, cost] of Object.entries(trade.cost)) {
      if ((player.inventory[resource] || 0) < cost) {
        socket.emit('trade-error', { 
          message: `${resource} ${cost}개가 필요합니다. (현재: ${player.inventory[resource] || 0}개)` 
        });
        return;
      }
    }
    
    // 거래 실행
    for (const [resource, cost] of Object.entries(trade.cost)) {
      player.inventory[resource] -= cost;
    }
    
    player.inventory[trade.item] = (player.inventory[trade.item] || 0) + 1;
    
    socket.emit('trade-success', {
      message: `${trade.item} 구매 완료!`,
      newInventory: player.inventory
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
        
        // 다른 플레이어들에게 알림
        io.to(player.roomId).emit('player-left', {
          playerId: socket.id,
          username: player.username,
          room: room
        });
        
        console.log(`📢 ${player.username}님이 게임을 떠났습니다.`);
        
        // 방이 비었으면 삭제
        if (room.players.length === 0) {
          gameRooms.delete(player.roomId);
          console.log(`🗑️ 빈 방 삭제: ${player.roomId}`);
        }
      }
      players.delete(socket.id);
    }
  });
});

// 유틸 함수들
function getResourceFromBlock(blockType) {
  const resourceMap = {
    tree: 'tree',  // tree → tree (수정)
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