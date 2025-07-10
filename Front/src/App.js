import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState({
    mapData: null,
    players: [],
    currentPlayer: null,
    selectedSlot: 0
  });

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
        players: data.allPlayers
      }));
    });

    // 플레이어 이동
    newSocket.on('player-moved', (data) => {
      setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => 
          p.playerId === data.playerId 
            ? { ...p, position: data.position }
            : p
        ),
        currentPlayer: prev.currentPlayer?.playerId === data.playerId
          ? { ...prev.currentPlayer, position: data.position }
          : prev.currentPlayer
      }));
    });

    return () => newSocket.close();
  }, []);

  // 키보드 컨트롤
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!socket || !connected) return;

      // WASD 이동
      const moveKeys = {
        'w': 'up', 'W': 'up',
        's': 'down', 'S': 'down',
        'a': 'left', 'A': 'left',
        'd': 'right', 'D': 'right'
      };

      if (moveKeys[e.key]) {
        socket.emit('move-player', moveKeys[e.key]);
      }

      // 1-5 인벤토리 슬롯
      const slotKeys = ['1', '2', '3', '4', '5'];
      const slotIndex = slotKeys.indexOf(e.key);
      if (slotIndex !== -1) {
        setGameState(prev => ({ ...prev, selectedSlot: slotIndex }));
        socket.emit('change-hotbar-slot', slotIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [socket, connected]);

  const handleCellClick = (x, y) => {
    console.log(`📍 셀 클릭: (${x}, ${y})`);
    // 나중에 자원 수집 추가
  };

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
    <div className="game-container">
      {/* 메인 게임 화면 */}
      <div className="game-view">
        <GameMap 
          mapData={gameState.mapData}
          players={gameState.players}
          currentPlayer={gameState.currentPlayer}
          onCellClick={handleCellClick}
        />
      </div>

      {/* 하단 인벤토리 */}
      <div className="inventory-bar">
        <Hotbar 
          selectedSlot={gameState.selectedSlot}
        />
      </div>

      {/* 컨트롤 가이드 */}
      <div className="controls-guide">
        <p>🎮 이동: WASD | 인벤토리: 1-5</p>
      </div>
    </div>
  );
}

// 게임 맵 컴포넌트
function GameMap({ mapData, players, currentPlayer, onCellClick }) {
  if (!mapData) return null;

  return (
    <div className="game-map">
      {mapData.cells.map((row, y) => 
        row.map((cell, x) => (
          <div 
            key={`${x}-${y}`}
            className={`map-cell ${cell.type}`}
            onClick={() => onCellClick(x, y)}
          >
            {getCellIcon(cell.type)}
            
            {/* 플레이어 표시 */}
            {players.map(player => 
              player.position.x === x && player.position.y === y ? (
                <div 
                  key={player.playerId}
                  className={`player ${player.playerId === currentPlayer?.playerId ? 'current-player' : 'other-player'}`}
                >
                  🧑‍🦲
                </div>
              ) : null
            )}
          </div>
        ))
      )}
    </div>
  );
}

// 인벤토리 바 컴포넌트
function Hotbar({ selectedSlot }) {
  const hotbarItems = [
    { icon: '⛏️', name: 'Pickaxe' },
    { icon: '🪓', name: 'Axe' },
    { icon: '⚔️', name: 'Sword' },
    { icon: '🍖', name: 'Food' },
    { icon: '🕯️', name: 'Torch' }
  ];

  return (
    <div className="hotbar">
      {hotbarItems.map((item, index) => (
        <div 
          key={index}
          className={`hotbar-slot ${selectedSlot === index ? 'selected' : ''}`}
        >
          <div className="slot-number">{index + 1}</div>
          <div className="slot-icon">{item.icon}</div>
          <div className="slot-name">{item.name}</div>
        </div>
      ))}
    </div>
  );
}

// 셀 아이콘 함수
function getCellIcon(type) {
  const icons = {
    grass: '🌱',
    tree: '🌳',
    stone: '⛰️',
    iron_ore: '⚒️',
    coal: '⚫'
  };
  return icons[type] || '';
}

export default App;