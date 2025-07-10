class MapGenerator {
  constructor(width = 50, height = 50) {
    this.width = width;
    this.height = height;
  }

  generateMap() {
    const map = [];
    
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(this.generateCell(x, y));
      }
      map.push(row);
    }
    
    return {
      width: this.width,
      height: this.height,
      cells: map
    };
  }

  generateCell(x, y) {
    // 맵 생성 로직
    const random = Math.random();
    
    // 가장자리는 산/돌
    if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
      return {
        type: 'stone',
        durability: 100,
        resources: Math.floor(Math.random() * 5) + 3
      };
    }
    
    // 자원 분포
    if (random < 0.25) {
      return {
        type: 'tree',
        durability: 50,
        resources: Math.floor(Math.random() * 3) + 2
      };
    } else if (random < 0.4) {
      return {
        type: 'stone',
        durability: 80,
        resources: Math.floor(Math.random() * 4) + 2
      };
    } else if (random < 0.5) {
      return {
        type: 'iron_ore',
        durability: 120,
        resources: Math.floor(Math.random() * 2) + 1
      };
    } else if (random < 0.55) {
      return {
        type: 'coal',
        durability: 60,
        resources: Math.floor(Math.random() * 3) + 1
      };
    } else {
      return {
        type: 'grass',
        durability: 10,
        resources: 0
      };
    }
  }
}

module.exports = MapGenerator;