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

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const tryMineBlock = useCallback(() => {
    if (!socket || !connected) return;
  
    const player = gameStateRef.current.currentPlayer;
    const mapData = gameStateRef.current.mapData;
    const direction = gameStateRef.current.direction;
    const inventory = gameStateRef.current.inventory;
    const selectedTool = inventory[gameStateRef.current.selectedSlot];
  
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
  
  
    socket.emit('mine-block', { x: targetX, y: targetY });
  }, [socket, connected]);

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

    // 서버에서 블록 파괴 업데이트 받으면 맵에 반영
    newSocket.on('block-mined', ({ x, y, playerId, resource, newInventory }) => {
      setGameState(prev => {
        if (!prev.mapData) return prev;
    
        // 맵 업데이트
        const newCells = prev.mapData.cells.map(row => [...row]);
        if (newCells[y] && newCells[y][x]) {
          newCells[y][x] = { type: 'grass' };
        }
    
        // 인벤토리 배열 변환 함수
        const convertInventoryToArray = (inventoryObj) => {
          const types = ['wood', 'stone', 'iron', 'diamond'];
          const flat = new Array(20).fill(null);
          let i = 0;
          types.forEach(type => {
            const count = inventoryObj[type];
            if (count > 0 && i < 20) {
              flat[i++] = { name: type, count, icon: getIconForItem(type) };
            }
          });
          return flat;
        };
    
        const updatedCurrentPlayer =
          prev.currentPlayer?.playerId === playerId
            ? {
                ...prev.currentPlayer,
                inventory: newInventory
              }
            : prev.currentPlayer;
    
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

    return () => newSocket.close();
  }, []);

  // 키보드 컨트롤(이동, 인벤토리, 채굴)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!socket || !connected) return;
      const key = e.key.toLowerCase();

      const moveMap = {
        w: 'up',
        a: 'left',
        s: 'down',
        d: 'right',
      };

      if (moveMap[key]) {
        const direction = moveMap[key];

        setGameState(prev => ({ ...prev, direction }));

        const { currentPlayer, mapData } = gameStateRef.current;
        if (!currentPlayer || !mapData) return;

        let { x, y } = currentPlayer.position;
        if (direction === 'up') y--;
        else if (direction === 'down') y++;
        else if (direction === 'left') x--;
        else if (direction === 'right') x++;

        // 이동 범위 검사
        if (x < 0 || x >= mapData.width || y < 0 || y >= mapData.height) return;

        const targetCell = mapData.cells[y][x];
        if (targetCell.type !== 'grass') {
          console.log('🚫 이 블록은 지나갈 수 없어!');
          return; // ❌ 이동 중단
        }

  // ✅ 이동 허용
  setGameState(prev => ({ ...prev, direction }));
  socket.emit('move-player', direction);
}

      // 인벤토리 열기/닫기 (E키)
      if (key === 'e') {
        setGameState(prev => ({
          ...prev,
          isInventoryOpen: !prev.isInventoryOpen
        }));
      }

      // 인벤토리 슬롯 선택 1~5
      const slotKeys = ['1', '2', '3', '4', '5'];
      const slotIndex = slotKeys.indexOf(e.key);
      if (slotIndex !== -1) {
        setGameState(prev => ({ ...prev, selectedSlot: slotIndex }));
        socket.emit('change-hotbar-slot', slotIndex);
      }

      // J키 누르면 앞 블록 채굴 시도
      if (key === 'j') {
        tryMineBlock();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [socket, connected]);

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
      {/* 메인 게임 화면 */}
      <div className="game-view">
        <GameMap 
          mapData={gameState.mapData}
          players={gameState.players}
          currentPlayer={gameState.currentPlayer}
          direction={gameState.direction}
        />
      </div>

      {/* 하단 인벤토리 */}
      <div className="inventory-bar">
        <Hotbar 
          selectedSlot={gameState.selectedSlot}
          inventory={gameState.inventory}
        />
      </div>

      {gameState.isInventoryOpen && (
        <InventoryModal
          inventory={gameState.inventory}
          onClose={() =>
            setGameState(prev => ({ ...prev, isInventoryOpen: false }))
          }
        />
      )}

      {/* 컨트롤 가이드 */}
      <div className="controls-guide">
        <p>🎮 이동: WASD | 인벤토리: 1-5</p>
      </div>
    </div>
  );
}

function InventoryGrid({ inventory, selectedSlot, onSlotSelect }) {
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
                className={`inventory-slot ${isSelected ? 'selected' : ''}`}
                onClick={() => isHotbar && onSlotSelect(colIdx)}
              >
                <div className="slot-icon">
                  {item?.icon && (
                    <img
                      src={item.icon}
                      alt={item.name}
                      width={16}
                      height={16}
                    />
                  )}
                </div>
                <div className="slot-count">{item?.count > 1 ? item.count : ''}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function InventoryModal({ inventory, onClose }) {
  return (
    <div className="inventory-modal-backdrop" onClick={onClose}>
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-layout">
          {/* 왼쪽: 플레이어 아바타 영역 */}
          <div className="player-avatar">
            <div className="avatar-box">
              <img 
                src="/images/characters/steve.gif"
                alt="avatar"
                height={108}
              />
            </div>
          </div>

          {/* 오른쪽: 인벤토리 */}
          <div className="inventory-content">
            <InventoryGrid
              inventory={inventory}
              selectedSlot={null}
              onSlotSelect={() => {}}
            />
            <button onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 게임 맵 컴포넌트
function GameMap({ mapData, players, currentPlayer, direction }) {
  const [zoomLevel, setZoomLevel] = useState(2.5);
  
  if (!mapData || !currentPlayer) return null;

  const tileSize = 20; // 블록 크기
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
        {/* 맵 셀 */}
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
              />
            </div>
          ))
        )}

        {/* 현재 플레이어 */}
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

        {/* 다른 플레이어들 */}
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

// 인벤토리 바 컴포넌트
function Hotbar({ selectedSlot, inventory }) {
  return (
    <div className="hotbar">
      {[0,1,2,3,4].map((i) => {
        const item = inventory[i];
        return (
          <div
            key={i}
            className={`hotbar-slot ${selectedSlot === i ? 'selected' : ''}`}
          >
            <div className="slot-number">{i + 1}</div>
            <div className="slot-icon">
              {item?.icon && (
                <img
                  src={item.icon}
                  alt={item.name}
                  width={16}
                  height={16}
                />
              )}
            </div>
            <div className="slot-name">{item?.name || ''}</div>
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