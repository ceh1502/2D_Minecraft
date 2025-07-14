import React from 'react';
import '../styles/HealthBar.css';

const HealthBar = ({ health, maxHealth }) => {
  const totalHearts = maxHealth / 2;
  const fullHearts = Math.floor(health / 2);
  const halfHeart = health % 2 === 1;
  const emptyHearts = totalHearts - fullHearts - (halfHeart ? 1 : 0);

  const hearts = [];

  for (let i = 0; i < fullHearts; i++) {
    hearts.push(<img key={`full-${i}`} src="/images/health/full_heart.png" alt="full heart" className="heart-icon" />);
  }

  if (halfHeart) {
    hearts.push(<img key="half" src="/images/health/half_heart.png" alt="half heart" className="heart-icon" />);
  }

  for (let i = 0; i < emptyHearts; i++) {
    hearts.push(<img key={`empty-${i}`} src="/images/health/empty_heart.png" alt="empty heart" className="heart-icon" />);
  }

  return (
    <div className="health-bar-container">
      {hearts}
    </div>
  );
};

export default HealthBar;
