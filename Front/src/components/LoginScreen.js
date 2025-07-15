import React, { useState, useEffect } from 'react';
import '../styles/LoginScreen.css';

const LoginScreen = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // URL에서 토큰과 사용자 정보 확인 (OAuth 리다이렉트 후)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');

    if (errorParam) {
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      // URL에서 에러 파라미터 제거
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        
        // 토큰과 사용자 정보를 로컬스토리지에 저장
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // URL에서 파라미터 제거
        window.history.replaceState({}, document.title, window.location.pathname);
        
        console.log('✅ OAuth 로그인 성공:', user);
        
        // 로그인 성공 콜백 호출
        onLoginSuccess({ token, user });
      } catch (err) {
        console.error('사용자 정보 파싱 에러:', err);
        setError('로그인 정보 처리 중 오류가 발생했습니다.');
        // URL에서 파라미터 제거
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [onLoginSuccess]);

  // OAuth 사용 가능 여부 확인
  const isOAuthAvailable = () => {
    const currentHost = window.location.hostname;
    return (
      currentHost === 'localhost' || 
      currentHost === '127.0.0.1' || 
      currentHost === 'minecrafton.store' || currentHost === 'www.minecrafton.store'
    );
  };

  const handleGoogleLogin = () => {
    if (!isOAuthAvailable()) {
      setError('Google OAuth는 localhost 또는 minecrafton.store에서만 사용 가능합니다.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // 동적 OAuth URL 결정
    const getOAuthURL = () => {
      const currentHost = window.location.hostname;
      const protocol = window.location.protocol;
      
      if (currentHost === 'minecrafton.store' || currentHost === 'www.minecrafton.store') {
        // 프로덕션 환경 - 도메인과 같은 서버 사용
        return `${protocol}//${currentHost}/auth/google`;
      } else {
        // 로컬 개발 환경
        return 'http://localhost:5001/auth/google';
      }
    };
    
    const oauthURL = getOAuthURL();
    console.log('🔗 OAuth URL:', oauthURL);
    
    // Google OAuth 로그인 페이지로 이동
    window.location.href = oauthURL;
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

        <div className="login-options">
          <button 
            className={`google-login-btn ${!isOAuthAvailable() ? 'disabled' : ''}`}
            onClick={handleGoogleLogin}
            disabled={loading || !isOAuthAvailable()}
            title={!isOAuthAvailable() ? 'Google OAuth는 localhost 또는 minecrafton.store에서만 사용 가능' : 'Google 계정으로 로그인'}
          >
            <img 
              src="/images/icons/google-icon.png" 
              alt="Google" 
              className="google-icon"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <span>
              {isOAuthAvailable() ? 'Google로 로그인' : 'Google로 로그인 (도메인 제한)'}
            </span>
            {loading && <div className="loading-spinner"></div>}
          </button>

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
            <li>랭킹 시스템 (게스트도 가능!)</li>
            <li>아이템 상점</li>
          </ul>
          
          <div className="oauth-notice">
            <h4>📝 참고사항</h4>
            {isOAuthAvailable() ? (
              <>
                <p>Google 로그인을 사용하려면 Google Cloud Console에서 OAuth 설정이 필요합니다.</p>
                <p style={{marginTop: '8px', fontSize: '13px', color: '#4285f4'}}>
                  ✅ 지원 도메인: localhost, minecrafton.store
                </p>
                <p style={{marginTop: '8px', fontSize: '12px', color: '#ccc'}}>
                  설정 방법: <code>backend/DOMAIN_OAUTH_SETUP.md</code> 참조
                </p>
              </>
            ) : (
              <>
                <p>현재 환경에서는 Google OAuth를 사용할 수 없습니다.</p>
                <p>지원 도메인: localhost, minecrafton.store</p>
              </>
            )}
            <p style={{marginTop: '10px'}}><strong>게스트로 플레이</strong>하면 모든 기능을 체험할 수 있습니다!</p>
          </div>
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