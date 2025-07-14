import React, { useState, useEffect } from 'react';
import '../styles/RankingBoard.css';

const RankingBoard = ({ currentUser, ranking, isVisible, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (onToggle) onToggle();
  };

  // 현재 사용자의 랭킹 찾기
  const currentUserRank = ranking?.find(player => player.id === currentUser?.id);

  return (
    <div className={`ranking-board ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="ranking-header" onClick={handleToggle}>
        <div className="ranking-title">
          🏆 랭킹
          {currentUserRank && (
            <span className="current-rank">#{currentUserRank.rank}</span>
          )}
        </div>
        <button className="toggle-btn">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="ranking-content">
          {currentUser && (
            <div className="current-user-info">
              <div className="user-profile">
                <img 
                  src={currentUser.profilePicture || '/images/characters/avatar_down.png'} 
                  alt="프로필" 
                  className="profile-pic small"
                />
                <div className="user-details">
                  <div className="user-name">{currentUser.name}</div>
                  <div className="user-score">점수: {currentUser.score || 0}</div>
                </div>
              </div>
            </div>
          )}

          <div className="ranking-list">
            {ranking && ranking.length > 0 ? (
              ranking.slice(0, 10).map((player, index) => (
                <div 
                  key={player.id} 
                  className={`ranking-item ${player.id === currentUser?.id ? 'current-user' : ''}`}
                >
                  <div className="rank-number">
                    {index + 1 <= 3 ? (
                      <span className={`medal rank-${index + 1}`}>
                        {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className="rank-text">#{index + 1}</span>
                    )}
                  </div>
                  <div className="player-info">
                    <img 
                      src={player.profilePicture || '/images/characters/avatar_down.png'} 
                      alt={player.name}
                      className="profile-pic"
                    />
                    <div className="player-details">
                      <div className="player-name">{player.name}</div>
                      <div className="player-score">{player.score}점</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-ranking">
                <p>아직 랭킹 데이터가 없습니다</p>
              </div>
            )}
          </div>

          <div className="ranking-footer">
            <small>좀비를 잡아서 점수를 올려보세요!</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingBoard;