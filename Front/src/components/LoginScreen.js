import React, { useState } from 'react';
import '../styles/LoginScreen.css';

const LoginScreen = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // API URL 결정
  const getApiUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (hostname === 'minecrafton.store' || hostname === 'www.minecrafton.store') {
      return `${protocol}//${hostname}`;
    } else {
      return 'http://localhost:5001';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = getApiUrl();
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ ${isLogin ? '로그인' : '회원가입'} 성공:`, data.user);
        
        if (isLogin) {
          // 로그인인 경우 토큰과 사용자 정보를 localStorage에 저장
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('currentUser', JSON.stringify(data.user));
          
          // 로그인 성공 콜백 호출
          onLoginSuccess({ token: data.token, user: data.user });
        } else {
          // 회원가입인 경우 로그인 화면으로 전환
          setIsLogin(true);
          setFormData({ username: '', email: '', password: '' });
          setError('');
          // 성공 메시지 표시
          alert('회원가입이 완료되었습니다! 로그인해주세요.');
        }
      } else {
        setError(data.message || '오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('인증 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    setLoading(true);
    setError('');
    
    // 게스트 사용자 정보 생성
    const guestUser = {
      id: `guest_${Date.now()}`,
      username: `Guest_${Math.random().toString(36).substr(2, 6)}`,
      email: 'guest@example.com',
      isGuest: true,
      score: 0
    };
    
    // 게스트 토큰 생성 (단순히 사용자 ID 기반)
    const guestToken = `guest_token_${guestUser.id}`;
    
    console.log('🎭 게스트 로그인:', guestUser);
    
    // 게스트 로그인 시에도 localStorage에 저장
    localStorage.setItem('authToken', guestToken);
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    
    // 로그인 성공 콜백 호출
    setTimeout(() => {
      onLoginSuccess({ token: guestToken, user: guestUser });
    }, 1000);
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="game-title">
          <h1>🎮 마인크래프트</h1>
          <p>2D 마인크래프트 멀티플레이어 게임</p>
        </div>

        <div className="login-form">
          <div className="form-tabs">
            <button 
              className={`tab-button ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              로그인
            </button>
            <button 
              className={`tab-button ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <label htmlFor="username">사용자명</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  minLength={3}
                  maxLength={20}
                  placeholder="3-20자 사용자명"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="이메일 주소"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={6}
                placeholder="6자 이상 비밀번호"
              />
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
            </button>
          </form>

          <div className="divider">
            <span>또는</span>
          </div>

          <button 
            className="guest-login-btn"
            onClick={handleGuestLogin}
            disabled={loading}
          >
            <span>게스트로 플레이</span>
          </button>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        <div className="login-info">
          <h3>🏆 게임 특징</h3>
          <ul>
            <li>실시간 멀티플레이어</li>
            <li>블록 채굴 및 건설</li>
            <li>밤에 등장하는 몬스터</li>
            <li>랭킹 시스템</li>
            <li>아이템 상점</li>
            <li>실시간 날씨 효과</li>
          </ul>
        </div>

        <div className="controls-info">
          <h3>🎮 조작법</h3>
          <div className="controls-grid">
            <div>이동: WASD</div>
            <div>채굴: J</div>
            <div>설치: K</div>
            <div>공격: L</div>
            <div>인벤토리: E</div>
            <div>슬롯 선택: 1-5</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;