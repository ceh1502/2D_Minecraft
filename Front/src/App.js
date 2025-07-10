import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  useEffect(() => {
    console.log('Socket 연결 시도 중...');
    
    // Socket 연결 생성
    const newSocket = io('http://localhost:5001', {
      autoConnect: true,
      reconnection: true
    });
    
    setSocket(newSocket);

    // 연결 이벤트
    newSocket.on('connect', () => {
      console.log('✅ 서버 연결됨:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ 서버 연결 끊김:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.log('🚨 연결 에러:', error);
      setConnected(false);
    });

    newSocket.on('test-response', (data) => {
      console.log('📨 서버 응답:', data);
      setServerMessage(data.message);
    });

    // 정리 함수
    return () => {
      console.log('Socket 연결 정리');
      newSocket.close();
    };
  }, []); // 빈 의존성 배열

  const sendTestMessage = () => {
    if (socket && connected) {
      console.log('📤 테스트 메시지 전송');
      socket.emit('test-message', 'Hello from React!');
    } else {
      console.log('❌ Socket이 연결되지 않음');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>🎮 마인크래프트 건설 게임</h1>
      <div style={{ marginBottom: '20px' }}>
        <p>소켓 상태: {connected ? '연결됨 🟢' : '연결 안됨 🔴'}</p>
        <p>Socket ID: {socket?.id || '연결 중...'}</p>
      </div>
      <button onClick={sendTestMessage} disabled={!connected}>
        서버 테스트
      </button>
      <div style={{ marginTop: '20px' }}>
        <p>서버 응답: {serverMessage || '응답 없음'}</p>
      </div>
    </div>
  );
}

export default App;