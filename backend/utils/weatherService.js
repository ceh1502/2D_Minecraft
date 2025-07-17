const axios = require('axios');

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
    this.defaultCity = process.env.DEFAULT_CITY || 'Seoul';
    this.updateInterval = parseInt(process.env.WEATHER_UPDATE_INTERVAL) || 300000; // 5분
    this.currentWeather = null;
    this.lastUpdate = 0;
  }

  // 날씨 데이터 가져오기
  async getWeather(city = this.defaultCity) {
    try {
      if (!this.apiKey || this.apiKey === 'your-api-key-here') {
        console.log('⚠️ 날씨 API 키가 설정되지 않음 - 기본 날씨 사용');
        return this.getDefaultWeather();
      }

      const now = Date.now();
      
      // 캐시된 데이터가 있고 업데이트 간격이 지나지 않았으면 캐시 사용
      if (this.currentWeather && (now - this.lastUpdate) < this.updateInterval) {
        return this.currentWeather;
      }

      const response = await axios.get(this.baseUrl, {
        params: {
          q: city,
          appid: this.apiKey,
          units: 'metric', // 섭씨 온도
          lang: 'kr' // 한국어
        },
        timeout: 5000 // 5초 타임아웃
      });

      const weatherData = this.parseWeatherData(response.data);
      
      // 🌧️ 임시로 비로 고정 (테스트용)
      weatherData.condition = 'rainy';
      weatherData.description = '비';
      
      this.currentWeather = weatherData;
      this.lastUpdate = now;

      console.log(`🌤️ 날씨 업데이트: ${city} - ${weatherData.condition} (${weatherData.temp}°C) [비로 고정]`);
      return weatherData;

    } catch (error) {
      console.error('❌ 날씨 API 오류:', error.message);
      return this.getDefaultWeather();
    }
  }

  // 날씨 데이터 파싱
  parseWeatherData(data) {
    const weather = data.weather[0];
    const main = data.main;
    
    return {
      condition: this.getWeatherCondition(weather.main, weather.id),
      description: weather.description,
      temp: Math.round(main.temp),
      humidity: main.humidity,
      city: data.name,
      country: data.sys.country,
      timestamp: new Date().toISOString(),
      icon: weather.icon
    };
  }

  // 날씨 상태를 게임용으로 분류
  getWeatherCondition(main, id) {
    // OpenWeatherMap의 날씨 코드를 게임 상태로 변환
    switch (main.toLowerCase()) {
      case 'clear':
        return 'sunny';
      case 'clouds':
        return id < 803 ? 'cloudy' : 'overcast';
      case 'rain':
      case 'drizzle':
        return 'rainy';
      case 'thunderstorm':
        return 'stormy';
      case 'snow':
        return 'snowy';
      case 'mist':
      case 'fog':
      case 'haze':
        return 'foggy';
      default:
        return 'clear';
    }
  }

  // 기본 날씨 (API 실패 시)
  getDefaultWeather() {
    return {
      condition: 'rainy',
      description: '비',
      temp: 20,
      humidity: 50,
      city: this.defaultCity,
      country: 'KR',
      timestamp: new Date().toISOString(),
      icon: '10d'
    };
  }

  // 날씨 상태 목록
  getWeatherTypes() {
    return [
      'sunny',    // 맑음
      'cloudy',   // 구름 많음
      'overcast', // 흐림
      'rainy',    // 비
      'stormy',   // 뇌우
      'snowy',    // 눈
      'foggy'     // 안개
    ];
  }
}

module.exports = WeatherService;