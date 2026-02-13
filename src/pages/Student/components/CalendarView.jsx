import React, { useState } from 'react';

const CalendarView = ({ messName }) => {
  // Helper: Get Meal based on current time
  const getCurrentMealType = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast'; // Before 11 AM
    if (hour < 16) return 'Lunch';     // 11 AM - 4 PM
    return 'Dinner';                   // After 4 PM
  };

  // Initialize state with the dynamic value
  const [mealType, setMealType] = useState(getCurrentMealType());

  const allData = [
    // --- LUNCH DATA ---
    { day: 14, type: 'Lunch', rating: 8.0, dish: 'Butter Chicken', status: 'good' },
    { day: 15, type: 'Lunch', rating: 8.0, dish: 'Dal Makhani', status: 'good' },
    { day: 16, type: 'Lunch', rating: 9.0, dish: 'Fried Rice', status: 'good' },
    { day: 17, type: 'Lunch', rating: 6.0, dish: 'Chole Bhature', status: 'mid' },
    { day: 18, type: 'Lunch', rating: 4.5, dish: 'Biryani', status: 'bad' },
    { day: 19, type: 'Lunch', rating: 7.0, dish: 'Rajma Chawal', status: 'mid' },
    { day: 20, type: 'Lunch', rating: 7.0, dish: 'Masala Dosa', status: 'mid' },
    
    // --- DINNER DATA ---
    { day: 14, type: 'Dinner', rating: 5.0, dish: 'Mix Veg', status: 'mid' },
    { day: 15, type: 'Dinner', rating: 4.0, dish: 'Egg Curry', status: 'bad' },
    { day: 16, type: 'Dinner', rating: 8.5, dish: 'Paneer', status: 'good' },
    { day: 17, type: 'Dinner', rating: 7.0, dish: 'Kofrta', status: 'mid' },
    { day: 18, type: 'Dinner', rating: 8.0, dish: 'Chicken Curry', status: 'good' },
    { day: 19, type: 'Dinner', rating: 6.5, dish: 'Aloo Gobi', status: 'mid' },
    { day: 20, type: 'Dinner', rating: 5.5, dish: 'Bhindi', status: 'mid' },

    // --- BREAKFAST DATA ---
    { day: 14, type: 'Breakfast', rating: 9.0, dish: 'Poha', status: 'good' },
    { day: 15, type: 'Breakfast', rating: 8.5, dish: 'Paratha', status: 'good' },
  ];

  const visibleDays = allData.filter(d => d.type === mealType);

  return (
    <div className="calendar-layout">
      <div className="calendar-section">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="legend" style={{ margin: 0 }}>
            <span className="dot green"></span> Good
            <span className="dot yellow" style={{ marginLeft: '10px' }}></span> Avg
            <span className="dot red" style={{ marginLeft: '10px' }}></span> Bad
          </div>

          <select 
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="styled-select"
            style={{ width: 'auto', padding: '8px 35px 8px 12px', fontSize: '0.9rem' }}
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>

        <div className="calendar-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          
          {visibleDays.map((item, index) => (
            <div key={index} className={`calendar-cell ${item.status}`}>
              <div className="date-num">{item.day}</div>
              <div className="rating-score">{item.rating}</div>
              <div className="dish-name">{item.dish}</div>
            </div>
          ))}
          
          {[...Array(20 - visibleDays.length)].map((_, i) => (
            <div key={i} className="calendar-cell empty"></div>
          ))}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className="eat-skip-card">
          <h3>Eat or Skip?</h3>
          <p>Based on last week's average for <strong>{mealType}</strong>:</p>
          <div className="rating-display">
            <span className="big-score">
              {mealType === 'Lunch' ? '8.2' : mealType === 'Dinner' ? '6.4' : '8.8'}
            </span>
            <span className="avg-label">Predicted Rating</span>
          </div>
          <button className="action-btn">
            {mealType === 'Dinner' ? 'Maybe Skip' : 'Go to Mess'}
          </button>
        </div>

        <div className="menu-card">
          <h3>Today's Menu</h3>
          <div className="menu-item">
            <span className="meal-type">Lunch</span>
            <span className="meal-time">12:30 PM</span>
            <div className="meal-name">Rajma Chawal</div>
          </div>
          <div className="menu-item">
            <span className="meal-type">Dinner</span>
            <span className="meal-time">7:30 PM</span>
            <div className="meal-name">Aloo Jeera, Roti</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;