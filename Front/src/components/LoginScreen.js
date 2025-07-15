import React, { useState } from 'react';
import '../styles/LoginScreen.css';

const LoginScreen = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      setError('사용자명과 비밀번호를 모두 입력해주세요.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 동적 API URL 결정
      const getApiURL = () => {
        const currentHost = window.location.hostname;
        const protocol = window.location.protocol;
        
        if (currentHost === 'minecrafton.store' || currentHost === 'www.minecrafton.store') {
          return `${protocol}//${currentHost}/api`;
        } else {
          return 'http://localhost:5001/api';
        }
      };
      
      const response = await fetch(`${getApiURL()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // 로그인 성공
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        onLoginSuccess({ token: data.token, user: data.user });
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('로그인 에러:', error);
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 동적 API URL 결정
      const getApiURL = () => {
        const currentHost = window.location.hostname;
        const protocol = window.location.protocol;
        
        if (currentHost === 'minecrafton.store' || currentHost === 'www.minecrafton.store') {
          return `${protocol}//${currentHost}/api`;
        } else {
          return 'http://localhost:5001/api';
        }
      };
      
      const response = await fetch(`${getApiURL()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // 회원가입 성공, 자동 로그인
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        onLoginSuccess({ token: data.token, user: data.user });
      } else {
        setError(data.error || '회원가입에 실패했습니다.');
      }
    } catch (error) {
      console.error('회원가입 에러:', error);
      setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    // 게스트 로그인 (기존 방식)
    const guestUser = {
      id: 'guest_' + Date.now(),
      name: `게스트${Math.floor(Math.random() * 1000)}`,
      email: null,
      profilePicture: '/images/characters/avatar_down.png',
      score: 0,
      isGuest: true
    };
    
    // 게스트 정보도 로컬스토리지에 저장 (세션 유지용)
    localStorage.setItem('currentUser', JSON.stringify(guestUser));
    
    onLoginSuccess({ user: guestUser, token: null });
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
              className={`tab-btn ${!isRegistering ? 'active' : ''}`}
              onClick={() => setIsRegistering(false)}
              disabled={loading}
            >
              로그인
            </button>
            <button 
              className={`tab-btn ${isRegistering ? 'active' : ''}`}
              onClick={() => setIsRegistering(true)}
              disabled={loading}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            <div className="form-group">
              <input
                type="text"
                name="username"
                placeholder="사용자명"
                value={formData.username}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
            </div>

            {isRegistering && (
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="이메일"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <input
                type="password"
                name="password"
                placeholder="비밀번호"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
            </div>

            {isRegistering && (
              <div className="form-group">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="비밀번호 확인"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  disabled={loading}
                  required
                />
              </div>
            )}

            <button 
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading ? '처리 중...' : (isRegistering ? '회원가입' : '로그인')}
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