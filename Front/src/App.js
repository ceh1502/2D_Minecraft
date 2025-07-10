import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001');

function App() {
  const [connected, setConnected] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      console.log('서버 연결됨:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('서버 연결 끊김');
      setConnected(false);
    });

    socket.on('test-response', (data) => {
      console.log('서버 응답:', data);
      setServerMessage(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendTestMessage = () => {
    socket.emit('test-message', 'Hello from React!');
  };

  return (
    <div>
      <h1>마인크래프트 건설 게임</h1>
      <p>소켓 상태: {connected ? '연결됨 🟢' : '연결 안됨 🔴'}</p>
      <button onClick={sendTestMessage}>서버 테스트</button>
      <p>서버 응답: {serverMessage}</p>
    </div>
  );
}

export default App;