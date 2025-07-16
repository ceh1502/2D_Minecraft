import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/ChatBox.css';

const ChatBox = ({ socket, currentUser, isVisible, onToggle, onChatFocusChange }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 채팅 포커스 상태를 부모 컴포넌트에 전달
  useEffect(() => {
    if (onChatFocusChange) {
      onChatFocusChange(isInputFocused);
    }
  }, [isInputFocused, onChatFocusChange]);

  // 메시지 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (!socket) return;

    // 채팅 메시지 수신
    socket.on('chat-message', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        username: data.username,
        message: data.message,
        timestamp: new Date().toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isOwn: data.playerId === socket.id
      }]);
    });

    // 시스템 메시지 수신
    socket.on('system-message', (data) => {
      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        username: 'System',
        message: data.message,
        timestamp: new Date().toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isSystem: true
      }]);
    });

    return () => {
      socket.off('chat-message');
      socket.off('system-message');
    };
  }, [socket]);

  // 메시지 전송
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() || !socket || !currentUser) return;

    socket.emit('send-chat-message', {
      message: inputText.trim(),
      username: currentUser.name,
      playerId: socket.id
    });

    setInputText('');
    // 메시지 전송 후 채팅창을 닫지 않고 포커스 유지
    inputRef.current?.focus();
  }, [inputText, socket, currentUser]);

  // 엔터 키 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 다른 입력 필드에 포커스가 있으면 무시
      if (e.target.tagName === 'INPUT' && e.target !== inputRef.current) {
        return;
      }
      
      if (e.key === 'Enter') {
        e.preventDefault(); // 기본 동작 방지
        
        if (!isVisible) {
          // 채팅창이 닫혀있으면 열기
          onToggle();
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        } else if (isInputFocused) {
          // 채팅 입력 중이면 메시지 전송
          handleSendMessage();
        } else {
          // 채팅창이 열려있으면 입력 포커스
          inputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault(); // 기본 동작 방지
        
        if (isVisible) {
          // ESC로 채팅창 닫기
          onToggle();
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, isInputFocused, onToggle, handleSendMessage]);

  if (!isVisible) {
    return (
      <div className="chat-indicator">
        <span>💬 Press Enter to chat</span>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span>💬 Chat</span>
        <button className="chat-close" onClick={onToggle}>×</button>
      </div>
      
      <div className="chat-messages">
        {messages.map(msg => (
          <div 
            key={msg.id} 
            className={`chat-message ${msg.isOwn ? 'own' : ''} ${msg.isSystem ? 'system' : ''}`}
          >
            <span className="chat-timestamp">{msg.timestamp}</span>
            <span className="chat-username">{msg.username}:</span>
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Type a message... (Enter to send, ESC to close)"
          className="chat-input"
          maxLength={100}
        />
        <button 
          onClick={handleSendMessage}
          className="chat-send-btn"
          disabled={!inputText.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBox;