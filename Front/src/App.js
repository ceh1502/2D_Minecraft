import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// 아이템 타입별 이모지 아이콘 반환 헬퍼 함수
const getIconForItem = (type) => {
  switch (type) {
    case 'wood': return '/images/blocks/tree.png';
    case 'stone': return '/images/blocks/stone.png';
    case 'iron': return '/images/blocks/iron.png';
    case 'diamond': return '/images/blocks/dia.png';
    // 도구 아이콘 추가
    case 'pickaxe': return '/images/tools/pickaxe.png';
    case 'axe': return '/images/tools/axe.png';
    case 'sword': return '/images/tools/sword.png';
    default: return '❓';
  }
};

// 🔨 새로운 함수: 아이템이 도구인지 판별
const getToolType = (itemName) => {
  if (!itemName) return 'hand'; // 빈칸은 맨손
  
  switch (itemName) {
    case 'pickaxe':
    case 'iron_pickaxe':
    case 'diamond_pickaxe':
      return 'pickaxe';
    case 'axe':
    case 'iron_axe':
    case 'diamond_axe':
      return 'axe';
    case 'sword':
    case 'iron_sword':
    case 'diamond_sword':
      return 'sword';
    default:
      return 'hand'; // 블록이나 기타 아이템은 맨손
  }
};

// 🔨 새로운 함수: 현재 선택된 슬롯의 도구 타입 가져오기
const getCurrentToolType = (inventory, selectedSlot) => {
  const currentItem = inventory[selectedSlot];
  return getToolType(currentItem?.name);
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

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
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

  // 게임 초기화
  useEffect(() => {
    console.log('🎮 게임 시작!');
    
    const newSocket = io('http://localhost:5001', {
      autoConnect: true,
      reconnection: true
    });
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ 서버 연결:', newSocket.id);
      setConnected(true);
      
      // 자동으로 방 생성/입장
      setTimeout(() => {
        newSocket.emit('create-room', 'main_room');
        setTimeout(() => {
          newSocket.emit('join-room', 'main_room');
        }, 100);
      }, 500);
    });

    // 방 입장 성공
    newSocket.on('player-joined', (data) => {
      console.log('🏠 플레이어 입장:', data);
      setGameState(prev => ({
        ...prev,
        players: data.room.players,
        currentPlayer: data.player
      }));
      
      // 맵 데이터 요청
      newSocket.emit('request-map');
    });

    // 맵 데이터 수신
    newSocket.on('map-data', (data) => {
      console.log('🗺️ 맵 데이터 수신:', data);
      setGameState(prev => ({
        ...prev,
        mapData: data.map,
        players: data.allPlayers,
        currentPlayer: prev.currentPlayer
      }));
    });

    // 플레이어 이동
    newSocket.on('player-moved', (data) => {
      setGameState(prev => {
        const updatedPlayers = prev.players.map(p => 
          p.playerId === data.playerId
            ? { ...p, position: data.position }
            : p
        );

        const updatedCurrent = prev.currentPlayer?.playerId === data.playerId
          ? { ...prev.currentPlayer, position: data.position }
          : prev.currentPlayer;

        return {
          ...prev,
          players: updatedPlayers,
          currentPlayer: updatedCurrent
        };
      });
    });

    // 새로운 블록 업데이트 이벤트 (내구도 시스템)
    newSocket.on('block-updated', ({ x, y, block, playerId, newInventory }) => {
      setGameState(prev => {
        if (!prev.mapData) return prev;

        // 맵 업데이트
        const newCells = prev.mapData.cells.map(row => [...row]);
        if (newCells[y] && newCells[y][x]) {
          newCells[y][x] = block; // 새로운 블록 상태로 교체
        }

        // 🔨 수정된 인벤토리 배열 변환 함수 (테스트 도구 제거)
        const convertInventoryToArray = (inventoryObj) => {
          const types = ['wood', 'stone', 'iron', 'diamond'];
          const flat = new Array(20).fill(null);
          let i = 0;
          
          // 기존 자원들만
          types.forEach(type => {
            const count = inventoryObj[type];
            if (count > 0 && i < 20) {
              flat[i++] = { name: type, count, icon: getIconForItem(type) };
            }
          });
          
          return flat;
        };

        return {
          ...prev,
          mapData: { ...prev.mapData, cells: newCells },
          currentPlayer: playerId === prev.currentPlayer?.playerId
            ? { ...prev.currentPlayer, inventory: newInventory }
            : prev.currentPlayer,
          inventory: playerId === prev.currentPlayer?.playerId
            ? convertInventoryToArray(newInventory)
            : prev.inventory
        };
      });
    });

    // 채굴 에러 처리
    newSocket.on('mining-error', (data) => {
      console.log('❌ 채굴 에러:', data.message);
    });

    return () => newSocket.close();
  }, []);

  // 키보드 컨트롤
  useEffect(() => {
    const pressedKeys = new Set();

    const handleKeyDown = (e) => {
      // 드래그 중이면 키보드 이벤트 무시
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
        setGameState(prev => {
          if (!prev.currentPlayer || !prev.mapData) return prev;
          
          // 🎯 1단계: 방향 먼저 업데이트
          const newDirection = moveMap[key];
          
          // 🎯 2단계: 이동 가능한지 체크
          const newPosition = calculateNewPosition(prev.currentPlayer.position, newDirection, prev.mapData);
          
          // 위치가 바뀌지 않았다면 이동이 차단됨 (방향만 변경)
          if (newPosition.x === prev.currentPlayer.position.x && 
              newPosition.y === prev.currentPlayer.position.y) {
            console.log('🚧 이동 차단됨 - 방향만 변경');
            return {
              ...prev,
              direction: newDirection, // 방향은 바뀜
              // currentPlayer 위치는 그대로
            };
          }
          
          // 이동 가능하면 위치도 업데이트
          console.log('✅ 이동 가능');
          return {
            ...prev,
            direction: newDirection,
            currentPlayer: {
              ...prev.currentPlayer,
              position: newPosition
            }
          };
        });
        
        // 서버에는 항상 이동 요청 (서버에서 최종 검증)
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
  }, [socket, connected, calculateNewPosition, tryMineBlock, draggedItem]);

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

      <div className="controls-guide">
        <p>🎮 이동: WASD | 인벤토리: 1-5 | 채굴: J</p>
      </div>
    </div>
  );
}

// 🔨 업그레이드된 InventoryGrid 컴포넌트
function InventoryGrid({ inventory, selectedSlot, onSlotSelect, onDragStart, onDrop, onDragOver, onDragEnd }) {
  const rows = 4, cols = 5;
  
  return (
    <div className="inventory-grid">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div className="inventory-row" key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => {
            const index = rowIdx * cols + colIdx;
            const item = inventory[index];
            const isHotbar = rowIdx === 3;
            const isSelected = isHotbar && selectedSlot === colIdx;
            
            return (
              <div
                key={index}
                className={`inventory-slot ${isSelected ? 'selected' : ''} ${item ? 'has-item' : ''}`}
                onClick={() => isHotbar && onSlotSelect && onSlotSelect(colIdx)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, index)}
                style={{ position: 'relative' }}
              >
                {item && (
                  <div
                    className="draggable-item"
                    draggable={true}
                    onDragStart={(e) => onDragStart(e, item, index)}
                    onDragEnd={onDragEnd}
                    style={{
                      width: '100%',
                      height: '100%',
                      cursor: 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="slot-icon">
                      <img
                        src={item.icon}
                        alt={item.name}
                        width={16}
                        height={16}
                        style={{ pointerEvents: 'none' }}
                      />
                    </div>
                    <div className="slot-count" style={{ pointerEvents: 'none' }}>
                      {item.count > 1 ? item.count : ''}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function InventoryModal({ inventory, onClose, onDragStart, onDrop, onDragOver, onDragEnd }) {
  return (
    <div className="inventory-modal-backdrop" onClick={onClose}>
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-layout">
          <div className="player-avatar">
            <div className="avatar-box">
              <img 
                src="/images/characters/steve.gif"
                alt="avatar"
                height={108}
              />
            </div>
          </div>

          <div className="inventory-content">
            <InventoryGrid
              inventory={inventory}
              selectedSlot={null}
              onSlotSelect={() => {}}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            />
            <button onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
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

        <div
          className="player-icon current-player"
          style={{
            left: currentPlayer.position.x * cellSize,
            top: currentPlayer.position.y * cellSize,
            width: tileSize,
            height: tileSize
          }}
        >
          <img
            src={getPlayerImage(direction)}
            alt="player"
            width={tileSize}
            height={tileSize}
          />
        </div>

        {players
          .filter(p => p.playerId !== currentPlayer.playerId)
          .map(p => (
            <div
              key={p.playerId}
              className="player-icon"
              style={{
                left: p.position.x * cellSize,
                top: p.position.y * cellSize,
                width: tileSize,
                height: tileSize
              }}
            >
              <img
                src={getPlayerImage('down')}
                alt="other player"
                width={tileSize}
                height={tileSize}
              />
            </div>
          ))
        }
      </div>
    </div>
  );
}

// 🔨 업그레이드된 Hotbar 컴포넌트 (드래그 앤 드롭 지원)
function Hotbar({ selectedSlot, inventory, onDragStart, onDrop, onDragOver, onDragEnd }) {
  const currentToolType = getCurrentToolType(inventory, selectedSlot);
  
  const getToolEmoji = (toolType) => {
    switch (toolType) {
      case 'hand': return '👊';
      case 'pickaxe': return '⛏️';
      case 'axe': return '🪓';
      case 'sword': return '⚔️';
      default: return '👊';
    }
  };
  
  return (
    <div className="hotbar">
      {[0,1,2,3,4].map((i) => {
        const item = inventory[i];
        const isSelected = selectedSlot === i;
        const toolType = getToolType(item?.name);
        
        return (
          <div
            key={i}
            className={`hotbar-slot ${isSelected ? 'selected' : ''} ${item ? 'has-item' : ''}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, i)}
            style={{ position: 'relative' }}
          >
            <div className="slot-number">{i + 1}</div>
            
            {item && (
              <div
                className="draggable-item"
                draggable={true}
                onDragStart={(e) => onDragStart(e, item, i)}
                onDragEnd={onDragEnd}
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <div className="slot-icon">
                  <img
                    src={item.icon}
                    alt={item.name}
                    width={16}
                    height={16}
                    style={{ pointerEvents: 'none' }}
                  />
                </div>
                <div className="slot-count" style={{ pointerEvents: 'none' }}>
                  {item.count > 1 ? item.count : ''}
                </div>
              </div>
            )}
            
            <div className="slot-name">
              {item?.name || ''}
              {isSelected && !item && (
                <div style={{ fontSize: '12px', color: '#FFD700' }}>
                  {getToolEmoji(currentToolType)} {currentToolType}
                </div>
              )}
            </div>
          </div>
        );
      })}
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