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
      // Determine class based on rating
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
            <Smile size={40} className="text-green-500" style={{ marginBottom: '10px', color: 'var(--primary-green)' }} />
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>6.5</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your Average Rating</p>
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