import React, { useState } from 'react';
import { Smile, Meh, Frown, ChevronLeft, ChevronRight } from 'lucide-react';

const TrendsView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getRealTimeMeal = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  };

  const [mealType, setMealType] = useState(getRealTimeMeal());

  // Calendar Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); 

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Mock Data
  const myHistory = [
    { day: 14, type: 'Lunch', rating: 9, comment: 'Loved it!' },
    { day: 16, type: 'Lunch', rating: 4, comment: 'Too salty' },
    { day: 18, type: 'Lunch', rating: 8, comment: 'Good portion' },
    { day: 25, type: 'Lunch', rating: 9, comment: 'Great!' },
    { day: 15, type: 'Dinner', rating: 5, comment: 'Cold food' },
    { day: 17, type: 'Dinner', rating: 6, comment: 'Okayish' },
    { day: 20, type: 'Dinner', rating: 2, comment: 'Burnt roti' },
    { day: 14, type: 'Breakfast', rating: 8, comment: 'Nice tea' },
  ];

  const getLogForDay = (dayNum) => {
    return myHistory.find(h => h.day === dayNum && h.type === mealType);
  };

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

  return (
    <div className="calendar-layout">
      <div className="calendar-section" style={{ flex: 3 }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          
          {/* Left: Month Nav */}
          <div className="nav-header">
            <button onClick={prevMonth} className="nav-arrow-btn">
              <ChevronLeft size={20} />
            </button>
            <span className="month-label">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="nav-arrow-btn">
              <ChevronRight size={20} />
            </button>
          </div>
          
          {/* Right: Meal Filter */}
          <select 
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="header-select"
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>
        
        {/* GRID */}
        <div className="calendar-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
             <div key={`empty-${i}`} className="calendar-cell empty"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const log = getLogForDay(dayNum);
            
            let statusClass = 'neutral';
            if (log) {
              if (log.rating >= 7) statusClass = 'good';
              else if (log.rating >= 5) statusClass = 'mid';
              else statusClass = 'bad';
            }

            return (
              <div key={dayNum} className={`calendar-cell ${statusClass}`}>
                <div className="date-num">{dayNum}</div>
                {log ? (
                  <>
                    <div className="rating-score">{log.rating}</div>
                    <div className="dish-name">{log.comment}</div>
                  </>
                ) : (
                  <div className="dish-name" style={{ marginTop: 'auto', opacity: 0.3 }}>-</div>
                )}
              </div>
            );
          })}
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