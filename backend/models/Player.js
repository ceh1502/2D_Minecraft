const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  score: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  lastPlayed: {
    type: Date,
    default: Date.now
  },
  inventory: {
    type: Object,
    default: {}
  },
  position: {
    x: { type: Number, default: 25 },
    y: { type: Number, default: 25 }
  },
  health: {
    type: Number,
    default: 20
  }
}, {
  timestamps: true
});

// 클래스 메서드
playerSchema.statics.getTopPlayers = async function(limit = 10) {
  return await this.find({})
    .sort({ score: -1 })
    .limit(limit)
    .select('username score gamesPlayed');
};

// 인스턴스 메서드
playerSchema.methods.addScore = async function(points = 1) {
  this.score += points;
  await this.save();
  return this.score;
};

playerSchema.methods.incrementGamesPlayed = async function() {
  this.gamesPlayed += 1;
  this.lastPlayed = new Date();
  await this.save();
};

module.exports = mongoose.model('Player', playerSchema);