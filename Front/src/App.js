import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { InventoryModal, InventoryGrid, Hotbar, getCurrentToolType} from './components/InventoryUI'
import ShopModal from './components/ShopModal';
import HealthBar from './components/HealthBar';
import LoginScreen from './components/LoginScreen';
import RankingBoard from './components/RankingBoard';
import ChatBox from './components/ChatBox';
import './App.css';

// 🔧 상단으로 빼낸 공통 함수들

// 아이템 타입별 이모지 아이콘 반환 헬퍼 함수
const getIconForItem = (type) => {
  switch (type) {
    case 'tree': return '/images/blocks/tree.png';
    case 'stone': return '/images/blocks/stone.png';
    case 'iron': return '/images/blocks/iron.png';
    case 'diamond': return '/images/blocks/dia.png';
    // 울타리 아이템 추가
    case 'barbed_wire': return '/images/blocks/barbed_wire.png';
    case 'wooden_fence': return '/images/blocks/wooden_fence.png';
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
    // 🥩 고기 아이템 추가
    case 'beef': return '/images/items/beef.png';
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

const PLACEABLE_BLOCKS = ['tree', 'stone', 'iron', 'diamond', 'barbed_wire', 'wooden_fence'];

// 🔧 인벤토리 변환 함수 (상단으로 이동)
const convertInventoryToArray = (inventoryObj, prevInventory = []) => {
  const newInventory = new Array(20).fill(null);
  const itemTypesInObj = Object.keys(inventoryObj).filter(type => inventoryObj[type] > 0);
  const processedTypes = new Set();

  // 1. Place items that were already in the inventory, in their old positions
  for (let i = 0; i < prevInventory.length; i++) {
    const item = prevInventory[i];
    if (item && inventoryObj[item.name] > 0) {
      newInventory[i] = {
        ...item,
        count: inventoryObj[item.name],
      };
      processedTypes.add(item.name);
    }
  }

  // 2. Place new items in the first available slots
  let nextSlot = 0;
  for (const type of itemTypesInObj) {
    if (!processedTypes.has(type)) {
      // Find the next empty slot
      while (newInventory[nextSlot] !== null && nextSlot < newInventory.length) {
        nextSlot++;
      }
      
      if (nextSlot < newInventory.length) {
        newInventory[nextSlot] = {
          name: type,
          count: inventoryObj[type],
          icon: getIconForItem(type),
        };
        processedTypes.add(type);
      }
    }
  }

  return newInventory;
};

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [monsters, setMonsters] = useState([]);
  const [phase, setPhase] = useState('day');
  const [isDead, setIsDead] = useState(false);
  const [isDamaged, setIsDamaged] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackingMonsterId, setAttackingMonsterId] = useState(null);
  const [equippedArmor, setEquippedArmor] = useState({
    helmet: null,
    chest: null,
    leggings: null,
    boots: null,
  });
  
  // 💬 채팅 시스템
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);
  
  // 🔐 인증 시스템
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  
  // 🏆 랭킹 시스템
  const [ranking, setRanking] = useState([]);
  const [userScore, setUserScore] = useState(0);
  
  // ✅ 닉네임 시스템 (호환성 유지)
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

  // 🔐 로그인 처리
  const handleLoginSuccess = ({ user, token }) => {
    console.log('🔐 로그인 성공 처리 시작:', { user, token });
    
    setCurrentUser(user);
    setAuthToken(token);
    setIsLoggedIn(true);
    setPlayerName(user.name);
    setIsNameSet(true);
    setUserScore(user.score || 0);
    
    console.log('✅ 로그인 성공 완료:', user);
    console.log('🎯 isNameSet 설정됨, Socket 연결이 시작될 예정');
  };

  // 💬 채팅 토글 함수
  const toggleChat = () => {
    setIsChatVisible(prev => !prev);
  };

  // 동적 API URL 결정
  const getApiUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname === 'minecrafton.store' || hostname === 'www.minecrafton.store') {
      // 프로덕션에서는 nginx가 프록시하므로 포트 없이
      return `${protocol}//${hostname}`;
    } else {
      // 로컬 개발환경에서는 백엔드 포트 직접 연결
      return 'http://localhost:5001';
    }
  };

  // 🏆 랭킹 데이터 가져오기
  const fetchRanking = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/ranking`);
      const data = await response.json();
      if (data.success) {
        setRanking(data.ranking);
      }
    } catch (error) {
      console.error('❌ 랭킹 조회 실패:', error);
    }
  }, []);

  // 초기 로그인 상태 확인
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    // 🔍 URL에 OAuth 리다이렉션 파라미터가 있으면 localStorage 무시
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.get('token') || urlParams.get('error');
    
    if (hasOAuthParams) {
      console.log('🔄 OAuth 리다이렉션 감지 - localStorage 무시');
      return; // LoginScreen에서 처리하도록 함
    }
    
    if (savedToken && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log('💾 저장된 로그인 정보 복원:', user.name);
        setCurrentUser(user);
        setAuthToken(savedToken);
        setIsLoggedIn(true);
        setPlayerName(user.name);
        setIsNameSet(true);
        setUserScore(user.score || 0);
      } catch (error) {
        console.error('저장된 로그인 정보 복원 실패:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  // 주기적으로 랭킹 업데이트
  useEffect(() => {
    if (isLoggedIn) {
      fetchRanking();
      const interval = setInterval(fetchRanking, 30000); // 30초마다
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, fetchRanking]);

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
    const itemDataString = e.dataTransfer.getData('application/json');

    if (!itemDataString) {
      // 기존의 draggedItem 상태를 사용하는 폴백 로직
      if (draggedItem === null || draggedFromIndex === null) return;
      if (draggedFromIndex === targetIndex) {
        setDraggedItem(null);
        setDraggedFromIndex(null);
        return;
      }
      
      setGameState(prev => {
        const newInventory = [...prev.inventory];
        const targetItem = newInventory[targetIndex];
        newInventory[draggedFromIndex] = targetItem;
        newInventory[targetIndex] = draggedItem;
        return { ...prev, inventory: newInventory };
      });

    } else {
      // dataTransfer를 사용하는 새로운 로직
      const { item, from, index: fromIndex, slotType } = JSON.parse(itemDataString);

      if (from === 'armor') {
        // 갑옷 벗기: 갑옷 슬롯 -> 인벤토리
        if (gameStateRef.current.inventory[targetIndex] === null) {
          handleUnequipArmor(slotType);
        }
      } else if (from === 'inventory') {
        // 인벤토리 내 아이템 교환
        if (fromIndex === targetIndex) return;
        
        setGameState(prev => {
          const newInventory = [...prev.inventory];
          const sourceItem = newInventory[fromIndex];
          const destinationItem = newInventory[targetIndex];
          
          newInventory[targetIndex] = sourceItem;
          newInventory[fromIndex] = destinationItem;
          
          return { ...prev, inventory: newInventory };
        });
      }
    }
    
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
        const solidBlocks = ['stone', 'tree', 'iron_ore', 'diamond', 'barbed_wire', 'wooden_fence'];
        
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

  const tryAttackMonster = useCallback(() => {
    if (!socket || !connected) return;

    const player = gameStateRef.current.currentPlayer;
    const direction = gameStateRef.current.direction;
    const monsters = gameStateRef.current.monsters;

    if (!player || !monsters) return;

    let targetX = player.position.x;
    let targetY = player.position.y;

    switch (direction) {
      case 'up': targetY -= 1; break;
      case 'down': targetY += 1; break;
      case 'left': targetX -= 1; break;
      case 'right': targetX += 1; break;
    }

    const targetMonster = monsters.find(m => m.position.x === targetX && m.position.y === targetY);

    if (targetMonster) {
      // 공격 애니메이션 트리거
      setIsAttacking(true);
      setTimeout(() => setIsAttacking(false), 300); // 0.3초 지속

      socket.emit('attack-monster', { monsterId: targetMonster.id });
    }
  }, [socket, connected]);

  // 게임 초기화
  useEffect(() => {
    console.log('🔍 Socket useEffect 실행됨:', { 
      isNameSet, 
      playerName, 
      authToken: !!authToken,
      isLoggedIn 
    });
    
    if (!isNameSet) {
      console.log('⏸️ 소켓 연결 대기 중... isNameSet:', isNameSet);
      return;
    }
    
    console.log('🎮 게임 시작!');
    
    const SERVER_URL = getApiUrl();
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
      
      // 연결 성공 후 바로 방 생성/입장 시도
      console.log('🏠 방 생성 요청: main_room');
      newSocket.emit('create-room', 'main_room');
      
      setTimeout(() => {
        const joinData = {
          roomId: 'main_room',
          username: playerName,
          token: authToken // JWT 토큰 추가
        };
        console.log('🚪 방 입장 요청:', joinData);
        newSocket.emit('join-room', joinData);
      }, 500);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ 서버 연결 실패:', error);
      setConnected(false);
      
      // 연결 실패 시 재시도
      setTimeout(() => {
        console.log('🔄 서버 재연결 시도...');
        newSocket.connect();
      }, 3000);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 연결 끊김:', reason);
      setConnected(false);
    });

    // 🎯 방 입장 성공 - 내 플레이어 정보 확실히 설정
    newSocket.on('player-joined', (data) => {
      console.log('🏠 플레이어 입장 데이터:', data);
      
      // 데이터 구조 확인 및 처리
      if (data.player && data.player.playerId === newSocket.id) {
        // 내가 방에 입장한 경우
        console.log('👤 내 플레이어 정보:', data.player);
        
        setGameState(prev => ({
          ...prev,
          currentPlayer: data.player
        }));
        
        // 맵 데이터 요청
        console.log('🗺️ 맵 데이터 요청');
        newSocket.emit('request-map');
      } else if (data.player) {
        // 다른 플레이어가 입장한 경우 - 게임 상태에 추가
        console.log('👥 다른 플레이어 입장:', data.player);
        
        setGameState(prev => {
          // 이미 존재하는 플레이어인지 확인
          const existingIndex = prev.players.findIndex(p => p.playerId === data.player.playerId);
          
          if (existingIndex === -1) {
            // 새로운 플레이어 추가
            return {
              ...prev,
              players: [...prev.players, data.player]
            };
          } else {
            // 기존 플레이어 정보 업데이트
            const updatedPlayers = [...prev.players];
            updatedPlayers[existingIndex] = { ...updatedPlayers[existingIndex], ...data.player };
            return {
              ...prev,
              players: updatedPlayers
            };
          }
        });
      }
    });

    // 🎯 기존 플레이어들 정보 받기 (새로 입장할 때)
    newSocket.on('existing-players', (existingPlayers) => {
      console.log('👥 기존 플레이어들:', existingPlayers);
      
      setGameState(prev => ({
        ...prev,
        players: existingPlayers
      }));
    });

    // 🎯 방 입장 완료 이벤트
    newSocket.on('room-joined', (data) => {
      console.log('🏠 방 입장 완료:', data);
      
      if (data.success && data.yourPlayer) {
        setGameState(prev => ({
          ...prev,
          currentPlayer: data.yourPlayer
        }));
        
        // 맵 데이터 요청
        console.log('🗺️ 맵 데이터 요청');
        newSocket.emit('request-map');
      }
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
            ? convertInventoryToArray(newInventory, prev.inventory)
            : prev.inventory
        };
      });
    });

    newSocket.on('mining-error', (data) => {
      console.log('❌ 채굴 에러:', data.message);
    });

    newSocket.on('phase-changed', ({ phase }) => {
      setPhase(phase);
    });

    newSocket.on('monsters-updated', ({ monsters }) => {
      setMonsters(monsters);
      setGameState(prev => ({
        ...prev,
        monsters: monsters
      }));
    });

    newSocket.on('monster-attacking', ({ monsterId }) => {
      setAttackingMonsterId(monsterId);
      setTimeout(() => setAttackingMonsterId(null), 400); // 애니메이션 시간에 맞춰 초기화
    });

    newSocket.on('player-updated', ({ playerId, updated }) => {
      if (playerId === newSocket.id) {
        setGameState(prev => ({
          ...prev,
          inventory: convertInventoryToArray(updated.inventory, prev.inventory),
          currentPlayer: {
            ...prev.currentPlayer,
            ...updated
          }
        }));
        setEquippedArmor(updated.equippedArmor);
      } else {
        setGameState(prev => ({
          ...prev,
          players: prev.players.map(p => p.playerId === playerId ? { ...p, ...updated } : p)
        }));
      }
    });

    newSocket.on('player-damaged', ({ newHealth }) => {
      if (newHealth <= 0) {
        setIsDead(true);
      }
      setGameState(prev => ({
        ...prev,
        currentPlayer: {
          ...prev.currentPlayer,
          health: newHealth
        }
      }));

      // 피격 효과
      setIsDamaged(true);
      setTimeout(() => setIsDamaged(false), 200);
    });

    newSocket.on('player-restarted', (data) => {
      setIsDead(false);
      setGameState(prev => ({
        ...prev,
        currentPlayer: data.player,
        players: prev.players.map(p => p.playerId === data.player.playerId ? data.player : p),
        inventory: convertInventoryToArray(data.player.inventory, [])
      }));
    });

    // 🏆 점수 업데이트 이벤트
    newSocket.on('score-updated', ({ newScore, pointsAdded }) => {
      console.log(`🎯 점수 업데이트: +${pointsAdded} (총 ${newScore}점)`);
      setUserScore(newScore);
      
      // 현재 사용자 정보 업데이트
      if (currentUser) {
        const updatedUser = { ...currentUser, score: newScore };
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }
    });

    // 🏆 랭킹 업데이트 이벤트
    newSocket.on('ranking-updated', ({ ranking }) => {
      console.log('🏆 랭킹 업데이트:', ranking);
      setRanking(ranking);
    });

    // 방 생성 성공
    newSocket.on('room-created', (data) => {
      console.log('✅ 방 생성 성공:', data);
    });

    newSocket.on('room-error', (data) => {
      console.error('🏠 방 에러:', data.message);
      // 에러 발생 시에도 게임을 계속할 수 있도록 방 입장 재시도
      setTimeout(() => {
        console.log('🔄 방 입장 재시도...');
        newSocket.emit('join-room', {
          roomId: 'main_room',
          username: playerName,
          token: authToken
        });
      }, 1000);
    });

    return () => {
      console.log('🔌 소켓 연결 종료');
      newSocket.close();
    };
  }, [isNameSet, playerName, authToken]);

  // 거래 관련 이벤트 수신
  useEffect(() => {
    if (!socket) return;

    const handleTradeSuccess = (data) => {
      console.log('✅ 거래 성공:', data);
      console.log('🧪 서버가 준 인벤토리:', data.newInventory);

      // 예: 받은 아이템 인벤토리에 반영
      setGameState((prev) => ({
        ...prev,
        inventory: convertInventoryToArray(data.newInventory, prev.inventory),
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
  const handleEquipArmor = useCallback((item, slotType) => {
    if (socket) {
      socket.emit('equip-armor', { itemName: item.name, slotType });
    }
    // 드래그 상태 초기화
    setDraggedItem(null);
    setDraggedFromIndex(null);
  }, [socket]);

  const handleUnequipArmor = useCallback((slotType) => {
    if (socket) {
      socket.emit('unequip-armor', { slotType });
    }
    // 드래그 상태 초기화
    setDraggedItem(null);
    setDraggedFromIndex(null);
  }, [socket]);

  useEffect(() => {
    const pressedKeys = new Set();

    const handleKeyDown = (e) => {
      if (draggedItem !== null) return;
      if (!socket || !connected) return;
      if (pressedKeys.has(e.key.toLowerCase())) return;
      // 채팅 입력 중이면 게임 조작키 비활성화
      if (isChatFocused) return;
      
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

      if (key === 'l') {
        tryAttackMonster();
      }

      // F키로 아이템 사용 (고기 먹기)
      if (key === 'f') {
        const selectedItem = gameStateRef.current.inventory[gameStateRef.current.selectedSlot];
        if (selectedItem && selectedItem.name === 'beef') {
          socket.emit('use-item', { itemName: 'beef' });
        }
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
  }, [socket, connected, tryMineBlock, tryPlaceBlock, tryAttackMonster, draggedItem, isChatFocused]);

  // 🔐 로그인 화면 (가장 먼저 체크)
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
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

  if (isDead) {
    return (
      <div className="death-screen">
        <h1>You Died</h1>
        <button onClick={() => socket.emit('restart-game')}>
          Restart Game
        </button>
      </div>
    );
  }

  return (
    <div
      className={`game-container ${isDamaged ? 'shake' : ''} ${phase === 'night' ? 'night' : ''}`}
      id="game-root"
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div className="game-view">
        <GameMap 
          mapData={gameState.mapData}
          players={gameState.players}
          monsters={monsters}
          currentPlayer={gameState.currentPlayer}
          direction={gameState.direction}
          isDamaged={isDamaged}
          isAttacking={isAttacking}
          inventory={gameState.inventory}
          selectedSlot={gameState.selectedSlot}
          attackingMonsterId={attackingMonsterId}
          phase={phase}
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
          equippedArmor={equippedArmor}
          onClose={() =>
            setGameState(prev => ({ ...prev, isInventoryOpen: false }))
          }
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onEquip={handleEquipArmor}
          onUnequip={handleUnequipArmor}
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
        <p>🎮 이동: WASD | 인벤토리: 1-5 | 채굴: J | 설치: K | 공격: L | 섭취: F</p>
      </div>

      <button className="shop-button" onClick={() => setIsShopOpen(true)}>
        <img src="/images/blocks/craft.png" alt="상점" style={{ width: 48, height: 48 }} />
      </button>

      <HealthBar 
        health={gameState.currentPlayer?.health ?? 20} 
        maxHealth={gameState.currentPlayer?.maxHealth ?? 20} 
      />

      <div className="phase-indicator">
        {phase === 'day' ? '☀️' : '🌙'}
      </div>

      {/* 🏆 랭킹보드 */}
      <RankingBoard 
        currentUser={currentUser}
        ranking={ranking}
        isVisible={true}
      />

      {/* 💬 채팅 시스템 */}
      <ChatBox 
        socket={socket}
        currentUser={currentUser}
        isVisible={isChatVisible}
        onToggle={toggleChat}
        onChatFocusChange={setIsChatFocused}
      />
    </div>
  );
}

function GameMap({ mapData, players, monsters, currentPlayer, direction, isDamaged, isAttacking, inventory, selectedSlot, attackingMonsterId }) {
  const [zoomLevel, setZoomLevel] = useState(2.5);
  
  if (!mapData || !currentPlayer) return null;

  // Get selected tool
  const selectedItem = inventory?.[selectedSlot];
  const isTool = selectedItem && (
    selectedItem.name.includes('pickaxe') ||
    selectedItem.name.includes('sword') ||
    selectedItem.name.includes('axe')
  );

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
            className={`${isDamaged ? 'player-damaged' : ''} ${isAttacking ? 'player-attacking' : ''}`}
            style={{
              border: '2px solid lime', // 내 캐릭터 테두리
              position: 'relative',
              zIndex: 2
            }}
          />
          
          {/* 🗡️ 들고 있는 도구 */}
          {isTool && (
            <img
              src={getIconForItem(selectedItem.name)}
              alt="tool"
              className={`player-tool direction-${direction} ${isAttacking ? 'attack-animation' : ''}`}
              style={{
                width: tileSize,
                height: tileSize,
              }}
            />
          )}

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

        {monsters.map(m => (
          <div
            key={m.id}
            className={`monster-icon ${attackingMonsterId === m.id ? 'attacking' : ''}`}
            style={{
              left: m.position.x * cellSize,
              top: m.position.y * cellSize,
              width: tileSize,
              height: tileSize
            }}
          >
            <img
              src={getMonsterImage(m.type)}
              alt={m.type}
              width={tileSize}
              height={tileSize}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function getCellIcon(type) {
  const validTypes = ['grass', 'tree', 'stone', 'iron_ore', 'diamond', 'barbed_wire', 'wooden_fence'];
  if (validTypes.includes(type)) {
    return `/images/blocks/${type}.png`;
  }
  return '';
}

function getMonsterImage(type) {
  switch (type) {
    case 'zombie': return '/images/characters/zombie.png';
    default: return '';
  }
}

export default App;
