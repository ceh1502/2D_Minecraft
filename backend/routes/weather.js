const express = require('express');
const weatherService = require('../services/weatherService');

const router = express.Router();

// 현재 날씨 조회
router.get('/current', async (req, res) => {
  try {
    const { city } = req.query;
    const weather = await weatherService.getCurrentWeather(city);
    
    res.json({
      success: true,
      weather
    });
  } catch (error) {
    console.error('날씨 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '날씨 정보를 가져올 수 없습니다.'
    });
  }
});

// 다중 도시 날씨 조회
router.get('/cities', async (req, res) => {
  try {
    const cities = req.query.cities ? req.query.cities.split(',') : ['Seoul', 'Busan', 'Incheon'];
    const weatherList = await weatherService.getWeatherForMultipleCities(cities);
    
    res.json({
      success: true,
      weatherList
    });
  } catch (error) {
    console.error('다중 도시 날씨 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '날씨 정보를 가져올 수 없습니다.'
    });
  }
});

// 날씨 예보 조회
router.get('/forecast', async (req, res) => {
  try {
    const { city } = req.query;
    const forecast = await weatherService.getWeatherForecast(city);
    
    res.json({
      success: true,
      forecast
    });
  } catch (error) {
    console.error('날씨 예보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '날씨 예보를 가져올 수 없습니다.'
    });
  }
});

module.exports = router;