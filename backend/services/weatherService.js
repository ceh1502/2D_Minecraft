const axios = require('axios');

class WeatherService {
  constructor() {
    // OpenWeatherMap API 키 (무료 플랜 사용 가능)
    this.apiKey = process.env.WEATHER_API_KEY || 'your-openweathermap-api-key';
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  async getCurrentWeather(city = 'Seoul') {
    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: city,
          appid: this.apiKey,
          units: 'metric',
          lang: 'kr'
        }
      });

      const weather = response.data;
      
      return {
        city: weather.name,
        temperature: Math.round(weather.main.temp),
        description: weather.weather[0].description,
        main: weather.weather[0].main,
        icon: weather.weather[0].icon,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed,
        gameWeather: this.mapToGameWeather(weather.weather[0].main)
      };
    } catch (error) {
      console.error('날씨 API 호출 오류:', error);
      
      // 기본 날씨 반환 (API 실패 시)
      return {
        city: city,
        temperature: 20,
        description: '맑음',
        main: 'Clear',
        icon: '01d',
        humidity: 50,
        windSpeed: 2,
        gameWeather: 'sunny'
      };
    }
  }

  mapToGameWeather(weatherMain) {
    const weatherMap = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'stormy',
      'Snow': 'snowy',
      'Mist': 'foggy',
      'Fog': 'foggy',
      'Haze': 'foggy'
    };

    return weatherMap[weatherMain] || 'sunny';
  }

  async getWeatherForMultipleCities(cities = ['Seoul', 'Busan', 'Incheon']) {
    try {
      const weatherPromises = cities.map(city => this.getCurrentWeather(city));
      const weatherResults = await Promise.all(weatherPromises);
      
      return weatherResults;
    } catch (error) {
      console.error('다중 도시 날씨 조회 오류:', error);
      return [];
    }
  }

  // 시간대별 날씨 예보 (5일 예보)
  async getWeatherForecast(city = 'Seoul') {
    try {
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          q: city,
          appid: this.apiKey,
          units: 'metric',
          lang: 'kr'
        }
      });

      const forecast = response.data.list.slice(0, 8); // 24시간 예보 (3시간 간격)
      
      return forecast.map(item => ({
        time: new Date(item.dt * 1000),
        temperature: Math.round(item.main.temp),
        description: item.weather[0].description,
        main: item.weather[0].main,
        icon: item.weather[0].icon,
        gameWeather: this.mapToGameWeather(item.weather[0].main)
      }));
    } catch (error) {
      console.error('날씨 예보 API 호출 오류:', error);
      return [];
    }
  }
}

module.exports = new WeatherService();