const { Sequelize } = require('sequelize');
const path = require('path');

// SQLite 데이터베이스 연결 설정
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: console.log, // SQL 쿼리 로깅 (개발 시에만)
  define: {
    timestamps: true, // createdAt, updatedAt 자동 생성
    underscored: false, // camelCase 사용
  }
});

// 데이터베이스 연결 테스트
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공');
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
  }
}

module.exports = { sequelize, testConnection };