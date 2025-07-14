const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
const Player = require('../models/Player');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'minecraft-game-secret-key';

// Google OAuth 시작
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth 콜백
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      // JWT 토큰 생성
      const token = jwt.sign(
        { 
          id: req.user.id, 
          googleId: req.user.googleId,
          email: req.user.email,
          name: req.user.name
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 프론트엔드로 리다이렉트 (토큰 포함)
      res.redirect(`http://localhost:3000?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        profilePicture: req.user.profilePicture,
        score: req.user.score
      }))}`);
    } catch (error) {
      console.error('❌ OAuth 콜백 에러:', error);
      res.redirect('http://localhost:3000?error=auth_failed');
    }
  }
);

// 토큰 검증
router.get('/verify', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      profilePicture: req.user.profilePicture,
      score: req.user.score,
      gamesPlayed: req.user.gamesPlayed
    }
  });
});

// 로그아웃
router.post('/logout', (req, res) => {
  res.json({ success: true, message: '로그아웃 완료' });
});

// 사용자 정보 업데이트
router.put('/user', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { name } = req.body;
    const player = req.user;
    
    if (name) {
      player.name = name;
      await player.save();
    }
    
    res.json({
      success: true,
      user: {
        id: player.id,
        name: player.name,
        email: player.email,
        profilePicture: player.profilePicture,
        score: player.score,
        gamesPlayed: player.gamesPlayed
      }
    });
  } catch (error) {
    console.error('❌ 사용자 정보 업데이트 에러:', error);
    res.status(500).json({ success: false, message: '서버 에러' });
  }
});

module.exports = router;