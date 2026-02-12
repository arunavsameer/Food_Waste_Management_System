import React from 'react';
import { Smile } from 'lucide-react';

const TrendsView = () => {
  const myHistory = [
    { day: 14, rating: 9, comment: 'Loved it!' },
    { day: 16, rating: 4, comment: 'Too salty' },
    { day: 18, rating: 8, comment: 'Good portion' },
    { day: 20, rating: 5, comment: 'Cold food' },
  ];

  const renderCalendarCell = (dayNum) => {
    const log = myHistory.find(h => h.day === dayNum);
    
    if (log) {
      let bgColor = '#fee2e2'; 
      if (log.rating >= 7) bgColor = '#d1fae5'; 
      else if (log.rating >= 5) bgColor = '#fef3c7'; 

      return (
        <div key={dayNum} className="calendar-cell" style={{ backgroundColor: bgColor }}>
          <div className="date-num">{dayNum}</div>
          <div className="rating-score">{log.rating}</div>
          <div className="dish-name" style={{fontSize: '0.7rem', color: '#555'}}>{log.comment}</div>
        </div>
      );
    } else {
      return (
        <div key={dayNum} className="calendar-cell" style={{ backgroundColor: 'white', border: '1px solid #f0f0f0' }}>
          <div className="date-num" style={{ color: '#ccc' }}>{dayNum}</div>
          <div className="dish-name" style={{ marginTop: 'auto', color: '#ccc' }}>-</div>
        </div>
      );
    }
  };

  return (
    <div className="calendar-layout">
      <div className="calendar-section" style={{ flex: 3 }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>My Feedback History</h3>
        
        <div className="calendar-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          {Array.from({ length: 17 }, (_, i) => i + 14).map(day => renderCalendarCell(day))}
        </div>
      </div>

      <div className="sidebar-widgets" style={{ flex: 1 }}>
        <div className="menu-card" style={{ textAlign: 'center' }}>
            <Smile size={40} color="#2ecc71" style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2d3436' }}>6.5</div>
            <p style={{ color: '#636e72', fontSize: '0.9rem' }}>Your Average Rating</p>
        </div>
        
        <div className="menu-card">
            <h4>Stats</h4>
            <div className="menu-item" style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Meals Rated</span>
                <strong>4</strong>
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