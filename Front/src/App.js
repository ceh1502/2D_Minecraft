import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { InventoryModal, InventoryGrid, Hotbar, getCurrentToolType} from './components/InventoryUI'
import ShopModal from './components/ShopModal';
import './App.css';

// 🔧 상단으로 빼낸 공통 함수들

// 아이템 타입별 이모지 아이콘 반환 헬퍼 함수
const getIconForItem = (type) => {
  switch (type) {
    case 'tree': return '/images/blocks/tree.png';
    case 'stone': return '/images/blocks/stone.png';
    case 'iron': return '/images/blocks/iron.png';
    case 'diamond': return '/images/blocks/dia.png';
    // 도구 아이콘 추가
    case 'wooden_pickaxe': return '/images/items/wooden_pickaxe.png';
    case 'stone_pickaxe': return '/images/items/stone_pickaxe.png';
    case 'iron_pickaxe': return '/images/items/iron_pickaxe.png';
    case 'diamond_pickaxe': return '/images/items/diamond_pickaxe.png';

    case 'iron_sword': return '/images/items/iron_sword.png';
    case 'diamond_sword': return '/images/items/diamond_sword.png';

    case 'iron_axe': return '/images/items/iron_axe.png';
    case 'diamond_axe': return '/images/items/diamond_axe.png';

    // 방어구
    case 'iron_helmet': return '/images/items/iron_helmet.png';
    case 'iron_chest': return '/images/items/iron_chest.png';
    case 'iron_leggings': return '/images/items/iron_leggings.png';
    case 'iron_boots': return '/images/items/iron_boots.png';

    case 'diamond_helmet': return '/images/items/diamond_helmet.png';
    case 'diamond_chest': return '/images/items/diamond_chest.png';
    case 'diamond_leggings': return '/images/items/diamond_leggings.png';
    case 'diamond_boots': return '/images/items/diamond_boots.png';
    default: return '❓';
  }
};

const getPlayerImage = (direction) => {
  switch (direction) {
    case 'up': return '/images/characters/avatar_up.png';
    case 'down': return '/images/characters/avatar_down.png';
    case 'left': return '/images/characters/avatar_left.png';
    case 'right': return '/images/characters/avatar_right.png';
    default: return '/images/characters/avatar_down.png';
  }
};

const PLACEABLE_BLOCKS = ['tree', 'stone', 'iron', 'diamond'];

// 🔧 인벤토리 변환 함수 (상단으로 이동)
const convertInventoryToArray = (inventoryObj) => {
  const types = [
    'tree', 'stone', 'iron', 'diamond',
    'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe',
    'iron_sword', 'diamond_sword',
    'iron_axe', 'diamond_axe',
    'iron_helmet', 'iron_chest', 'iron_leggings', 'iron_boots',
    'diamond_helmet', 'diamond_chest', 'diamond_leggings', 'diamond_boots'
  ];

  const flat = new Array(20).fill(null);
  let i = 0;
  types.forEach((type) => {
    const count = inventoryObj[type];
    if (count > 0 && i < 20) {
      flat[i++] = {
        name: type,
        count,
        icon: getIconForItem(type),
      };
    }
  });
  return flat;
};

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  
  // ✅ 닉네임 시스템 추가
  const [playerName, setPlayerName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  
  const [gameState, setGameState] = useState({
    mapData: null,
    players: [],
    currentPlayer: null,
    selectedSlot: 0,
    direction: 'down',
    inventory: new Array(20).fill(null), 
    isInventoryOpen: false
  });

  // 🖱️ 드래그 상태
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedFromIndex, setDraggedFromIndex] = useState(null);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 🖱️ 드래그 핸들러들
  const handleDragStart = (e, item, index) => {
    setDraggedItem(item);
    setDraggedFromIndex(index);
    console.log(`📦 드래그 시작: ${item?.name} (인덱스: ${index})`);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // 드롭 허용
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedFromIndex === null) return;
    if (draggedFromIndex === targetIndex) {
      setDraggedItem(null);
      setDraggedFromIndex(null);
      return;
    }
    
    console.log(`📦 드롭: ${draggedItem.name} (${draggedFromIndex} → ${targetIndex})`);
    
    // 인벤토리 업데이트
    setGameState(prev => {
      const newInventory = [...prev.inventory];
      const targetItem = newInventory[targetIndex];
      
      // 아이템 위치 교환
      newInventory[draggedFromIndex] = targetItem;
      newInventory[targetIndex] = draggedItem;
      
      return {
        ...prev,
        inventory: newInventory
      };
    });
    
    setDraggedItem(null);
    setDraggedFromIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedFromIndex(null);
  };
  
  // 🔨 수정된 채굴 함수 - 도구 타입 전송
  const tryMineBlock = useCallback(() => {
    if (!socket || !connected) return;

    const player = gameStateRef.current.currentPlayer;
    const mapData = gameStateRef.current.mapData;
    const direction = gameStateRef.current.direction;
    const inventory = gameStateRef.current.inventory;
    const selectedSlot = gameStateRef.current.selectedSlot;

    if (!player || !mapData) {
      return;
    }

    let targetX = player.position.x;
    let targetY = player.position.y;

    switch (direction) {
      case 'up': targetY -= 1; break;
      case 'down': targetY += 1; break;
      case 'left': targetX -= 1; break;
      case 'right': targetX += 1; break;
    }

    if (
      targetX < 0 || targetX >= mapData.width ||
      targetY < 0 || targetY >= mapData.height
    ) {
      return;
    }

    if (
      targetX === 0 || targetX === mapData.width - 1 ||
      targetY === 0 || targetY === mapData.height - 1
    ) {
      console.log('맵 테두리 파괴 X ');
      return;
    }

    // 🔨 현재 장착된 도구 타입 계산
    const currentToolType = getCurrentToolType(inventory, selectedSlot);
    
    console.log(`⛏️ 채굴 시도: 도구타입=${currentToolType}, 슬롯=${selectedSlot + 1}`);

    socket.emit('mine-block', { 
      x: targetX, 
      y: targetY,
      toolType: currentToolType  // 도구 타입 전송
    });
  }, [socket, connected]);

  // 위치 계산 헬퍼 함수 (콜리전 체크 포함)
  const calculateNewPosition = (currentPos, direction, mapData) => {
    const { x, y } = currentPos;
    
    let newX = x;
    let newY = y;
    
    switch (direction) {
      case 'up': newY = Math.max(1, y - 1); break;
      case 'down': newY = Math.min(48, y + 1); break;
      case 'left': newX = Math.max(1, x - 1); break;
      case 'right': newX = Math.min(48, x + 1); break;
      default: return currentPos;
    }
    
    // 🚧 블록 충돌 체크
    if (mapData && mapData.cells) {
      const targetCell = mapData.cells[newY] && mapData.cells[newY][newX];
      if (targetCell) {
        // 고체 블록들 (이동 불가)
        const solidBlocks = ['stone', 'tree', 'iron_ore', 'diamond'];
        
        if (solidBlocks.includes(targetCell.type)) {
          console.log(`🚧 이동 차단: ${targetCell.type} 블록`);
          return currentPos; // 원래 위치 반환 (이동 취소)
        }
      }
    }
    
    return { x: newX, y: newY };
  };

  const tryPlaceBlock = useCallback(() => {
    if (!socket || !connected) return;

    const player = gameStateRef.current.currentPlayer;
    const mapData = gameStateRef.current.mapData;
    const direction = gameStateRef.current.direction;
    const selectedItem = gameStateRef.current.inventory[gameStateRef.current.selectedSlot];

    if (!selectedItem || !PLACEABLE_BLOCKS.includes(selectedItem.name)) {
      console.log('❌ 설치 불가 아이템:', selectedItem?.name);
      return;
    }

    let targetX = player.position.x;
    let targetY = player.position.y;

    switch (direction) {
      case 'up': targetY -= 1; break;
      case 'down': targetY += 1; break;
      case 'left': targetX -= 1; break;
      case 'right': targetX += 1; break;
    }

    const targetCell = mapData?.cells?.[targetY]?.[targetX];
    const belowCell = mapData?.cells?.[targetY + 1]?.[targetX];
    
    const solidBlocks = ['grass', 'stone', 'tree', 'iron_ore', 'diamond'];
    const isPlaceableSurface = belowCell && solidBlocks.includes(belowCell.type);

    if (targetCell?.type !== 'grass' || !isPlaceableSurface) {
      console.log('❌ 설치 불가한 위치');
      return;
    }

    socket.emit('place-block', {
      x: targetX,
      y: targetY,
      blockType: selectedItem.name
    });
  }, [socket, connected]);

  // 게임 초기화
  useEffect(() => {
    if (!isNameSet) return;
    
    console.log('🎮 게임 시작!');
    
    const SERVER_URL = 'http://143.248.162.5:5001';
    console.log('🔗 서버 연결 시도:', SERVER_URL);

    const newSocket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['polling', 'websocket'],
      forceNew: true
    });
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ 서버 연결 성공:', newSocket.id);
      setConnected(true);
      
      setTimeout(() => {
        console.log('🏠 방 생성 요청: main_room');
        newSocket.emit('create-room', 'main_room');
        setTimeout(() => {
          const joinData = {
            roomId: 'main_room',
            username: playerName
          };
          console.log('🚪 방 입장 요청:', joinData);
          newSocket.emit('join-room', joinData);
        }, 100);
      }, 500);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ 서버 연결 실패:', error);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 연결 끊김:', reason);
      setConnected(false);
    });

    // 🎯 방 입장 성공 - 내 플레이어 정보 확실히 설정
    newSocket.on('player-joined', (data) => {
      console.log('🏠 플레이어 입장 데이터:', data);
      
      // 내 플레이어 찾기
      const myPlayer = data.room.players.find(p => p.playerId === newSocket.id);
      console.log('👤 내 플레이어 정보:', myPlayer);
      
      setGameState(prev => ({
        ...prev,
        players: data.room.players,
        currentPlayer: myPlayer // 확실히 내 플레이어만 설정
      }));
      
      newSocket.emit('request-map');
    });

    // 🎯 맵 데이터 수신 - 플레이어 정보 재확인
    newSocket.on('map-data', (data) => {
      console.log('🗺️ 맵 데이터 수신:', data);
      
      setGameState(prev => {
        // 내 플레이어 다시 찾기 (혹시 모를 상황 대비)
        const myPlayer = data.allPlayers.find(p => p.playerId === newSocket.id);
        console.log('🗺️ 맵 로딩 시 내 플레이어:', myPlayer);
        
        return {
          ...prev,
          mapData: data.map,
          players: data.allPlayers,
          currentPlayer: myPlayer || prev.currentPlayer
        };
      });
    });

    // 🎯 플레이어 이동 - 완전히 수정된 로직
    newSocket.on('player-moved', (data) => {
      console.log('🚶 이동 이벤트 수신:', {
        movedPlayerId: data.playerId,
        mySocketId: newSocket.id,
        isMyMovement: data.playerId === newSocket.id
      });
      
      setGameState(prev => {
        // 🚨 중요: 내 움직임은 무시 (로컬에서 이미 처리됨)
        if (data.playerId === newSocket.id) {
          console.log('⏭️ 내 움직임 이벤트 무시');
          return prev;
        }
        
        // 다른 플레이어들의 움직임만 처리
        const updatedPlayers = prev.players.map(p => 
          p.playerId === data.playerId
            ? { 
                ...p, 
                position: data.position,
                username: data.username || p.username
              }
            : p
        );

        console.log('🔄 다른 플레이어 위치 업데이트:', data.playerId);

        return {
          ...prev,
          players: updatedPlayers
          // currentPlayer는 절대 변경하지 않음!
        };
      });
    });

    // 새로운 블록 업데이트 이벤트
    newSocket.on('block-updated', ({ x, y, block, playerId, newInventory }) => {
      setGameState(prev => {
        if (!prev.mapData) return prev;

        const newCells = prev.mapData.cells.map(row => [...row]);
        if (newCells[y] && newCells[y][x]) {
          newCells[y][x] = block;
        }

        // 🎯 내가 채굴한 경우만 인벤토리 업데이트
        const shouldUpdateInventory = playerId === newSocket.id;

        return {
          ...prev,
          mapData: { ...prev.mapData, cells: newCells },
          currentPlayer: shouldUpdateInventory && prev.currentPlayer
            ? { ...prev.currentPlayer, inventory: newInventory }
            : prev.currentPlayer,
          inventory: shouldUpdateInventory
            ? convertInventoryToArray(newInventory)
            : prev.inventory
        };
      });
    });

    newSocket.on('mining-error', (data) => {
      console.log('❌ 채굴 에러:', data.message);
    });

    newSocket.on('room-error', (data) => {
      console.error('🏠 방 에러:', data.message);
    });

    return () => {
      console.log('🔌 소켓 연결 종료');
      newSocket.close();
    };
  }, [isNameSet, playerName]);

  // 거래 관련 이벤트 수신
  useEffect(() => {
    if (!socket) return;

    const handleTradeSuccess = (data) => {
      console.log('✅ 거래 성공:', data);
      console.log('🧪 서버가 준 인벤토리:', data.newInventory);

      // 예: 받은 아이템 인벤토리에 반영
      setGameState((prev) => ({
        ...prev,
        inventory: convertInventoryToArray(data.newInventory),
        currentPlayer: {
          ...prev.currentPlayer,
          inventory: data.newInventory
        }
      }));
    };

    const handleTradeError = (data) => {
      console.log('❌ 거래 실패:', data.message);
      // 나중에 UI로 에러 토스트 띄울 수도 있어
    };

    socket.on('trade-success', handleTradeSuccess);
    socket.on('trade-error', handleTradeError);

    return () => {
      socket.off('trade-success', handleTradeSuccess);
      socket.off('trade-error', handleTradeError);
    };
  }, [socket]);

  // 🎯 키보드 컨트롤 - 로컬 우선 처리
  useEffect(() => {
    const pressedKeys = new Set();

    const handleKeyDown = (e) => {
      if (draggedItem !== null) return;
      if (!socket || !connected) return;
      if (pressedKeys.has(e.key.toLowerCase())) return;
      
      const key = e.key.toLowerCase();
      pressedKeys.add(key);

      const moveMap = {
        w: 'up',
        a: 'left', 
        s: 'down',
        d: 'right',
      };

      if (moveMap[key]) {
        // 🎯 로컬 상태 즉시 업데이트 (부드러운 움직임)
        setGameState(prev => {
          if (!prev.currentPlayer || !prev.mapData) return prev;
          
          const newDirection = moveMap[key];
          const newPosition = calculateNewPosition(prev.currentPlayer.position, newDirection, prev.mapData);
          
          // 이동 불가능한 경우
          if (newPosition.x === prev.currentPlayer.position.x && 
              newPosition.y === prev.currentPlayer.position.y) {
            console.log('🚧 로컬 이동 차단 - 방향만 변경');
            return {
              ...prev,
              direction: newDirection
            };
          }
          
          // 이동 가능한 경우 - 로컬에서 즉시 반영
          console.log(`🏃 로컬 즉시 이동: ${prev.currentPlayer.username} → (${newPosition.x}, ${newPosition.y})`);
          return {
            ...prev,
            direction: newDirection,
            currentPlayer: {
              ...prev.currentPlayer,
              position: newPosition
            }
          };
        });
        
        // 🎯 서버에 알림 (다른 플레이어들을 위해)
        socket.emit('move-player', moveMap[key]);
      }

      // 인벤토리 슬롯 선택 1~5
      const slotKeys = ['1', '2', '3', '4', '5'];
      const slotIndex = slotKeys.indexOf(e.key);
      if (slotIndex !== -1) {
        setGameState(prev => ({ ...prev, selectedSlot: slotIndex }));
        socket.emit('change-hotbar-slot', slotIndex);
      }

      // 인벤토리 열기/닫기 (E키)
      if (key === 'e') {
        setGameState(prev => ({
          ...prev,
          isInventoryOpen: !prev.isInventoryOpen
        }));
      }

      // J키 누르면 앞 블록 채굴 시도
      if (key === 'j') {
        tryMineBlock();
      }

      if (key === 'k') {
        tryPlaceBlock();
      }
    };

    const handleKeyUp = (e) => {
      pressedKeys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [socket, connected, tryMineBlock, draggedItem]);

  // ✅ 닉네임 입력 화면 (가장 먼저 체크)
  if (!isNameSet) {
    return (
      <div className="name-input-screen">
        <div className="name-input-container">
          <h1>🎮 마인크래프트</h1>
          <h2>플레이어 이름을 입력하세요</h2>
          <input
            type="text"
            placeholder="닉네임 입력..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && playerName.trim()) {
                setIsNameSet(true);
              }
            }}
            maxLength={12}
            autoFocus
          />
          <button 
            onClick={() => {
              if (playerName.trim()) setIsNameSet(true);
            }}
            disabled={!playerName.trim()}
          >
            게임 시작
          </button>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="loading-screen">
        <h1>🎮 마인크래프트 게임</h1>
        <p>서버에 연결 중...</p>
      </div>
    );
  }

  if (!gameState.mapData) {
    return (
      <div className="loading-screen">
        <h1>🎮 마인크래프트 게임</h1>
        <p>맵 로딩 중...</p>
      </div>
    );
  }

  return (
    <div
      className="game-container"
      id="game-root"
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div className="game-view">
        <GameMap 
          mapData={gameState.mapData}
          players={gameState.players}
          currentPlayer={gameState.currentPlayer}
          direction={gameState.direction}
        />
      </div>

      <div className="inventory-bar">
        <Hotbar 
          selectedSlot={gameState.selectedSlot}
          inventory={gameState.inventory}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        />
      </div>

      {gameState.isInventoryOpen && (
        <InventoryModal
          inventory={gameState.inventory}
          onClose={() =>
            setGameState(prev => ({ ...prev, isInventoryOpen: false }))
          }
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        />
      )}

      {isShopOpen && (
        <ShopModal
          inventory={gameState.inventory}
          onClose={() => setIsShopOpen(false)}
          onBuy={(itemName) => {
            if (socket) socket.emit('trade-item', { itemName });
          }}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        />
      )}

      <div className="controls-guide">
        <p>🎮 이동: WASD | 인벤토리: 1-5 | 채굴: J</p>
      </div>

      <button className="shop-button" onClick={() => setIsShopOpen(true)}>
        <img src="/images/blocks/craft.png" alt="상점" style={{ width: 48, height: 48 }} />
      </button>
    </div>
  );
}

function GameMap({ mapData, players, currentPlayer, direction }) {
  const [zoomLevel, setZoomLevel] = useState(2.5);
  
  if (!mapData || !currentPlayer) return null;

  const tileSize = 20;
  const gap = 0;
  const cellSize = tileSize + gap;

  const mapWidth = mapData.width * cellSize;
  const mapHeight = mapData.height * cellSize;

  // 화면 중앙 계산
  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2;

  // 플레이어 월드 좌표
  const playerWorldX = currentPlayer.position.x * cellSize + cellSize / 2;
  const playerWorldY = currentPlayer.position.y * cellSize + cellSize / 2;

  // 카메라 오프셋 (플레이어를 화면 중앙에)
  const offsetX = screenCenterX - playerWorldX * zoomLevel;
  const offsetY = screenCenterY - playerWorldY * zoomLevel;

  return (
    <div className="game-map-wrapper">
      <div
        className="game-map"
        style={{
          width: mapWidth,
          height: mapHeight,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoomLevel})`,
          transformOrigin: '0 0'
        }}
      >
        {mapData.cells.map((row, y) =>
          row.map((cell, x) => (
            <div 
              key={`${x}-${y}`}
              className={`map-cell ${cell.type}`}
              style={{
                left: x * cellSize,
                top: y * cellSize,
                width: tileSize,
                height: tileSize
              }}
            >
              <img 
                src={getCellIcon(cell.type)}
                alt={cell.type} 
                width={tileSize}
                height={tileSize}
                style={{
                  clipPath: cell.type !== 'grass' ? `inset(0 0 ${cell.miningProgress || 0}% 0)` : 'none'
                }}
              />
            </div>
          ))
        )}

        {/* 🎯 현재 플레이어 (내 캐릭터) */}
        <div
          className="player-container"
          style={{
            left: currentPlayer.position.x * cellSize,
            top: currentPlayer.position.y * cellSize,
            width: tileSize,
            height: tileSize,
            position: 'absolute'
          }}
        >
          {/* 닉네임 표시 */}
          <div className="player-nametag" style={{
            position: 'absolute',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,200,0,0.8)', // 내 캐릭터는 초록색
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}>
            {currentPlayer.username} (나)
          </div>
          
          {/* 플레이어 이미지 */}
          <img
            src={getPlayerImage(direction)}
            alt="player"
            width={tileSize}
            height={tileSize}
            style={{
              border: '2px solid lime' // 내 캐릭터 테두리
            }}
          />
        </div>

        {/* 🎯 다른 플레이어들 */}
        {players
          .filter(p => p.playerId !== currentPlayer.playerId)
          .map(p => (
            <div
              key={p.playerId}
              className="player-container"
              style={{
                left: p.position.x * cellSize,
                top: p.position.y * cellSize,
                width: tileSize,
                height: tileSize,
                position: 'absolute'
              }}
            >
              {/* 다른 플레이어 닉네임 */}
              <div className="player-nametag" style={{
                position: 'absolute',
                top: -20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: p.color || 'rgba(100,100,100,0.7)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}>
                {p.username}
              </div>
              
              <img
                src={getPlayerImage('down')}
                alt="other player"
                width={tileSize}
                height={tileSize}
                style={{
                  border: '2px solid orange' // 다른 플레이어 테두리
                }}
              />
            </div>
          ))
        }
      </div>
    </div>
  );
}

function getCellIcon(type) {
  const validTypes = ['grass', 'tree', 'stone', 'iron_ore', 'diamond'];
  if (validTypes.includes(type)) {
    return `/images/blocks/${type}.png`;
  }
  return '';
}

export default App;