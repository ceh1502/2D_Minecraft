const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const MapGenerator = require('./utils/mapGenerator');
const MonsterManager = require('./utils/monsterManager');
const { v4: uuidv4 } = require('uuid');
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
        monsterManager: new MonsterManager(gameMap, players, io),
        phase: 'day', // 'day' or 'night'
        phaseDuration: 60 * 1000, // 1 minute per phase
        phaseTimer: null,
        createdAt: new Date().toISOString()
      };
      
      // Start the day/night cycle
      newRoom.phaseTimer = setInterval(() => {
        newRoom.phase = newRoom.phase === 'day' ? 'night' : 'day';
        io.to(roomId).emit('phase-changed', { phase: newRoom.phase });

        if (newRoom.phase === 'night') {
          console.log('🌙 Night phase: Spawning monsters...');
          // Spawn monsters
          const spawnCount = Math.floor(Math.random() * 5) + 5; // 5-9 monsters
          for (let i = 0; i < spawnCount; i++) {
            const { x, y } = findValidSpawn(newRoom.map, newRoom.players, newRoom.monsterManager.getMonsters());
            if (x !== -1) {
              newRoom.monsterManager.spawnZombie(x, y);
            } else {
              console.log('...could not find a valid spawn location.');
            }
          }
        } else {
          // Clear monsters at day
          newRoom.monsterManager.monsters.clear();
        }
      }, newRoom.phaseDuration);
      
      gameRooms.set(roomId, newRoom);
      socket.join(roomId);
      
      console.log(`✅ 방 생성 완료: ${roomId}`);
      console.log('업데이트된 방 목록:', Array.from(gameRooms.keys()));
      
      socket.emit('room-created', {
        success: true,
        room: sanitizeRoom(newRoom)
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
        health: 20,
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
      room.monsterManager.players = room.players; // Update monster manager's player list
      players.set(socket.id, { ...player, roomId: roomId });
      
      socket.join(roomId);
      
      console.log(`✅ ${username} (${socket.id})님이 ${roomId} 방에 입장했습니다.`);
      console.log('현재 방 플레이어 수:', room.players.length);
      
      // 새 플레이어 입장 알림 (모든 플레이어에게)
      io.to(roomId).emit('player-joined', {
        player: player,
        room: sanitizeRoom(room)
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

  socket.on('trade-item', ({ itemName }) => {
    const player = players.get(socket.id);
    if (!player) return;

    const inventory = player.inventory || {};

    // 거래 아이템 정의
    const tradeItems = {
      wooden_pickaxe:  { material: 'tree', amount: 5 },
      stone_pickaxe:   { material: 'stone', amount: 5 },
      iron_pickaxe:    { material: 'iron', amount: 5 },
      diamond_pickaxe: { material: 'diamond', amount: 5 },

      iron_sword:      { material: 'iron', amount: 4 },
      diamond_sword:   { material: 'diamond', amount: 4 },

      iron_axe:        { material: 'iron', amount: 4 },
      diamond_axe:     { material: 'diamond', amount: 4 },

      iron_helmet:     { material: 'iron', amount: 5 },
      iron_chest:      { material: 'iron', amount: 8 },
      iron_leggings:   { material: 'iron', amount: 7 },
      iron_boots:      { material: 'iron', amount: 4 },

      diamond_helmet:  { material: 'diamond', amount: 5 },
      diamond_chest:   { material: 'diamond', amount: 8 },
      diamond_leggings:{ material: 'diamond', amount: 7 },
      diamond_boots:   { material: 'diamond', amount: 4 },
    };

    const trade = tradeItems[itemName];
    if (!trade) {
      socket.emit('trade-error', { message: '존재하지 않는 아이템' });
      return;
    }

    const { material, amount } = trade;

    // 자원 확인
    if (!inventory[material] || inventory[material] < amount) {
      socket.emit('trade-error', { message: `재료 부족: ${material} ${amount}개 필요` });
      return;
    }

    // 자원 차감
    inventory[material] -= amount;

    // 아이템 추가 (도구나 방어구 슬롯은 따로 다루지 않으면 일반 아이템으로 추가)
    inventory[itemName] = (inventory[itemName] || 0) + 1;

    // 서버 상태 업데이트
    player.inventory = inventory;
    players.set(socket.id, player);

    // 성공 응답
    socket.emit('trade-success', {
      newInventory: inventory,
      acquired: itemName
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

  const placeableBlocks = ['tree', 'stone', 'iron', 'diamond'];

  socket.on('place-block', ({ x, y, blockType }) => {
    const player = players.get(socket.id);
    if (!player || !blockType) return;

    const room = gameRooms.get(player.roomId);
    if (!room) return;

    if (
      x < 0 || x >= room.map.width ||
      y < 0 || y >= room.map.height - 1 // y+1까지 쓰니까 -1
    ) {
      socket.emit('placement-error', { message: '좌표 범위 초과' });
      return;
    }  

    const cell = room.map.cells[y]?.[x];
    const below = room.map.cells[y + 1]?.[x];

    console.log('📦 설치 시도 위치:', { x, y });

    // 설치 가능한 블록인지 확인
    if (!placeableBlocks.includes(blockType)) {
      socket.emit('placement-error', { message: '설치할 수 없는 블록' });
      return;
    }

    // 설치 조건: 빈 공간이며, 아래가 단단한 블록이어야 함
    const solidBlocks = ['grass', 'stone', 'tree', 'iron_ore', 'diamond'];
    const isPlaceableSurface = below && solidBlocks.includes(below.type);

    if (cell.type !== 'grass' || !isPlaceableSurface) {
      socket.emit('placement-error', { message: '설치 불가한 위치' });
      return;
    }

    // 인벤토리에 해당 블록이 있는지 확인
    if (!player.inventory[blockType] || player.inventory[blockType] <= 0) {
      socket.emit('placement-error', { message: '아이템 부족' });
      return;
    }

    // 아이템 개수 차감
    player.inventory[blockType] -= 1;

    // 맵에 블록 설치
    room.map.cells[y][x] = { type: blockType };
    console.log(`✅ ${blockType} 블록 설치 완료 → (${x}, ${y})`);

    // 클라이언트에 반영
    io.to(player.roomId).emit('block-updated', {
      x,
      y,
      block: { type: blockType },
      playerId: player.playerId,
      newInventory: player.inventory,
    });
  });

  socket.on('attack-monster', ({ monsterId }) => {
    const player = players.get(socket.id);
    if (!player) return;

    const room = gameRooms.get(player.roomId);
    if (!room) return;

    const monster = room.monsterManager.monsters.get(monsterId);
    if (!monster) return;

    // For now, player damage is 1
    const damage = 1;
    monster.hp -= damage;

    if (monster.hp <= 0) {
      room.monsterManager.monsters.delete(monsterId);
      console.log(`🧟 Monster ${monsterId} defeated by ${player.playerId}`);
    }

    io.to(player.roomId).emit('monsters-updated', { monsters: room.monsterManager.getMonsters() });
  });

  socket.on('restart-game', () => {
    const player = players.get(socket.id);
    if (!player) return;

    player.health = 20;
    player.position = { x: 25, y: 25 };
    player.inventory = { tree: 0, stone: 0, iron: 0, diamond: 0 };

    const room = gameRooms.get(player.roomId);
    if (room) {
      const roomPlayer = room.players.find(p => p.playerId === socket.id);
      if (roomPlayer) {
        roomPlayer.health = 20;
        roomPlayer.position = { x: 25, y: 25 };
        roomPlayer.inventory = { tree: 0, stone: 0, iron: 0, diamond: 0 };
      }
    }

    socket.emit('player-restarted', { player });
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
        room.monsterManager.players = room.players; // Update monster manager's player list
        
        // 다른 플레이어들에게 알림
        io.to(player.roomId).emit('player-left', {
          playerId: socket.id,
          username: player.username,
          room: room
        });
        
        console.log(`📢 ${player.username}님이 게임을 떠났습니다.`);
        
        // 방이 비었으면 삭제
        if (room.players.length === 0) {
          clearInterval(room.phaseTimer);
          gameRooms.delete(player.roomId);
          console.log(`🗑️ 빈 방 삭제: ${player.roomId}`);
        } else {
          // 다른 플레이어들에게 알림
          io.to(player.roomId).emit('player-left', {
            playerId: socket.id,
            room: sanitizeRoom(room)
          });
        }
      }
      players.delete(socket.id);
    }
  });
});

// Game loop for monster updates
setInterval(() => {
  for (const room of gameRooms.values()) {
    console.log(`⏰ [Loop] Room: ${room.roomId}, Phase: ${room.phase}`);

    if (room.phase === 'night') {
      room.monsterManager.moveMonsters();
      room.monsterManager.attackPlayers();
    }
    io.to(room.roomId).emit('monsters-updated', { monsters: room.monsterManager.getMonsters() });
  }
}, 1000);

// 유틸 함수들
function sanitizeRoom(room) {
  if (!room) return null;
  return {
    roomId: room.roomId,
    players: room.players,
    map: room.map,
    phase: room.phase,
    monsters: room.monsterManager.getMonsters(),
    createdAt: room.createdAt
  };
}

function findValidSpawn(map, players, monsters) {
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);

    if (map.cells[y][x].type === 'grass') {
      const isOccupied = players.some(p => p.position.x === x && p.position.y === y) ||
                         monsters.some(m => m.position.x === x && m.position.y === y);
      if (!isOccupied) {
        return { x, y };
      }
    }
  }
  return { x: -1, y: -1 }; // No valid spawn found
}

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
