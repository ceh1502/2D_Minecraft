const mongoose = require('mongoose');

const connectDB = async () => {
  let isConnected = false;
  
  // Atlas 연결 시도
  if (process.env.MONGODB_URI.includes('mongodb+srv')) {
    try {
      console.log('🌐 MongoDB Atlas 연결 시도...');
      
      const atlasOptions = {
        serverSelectionTimeoutMS: 3000, // 3초로 단축
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority'
      };
      
      const conn = await mongoose.connect(process.env.MONGODB_URI, atlasOptions);
      console.log(`✅ MongoDB Atlas 연결 성공: ${conn.connection.host}`);
      isConnected = true;
      
    } catch (atlasError) {
      console.log('❌ MongoDB Atlas 연결 실패:', atlasError.message);
      console.log('⚠️  IP 허용 목록 확인 필요 (https://cloud.mongodb.com → Network Access)');
    }
  }
  
  // Atlas 연결 실패 시 로컬 MongoDB로 폴백
  if (!isConnected) {
    try {
      console.log('🔄 로컬 MongoDB로 폴백...');
      
      // 기존 연결이 있으면 닫기
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      const localOptions = {
        serverSelectionTimeoutMS: 2000,
        maxPoolSize: 10
      };
      
      const localConn = await mongoose.connect('mongodb://localhost:27017/minecraft2d', localOptions);
      console.log(`✅ 로컬 MongoDB 연결 성공: ${localConn.connection.host}`);
      isConnected = true;
      
    } catch (localError) {
      console.error('❌ 로컬 MongoDB 연결 실패:', localError.message);
      throw new Error('MongoDB 연결 불가 - Atlas와 로컬 모두 실패');
    }
  }
  
  // 연결 이벤트 리스너 (한 번만 등록)
  if (!mongoose.connection.listeners('error').length) {
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB 연결 오류:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB 연결 끊어짐');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB 재연결 성공');
    });
  }
};

module.exports = connectDB;