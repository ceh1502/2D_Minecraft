const express = require('express');
const Player = require('../models/Player');
const User = require('../models/User');
const router = express.Router();

// 랭킹 조회 (DB + 메모리 게스트 랭킹 통합)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 데이터베이스 플레이어 (MongoDB)
    let dbRanking = [];
    try {
      const topPlayers = await Player.getTopPlayers(limit);
      dbRanking = topPlayers.map(player => ({
        id: player._id,
        name: player.username,
        profilePicture: null,
        score: player.score,
        gamesPlayed: player.gamesPlayed,
        isGuest: false
      }));
    } catch (dbError) {
      console.log('⚠️  데이터베이스 연결 없음 - 게스트 랭킹만 표시');
    }
    
    // 게스트 플레이어 (전역 변수에서 가져오기)
    const guestRanking = global.guestRanking ? Array.from(global.guestRanking.values()) : [];
    
    // 통합 랭킹 (점수 순으로 정렬)
    const combinedRanking = [...dbRanking, ...guestRanking]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    res.json({
      success: true,
      ranking: combinedRanking.map((player, index) => ({
        rank: index + 1,
        id: player.id,
        name: player.name,
        profilePicture: player.profilePicture,
        score: player.score,
        gamesPlayed: player.gamesPlayed || 0,
        isGuest: player.isGuest || false
      }))
    });
  } catch (error) {
    console.error('❌ 랭킹 조회 에러:', error);
    res.status(500).json({ success: false, message: '서버 에러' });
  }
});

// 특정 플레이어 랭킹 조회
router.get('/player/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    const player = await Player.findById(playerId);
    
    if (!player) {
      return res.status(404).json({ success: false, message: '플레이어를 찾을 수 없습니다' });
    }
    
    // 해당 플레이어보다 점수가 높은 플레이어 수 계산 (랭킹)
    const higherScorePlayers = await Player.countDocuments({
      score: { $gt: player.score }
    });
    
    const rank = higherScorePlayers + 1;
    
    res.json({
      success: true,
      player: {
        rank: rank,
        id: player._id,
        name: player.username,
        profilePicture: null,
        score: player.score,
        gamesPlayed: player.gamesPlayed
      }
    });
  } catch (error) {
    console.error('❌ 플레이어 랭킹 조회 에러:', error);
    res.status(500).json({ success: false, message: '서버 에러' });
  }
});

// 통계 조회
router.get('/stats', async (req, res) => {
  try {
    let stats = {
      totalPlayers: 0,
      totalGames: 0,
      highestScore: 0,
      averageScore: 0
    };
    
    try {
      const totalPlayers = await Player.countDocuments();
      const pipeline = [
        {
          $group: {
            _id: null,
            totalGames: { $sum: '$gamesPlayed' },
            highestScore: { $max: '$score' },
            averageScore: { $avg: '$score' }
          }
        }
      ];
      
      const result = await Player.aggregate(pipeline);
      
      if (result.length > 0) {
        stats = {
          totalPlayers,
          totalGames: result[0].totalGames || 0,
          highestScore: result[0].highestScore || 0,
          averageScore: Math.round(result[0].averageScore || 0)
        };
      }
    } catch (dbError) {
      console.log('⚠️  데이터베이스 연결 없음 - 기본 통계 반환');
    }
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ 통계 조회 에러:', error);
    res.status(500).json({ success: false, message: '서버 에러' });
  }
});

module.exports = router;