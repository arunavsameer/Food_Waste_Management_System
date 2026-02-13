import React, { useState } from 'react';
import { Smile, Meh, Frown } from 'lucide-react';

const TrendsView = () => {
  // Helper: Get Meal based on current time
  const getCurrentMealType = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  };

  const [mealType, setMealType] = useState(getCurrentMealType());

  const myHistory = [
    { day: 14, type: 'Lunch', rating: 9, comment: 'Loved it!' },
    { day: 16, type: 'Lunch', rating: 4, comment: 'Too salty' },
    { day: 18, type: 'Lunch', rating: 8, comment: 'Good portion' },
    
    { day: 15, type: 'Dinner', rating: 5, comment: 'Cold food' },
    { day: 17, type: 'Dinner', rating: 6, comment: 'Okayish' },
    { day: 20, type: 'Dinner', rating: 2, comment: 'Burnt roti' },

    { day: 14, type: 'Breakfast', rating: 8, comment: 'Nice tea' },
  ];

  const filteredHistory = myHistory.filter(h => h.type === mealType);
  const averageRating = filteredHistory.length > 0
    ? (filteredHistory.reduce((sum, item) => sum + item.rating, 0) / filteredHistory.length).toFixed(1)
    : '0.0';

  const getMoodConfig = (score) => {
    const numScore = parseFloat(score);
    if (numScore === 0) return { icon: Smile, color: 'var(--text-muted)' };
    if (numScore >= 7.5) return { icon: Smile, color: 'var(--primary-green)' };
    if (numScore >= 5) return { icon: Meh, color: 'var(--warning)' };
    return { icon: Frown, color: 'var(--danger)' };
  };

  const { icon: MoodIcon, color: moodColor } = getMoodConfig(averageRating);

  const renderCalendarCell = (dayNum) => {
    const log = myHistory.find(h => h.day === dayNum && h.type === mealType);
    
    if (log) {
      let statusClass = 'bad';
      if (log.rating >= 7) statusClass = 'good';
      else if (log.rating >= 5) statusClass = 'mid';

      return (
        <div key={dayNum} className={`calendar-cell ${statusClass}`}>
          <div className="date-num">{dayNum}</div>
          <div className="rating-score">{log.rating}</div>
          <div className="dish-name">{log.comment}</div>
        </div>
      );
    } else {
      return (
        <div key={dayNum} className="calendar-cell empty">
          <div className="date-num">{dayNum}</div>
          <div className="dish-name" style={{ marginTop: 'auto' }}>-</div>
        </div>
      );
    }
  };

  return (
    <div className="calendar-layout">
      <div className="calendar-section" style={{ flex: 3 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>My Feedback History</h3>
          
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
          {Array.from({ length: 17 }, (_, i) => i + 14).map(day => renderCalendarCell(day))}
        </div>
      </div>

      <div className="sidebar-widgets" style={{ flex: 1 }}>
        <div className="menu-card" style={{ textAlign: 'center' }}>
            <MoodIcon size={48} style={{ marginBottom: '10px', color: moodColor, transition: 'color 0.3s' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
               {averageRating}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg {mealType} Rating</p>
        </div>
        
        <div className="menu-card">
            <h4>Stats ({mealType})</h4>
            <div className="menu-item" style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Meals Rated</span>
                <strong>{filteredHistory.length}</strong>
            </div>
            <div className="menu-item" style={{display: 'flex', justifyContent: 'space-between', border: 'none'}}>
                <span>Skipped</span>
                <strong>2</strong>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsView;