// 🔨 새로운 함수: 아이템이 도구인지 판별 (세분화)
const getToolType = (itemName) => {
  if (!itemName) return 'hand'; // 빈칸은 맨손
  
  switch (itemName) {
    // 곡괭이류 (세분화)
    case 'wooden_pickaxe': return 'wooden_pickaxe';
    case 'stone_pickaxe': return 'stone_pickaxe';
    case 'iron_pickaxe': return 'iron_pickaxe';
    case 'diamond_pickaxe': return 'diamond_pickaxe';
    
    // 도끼류 (세분화)
    case 'iron_axe': return 'iron_axe';
    case 'diamond_axe': return 'diamond_axe';
    
    // 검류 (세분화)
    case 'iron_sword': return 'iron_sword';
    case 'diamond_sword': return 'diamond_sword';
    
    // 기존 호환성 (혹시 모를 경우)
    case 'pickaxe': return 'wooden_pickaxe';
    case 'axe': return 'iron_axe';
    case 'sword': return 'iron_sword';
    
    default:
      return 'hand'; // 블록이나 기타 아이템은 맨손
  }
};

// 🔨 새로운 함수: 현재 선택된 슬롯의 도구 타입 가져오기
const getCurrentToolType = (inventory, selectedSlot) => {
  const currentItem = inventory[selectedSlot];
  return getToolType(currentItem?.name);
};

function InventoryGrid({ inventory, selectedSlot, onSlotSelect, onDragStart, onDrop, onDragOver, onDragEnd }) {
  const rows = 4, cols = 5;
  
  return (
    <div className="inventory-grid">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div className="inventory-row" key={rowIdx}>
          {Array.from({ length: cols }).map((_, colIdx) => {
            const index = rowIdx * cols + colIdx;
            const item = inventory[index];
            const isHotbar = rowIdx === 3;
            const isSelected = isHotbar && selectedSlot === colIdx;
            
            return (
              <div
                key={index}
                className={`inventory-slot ${isSelected ? 'selected' : ''} ${item ? 'has-item' : ''}`}
                onClick={() => isHotbar && onSlotSelect && onSlotSelect(colIdx)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, index)}
                style={{ position: 'relative' }}
              >
                {item && (
                  <div
                    className="draggable-item"
                    draggable={true}
                    onDragStart={(e) => onDragStart(e, item, index)}
                    onDragEnd={onDragEnd}
                    style={{
                      width: '100%',
                      height: '100%',
                      cursor: 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="slot-icon">
                      <img
                        src={item.icon}
                        alt={item.name}
                        width={16}
                        height={16}
                        style={{ pointerEvents: 'none' }}
                      />
                    </div>
                    <div className="slot-count" style={{ pointerEvents: 'none' }}>
                      {item.count > 1 ? item.count : ''}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}




function InventoryModal({ inventory, onClose, onDragStart, onDrop, onDragOver, onDragEnd }) {
  return (
    <div className="inventory-modal-backdrop" onClick={onClose}>
      <div className="inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-layout">
          <div className="player-avatar">
            <div className="avatar-box">
              <img 
                src="/images/characters/steve.gif"
                alt="avatar"
                height={108}
              />
            </div>
          </div>

          <div className="inventory-content">
            <InventoryGrid
              inventory={inventory}
              selectedSlot={null}
              onSlotSelect={() => {}}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            />
            <button onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🔨 업그레이드된 Hotbar 컴포넌트 (드래그 앤 드롭 지원)
function Hotbar({ selectedSlot, inventory, onDragStart, onDrop, onDragOver, onDragEnd }) {
    const currentToolType = getCurrentToolType(inventory, selectedSlot);
    
    const getToolEmoji = (toolType) => {
      switch (toolType) {
        case 'hand': return '👊';
        case 'pickaxe': return '⛏️';
        case 'axe': return '🪓';
        case 'sword': return '⚔️';
        default: return '👊';
      }
    };
    
    return (
      <div className="hotbar">
        {[0,1,2,3,4].map((i) => {
          const item = inventory[i];
          const isSelected = selectedSlot === i;
          const toolType = getToolType(item?.name);
          
          return (
            <div
              key={i}
              className={`hotbar-slot ${isSelected ? 'selected' : ''} ${item ? 'has-item' : ''}`}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, i)}
              style={{ position: 'relative' }}
            >
              <div className="slot-number">{i + 1}</div>
              
              {item && (
                <div
                  className="draggable-item"
                  draggable={true}
                  onDragStart={(e) => onDragStart(e, item, i)}
                  onDragEnd={onDragEnd}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <div className="slot-icon">
                    <img
                      src={item.icon}
                      alt={item.name}
                      width={16}
                      height={16}
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                  <div className="slot-count" style={{ pointerEvents: 'none' }}>
                    {item.count > 1 ? item.count : ''}
                  </div>
                </div>
              )}
              
              <div className="slot-name">
                {item?.name || ''}
                {isSelected && !item && (
                  <div style={{ fontSize: '12px', color: '#FFD700' }}>
                    {getToolEmoji(currentToolType)} {currentToolType}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

export {Hotbar, InventoryGrid, InventoryModal, getCurrentToolType}