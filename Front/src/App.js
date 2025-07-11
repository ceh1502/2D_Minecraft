import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// 아이템 타입별 이모지 아이콘 반환 헬퍼 함수
const getIconForItem = (type) => {
  switch (type) {
    case 'wood': return '🪵';
    case 'stone': return '🪨';
    case 'iron': return '⛓️';
    case 'diamond': return '💎';
    default: return '❓';
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
    inventory: [],
    isInventoryOpen: false
  });

  const tryMineBlock = useCallback(() => {
    console.log('[🧪 디버깅]', {
      connected,
      socketId: socket?.id,
      currentPlayer: gameState.currentPlayer,
      mapData: gameState.mapData
    });
    
    if (!socket || !connected) {
      console.warn('[🚫 채굴 요청 실패] socket 없음 or 연결 안 됨');
      return;
    }

    const player = gameState.currentPlayer;
    if (!player || !gameState.mapData) {
      console.warn('[🚫 채굴 요청 실패] 플레이어 또는 맵 없음');
      return;
    }

    let targetX = player.position.x;
    let targetY = player.position.y;

    switch (gameState.direction) {
      case 'up': targetY -= 1; break;
      case 'down': targetY += 1; break;
      case 'left': targetX -= 1; break;
      case 'right': targetX += 1; break;
      default: break;
    }

    if (
      targetX < 0 || targetX >= gameState.mapData.width ||
      targetY < 0 || targetY >= gameState.mapData.height
    ) {
      console.warn('[🚫 채굴 요청 실패] 범위 밖');
      return;
    }

    console.log('[📤 클라이언트] 채굴 요청 emit →', targetX, targetY);
    socket.emit('mine-block', { x: targetX, y: targetY });
  }, [socket, connected, gameState]);


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
          const resourceList = ['wood', 'stone', 'iron', 'diamond'];
          return resourceList
            .filter(type => inventoryObj[type] > 0)
            .map(type => ({
              name: type,
              count: inventoryObj[type],
              icon: getIconForItem(type)
            }));
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
          mapData: {
            ...prev.mapData,
            cells: newCells
          },
          currentPlayer: updatedCurrentPlayer,
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
        setGameState(prev => ({ ...prev, direction: moveMap[key] }));
        socket.emit('move-player', moveMap[key]);
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
        console.log('[👆 J 키 감지됨]');

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

// 게임 맵 컴포넌트
function GameMap({ mapData, players, currentPlayer }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [wrapperSize, setWrapperSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 100,
  });

  if (!mapData || !currentPlayer) return null;

  const tileSize = 12;
  const gap = 1;
  const cellSize = tileSize + gap;

  const mapWidth = mapData.width * cellSize;
  const mapHeight = mapData.height * cellSize;

  const playerCenterX = currentPlayer.position.x * cellSize + cellSize / 2;
  const playerCenterY = currentPlayer.position.y * cellSize + cellSize / 2;

  const visibleWidth = wrapperSize.width / zoomLevel;
  const visibleHeight = wrapperSize.height / zoomLevel;

  const offsetX = Math.max(
    0,
    Math.min(playerCenterX - visibleWidth / 2, mapWidth - visibleWidth)
  );
  const offsetY = Math.max(
    0,
    Math.min(playerCenterY - visibleHeight / 2, mapHeight - visibleHeight)
  );

  const handleWheel = (e) => {
    e.preventDefault();
    setZoomLevel(prev => {
      const nextZoom = e.deltaY < 0 ? prev + 0.1 : prev - 0.1;
      return Math.max(0.8, Math.min(nextZoom, 2));
    });
  };

  return (
    <div className="game-map-wrapper" onWheel={handleWheel}>
      <div
        className="game-map"
        style={{
          width: mapWidth,
          height: mapHeight,
          transform: `translate(${-offsetX}px, ${-offsetY}px) scale(${zoomLevel})`,
          transformOrigin: 'top left',
          position: 'relative'
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
                position: 'absolute'
              }}
            >
              <img 
                src={getCellIcon(cell.type)} 
                alt={cell.type} 
                className="cell-image"
                width={tileSize}
                height={tileSize}
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
            height: tileSize,
            position: 'absolute'
          }}
        >
          🧑‍🦲
        </div>

        {/* 다른 플레이어들 */}
        {players
          .filter(p => p.playerId !== currentPlayer.playerId)
          .map(p => (
            <div
              key={p.playerId}
              className="player-icon"
              style={{
                transform: `translate(${p.position.x * cellSize}px, ${p.position.y * cellSize}px)`
              }}
            >
              👤
            </div>
          ))
        }
      </div>
    </div>
  );
}

// 인벤토리 바 컴포넌트
function Hotbar({ selectedSlot, inventory }) {
  // inventory 배열이 비어있으면 빈 슬롯 표시
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
            <div className="slot-icon">{item?.icon || ''}</div>
            <div className="slot-name">{item?.name || ''}</div>
          </div>
        );
      })}
    </div>
  );
}

// 인벤토리 모달 컴포넌트
function InventoryModal({ inventory, onClose }) {
  return (
    <div className="inventory-modal-backdrop" onClick={onClose}>
      <div className="inventory-modal" onClick={e => e.stopPropagation()}>
        <h2>인벤토리</h2>
        {inventory.length === 0 ? (
          <p>인벤토리가 비어 있습니다.</p>
        ) : (
          <ul>
            {inventory.map((item, idx) => (
              <li key={idx}>
                {item.icon} {item.name} x{item.count || 1}
              </li>
            ))}
          </ul>
        )}
        <button onClick={onClose}>닫기</button>
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