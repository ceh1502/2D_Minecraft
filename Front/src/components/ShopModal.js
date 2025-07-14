import React, { useState } from 'react';
import '../styles/ShopModal.css';
import { InventoryGrid } from './InventoryUI';

const tradeItems = [
  { name: 'wooden_pickaxe', icon: '/images/items/wooden_pickaxe.png', material: 'tree', amount: 5 },
  { name: 'stone_pickaxe', icon: '/images/items/stone_pickaxe.png', material: 'stone', amount: 5 },
  { name: 'iron_pickaxe', icon: '/images/items/iron_pickaxe.png', material: 'iron', amount: 5 },
  { name: 'diamond_pickaxe', icon: '/images/items/diamond_pickaxe.png', material: 'dia', amount: 5 },
  { name: 'iron_sword', icon: '/images/items/iron_sword.png', material: 'iron', amount: 4 },
  { name: 'diamond_sword', icon: '/images/items/diamond_sword.png', material: 'dia', amount: 4 },
  { name: 'iron_axe', icon: '/images/items/iron_axe.png', material: 'iron', amount: 4 },
  { name: 'diamond_axe', icon: '/images/items/diamond_axe.png', material: 'dia', amount: 4 },
  { name: 'iron_helmet', icon: '/images/items/iron_helmet.png', material: 'iron', amount: 5 },
  { name: 'iron_chest', icon: '/images/items/iron_chest.png', material: 'iron', amount: 8 },
  { name: 'iron_leggings', icon: '/images/items/iron_leggings.png', material: 'iron', amount: 7 },
  { name: 'iron_boots', icon: '/images/items/iron_boots.png', material: 'iron', amount: 4 },
  { name: 'diamond_helmet', icon: '/images/items/diamond_helmet.png', material: 'dia', amount: 5 },
  { name: 'diamond_chest', icon: '/images/items/diamond_chest.png', material: 'dia', amount: 8 },
  { name: 'diamond_leggings', icon: '/images/items/diamond_leggings.png', material: 'dia', amount: 7 },
  { name: 'diamond_boots', icon: '/images/items/diamond_boots.png', material: 'dia', amount: 4 },
  { name: 'barbed_wire', icon: '/images/blocks/barbed_wire.png', material: 'iron', amount: 5 },
  { name: 'wooden_fence', icon: '/images/blocks/wooden_fence.png', material: 'tree', amount: 5 },
];

const ITEMS_PER_PAGE = 8;

const ShopModal = ({ inventory, onClose, onBuy, onDragStart, onDrop, onDragOver, onDragEnd }) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(tradeItems.length / ITEMS_PER_PAGE);

  const currentItems = tradeItems.slice(
    page * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE + ITEMS_PER_PAGE
  );

  return (
    <div className="shop-modal">
      <div className="shop-box">
        <div className="shop-title">🛒 아이템 상점</div>

        <div className="shop-items-grid">
          {currentItems.map((item) => (
            <div
            key={item.name}
            className="shop-item"
            onClick={() => {
              console.log("✅ [ShopModal] 아이템 클릭됨:", item.name);
              onBuy(item.name);
            }}
          >
              <div className="shop-trade-row">
                <div className="shop-requirement">
                  <img src={`/images/blocks/${item.material}.png`} alt={item.material} />
                  <span>x {item.amount}</span>
                </div>
                <div className="shop-equal">=</div>
                <div className="shop-result">
                  <img src={item.icon} alt={item.name} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="shop-pagination">
            <button onClick={() => setPage((prev) => Math.max(prev - 1, 0))} disabled={page === 0}>
              ←
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))} disabled={page === totalPages - 1}>
              →
            </button>
          </div>
        )}
      </div>

      <div className="inventory-box">
      <InventoryGrid
        inventory={inventory}
        selectedSlot={null}
        onSlotSelect={() => {}}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      />
      </div>

      <div className="shop-footer">
        <button onClick={onClose}>닫기</button>
      </div>
    </div>
  );
};

export default ShopModal;