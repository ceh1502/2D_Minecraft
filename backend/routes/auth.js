const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// MongoDB 연결 상태 확인 헬퍼 함수
const checkDBConnection = () => {
  const mongoose = require('mongoose');
  const readyState = mongoose.connection.readyState;
  console.log(`🔍 MongoDB 연결 상태 확인: ${readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
  
  // 연결됨 또는 연결 중일 때는 허용
  return readyState === 1 || readyState === 2;
};

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 입력 검증
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '모든 필드를 입력해주세요.'
      });
    }

    // DB 연결 확인 (더 관대한 처리)
    const dbConnected = checkDBConnection();
    if (!dbConnected) {
      console.log('⚠️  DB 연결 상태 불안정, 그래도 요청 진행 시도');
    }

    // 사용자 존재 확인
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '이미 존재하는 사용자명 또는 이메일입니다.'
      });
    }

    // 새 사용자 생성
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'minecraft-game-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        score: user.score
      }
    });

  } catch (error) {
    console.error('회원가입 오류:', error.message);
    
    if (error.name === 'MongooseError' || error.message.includes('buffering timed out')) {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 입력 검증
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '이메일과 비밀번호를 입력해주세요.'
      });
    }

    // DB 연결 확인 (더 관대한 처리)
    const dbConnected = checkDBConnection();
    if (!dbConnected) {
      console.log('⚠️  DB 연결 상태 불안정, 그래도 요청 진행 시도');
    }

    // 사용자 찾기
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: '잘못된 이메일 또는 비밀번호입니다.'
      });
    }

    // 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: '잘못된 이메일 또는 비밀번호입니다.'
      });
    }

    // 마지막 플레이 시간 업데이트
    user.lastPlayed = new Date();
    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'minecraft-game-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: '로그인 성공',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        score: user.score
      }
    });

  } catch (error) {
    console.error('로그인 오류:', error.message);
    
    if (error.name === 'MongooseError' || error.message.includes('buffering timed out')) {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 토큰 검증 미들웨어
const authenticateToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '액세스 토큰이 없습니다.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'minecraft-game-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.'
    });
  }
};

// 사용자 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      score: req.user.score,
      gamesPlayed: req.user.gamesPlayed,
      lastPlayed: req.user.lastPlayed
    }
  });
});

// 토큰 검증 API
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '토큰이 없습니다.'
      });
    }
    
    // 게스트 토큰 처리
    if (token.startsWith('guest_token_')) {
      // 게스트 토큰은 DB 없이 처리
      const guestId = token.replace('guest_token_', '');
      return res.json({
        success: true,
        message: '게스트 토큰이 유효합니다.',
        user: {
          id: guestId,
          username: `Guest_${guestId.slice(-6)}`,
          email: 'guest@example.com',
          score: 0,
          isGuest: true
        }
      });
    }
    
    // JWT 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'minecraft-game-secret-key');
    
    // DB 연결 확인 (더 관대한 처리)
    const dbConnected = checkDBConnection();
    if (!dbConnected) {
      console.log('⚠️  DB 연결 상태 불안정, 그래도 요청 진행 시도');
    }
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 토큰이 유효하면 사용자 정보 반환
    res.json({
      success: true,
      message: '토큰이 유효합니다.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        score: user.score
      }
    });
    
  } catch (error) {
    console.error('토큰 검증 오류:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }
    
    if (error.name === 'MongooseError' || error.message.includes('buffering timed out')) {
      return res.status(503).json({
        success: false,
        message: '데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

module.exports = router;