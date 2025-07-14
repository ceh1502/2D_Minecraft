const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Player = sequelize.define('Player', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: 'Google OAuth ID'
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Google 프로필 이미지 URL'
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '좀비 킬 점수'
  },
  gamesPlayed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '플레이한 게임 수'
  },
  lastPlayed: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '마지막 플레이 날짜'
  }
}, {
  tableName: 'players',
  indexes: [
    {
      fields: ['googleId']
    },
    {
      fields: ['email']
    },
    {
      fields: ['score'],
      name: 'score_index'
    }
  ]
});

// 클래스 메서드
Player.getTopPlayers = async function(limit = 10) {
  return await Player.findAll({
    order: [['score', 'DESC']],
    limit: limit,
    attributes: ['id', 'name', 'profilePicture', 'score', 'gamesPlayed']
  });
};

// 인스턴스 메서드
Player.prototype.addScore = async function(points = 1) {
  this.score += points;
  await this.save();
  return this.score;
};

Player.prototype.incrementGamesPlayed = async function() {
  this.gamesPlayed += 1;
  this.lastPlayed = new Date();
  await this.save();
};

module.exports = Player;