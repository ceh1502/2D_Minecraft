import React from 'react';
import '../styles/HealthBar.css';

const HealthBar = ({ health, maxHealth }) => {
  const renderHearts = (current, max, isBonusRow = false) => {
    const hearts = [];
    const totalHearts = Math.ceil(max / 2);

    for (let i = 0; i < totalHearts; i++) {
      const heartValue = (i + 1) * 2;
      let heartType = 'empty';

      if (current >= heartValue) {
        heartType = 'full';
      } else if (current >= heartValue - 1) {
        heartType = 'half';
      }
      
      hearts.push(
        <img 
          key={`${isBonusRow ? 'bonus' : 'base'}-${i}`}
          src={`/images/health/${heartType}_heart.png`}
          alt={`${heartType} heart`}
          className={`heart-icon ${isBonusRow ? 'bonus-heart' : ''}`}
        />
      );
    }
    return hearts;
  };

  const baseHealth = Math.min(health, 20);
  const bonusHealth = Math.max(0, health - 20);
  const maxBonusHealth = Math.max(0, maxHealth - 20);

  return (
    <div className="health-bar-container">
      <div className="health-row">
        {renderHearts(baseHealth, 20)}
      </div>
      {maxBonusHealth > 0 && (
        <div className="health-row">
          {renderHearts(bonusHealth, maxBonusHealth, true)}
        </div>
      )}
    </div>
  );
};

export default HealthBar;
