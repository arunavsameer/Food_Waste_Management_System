import React, { useState } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'; 

const CalendarView = ({ messName }) => {
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
  const allData = [
    { day: 2, type: 'Lunch', rating: 7.5, dish: 'Paneer Tikka', status: 'good' },
    { day: 5, type: 'Lunch', rating: 4.0, dish: 'Baingan', status: 'bad' },
    { day: 8, type: 'Lunch', rating: 8.0, dish: 'Dal Makhani', status: 'good' },
    { day: 12, type: 'Lunch', rating: 9.0, dish: 'Fried Rice', status: 'good' },
    { day: 14, type: 'Lunch', rating: 6.0, dish: 'Chole', status: 'mid' },
    { day: 15, type: 'Lunch', rating: 4.5, dish: 'Khichdi', status: 'bad' },
    { day: 20, type: 'Lunch', rating: 7.0, dish: 'Rajma', status: 'mid' },
    { day: 25, type: 'Lunch', rating: 8.5, dish: 'Chicken Curry', status: 'good' },
    { day: 2, type: 'Dinner', rating: 5.0, dish: 'Mix Veg', status: 'mid' },
    { day: 8, type: 'Dinner', rating: 3.5, dish: 'Tinda', status: 'bad' },
    { day: 14, type: 'Dinner', rating: 8.0, dish: 'Egg Curry', status: 'good' },
  ];

  const getDataForDay = (dayNum) => {
    return allData.find(d => d.day === dayNum && d.type === mealType);
  };

  const getNextMealDefaults = () => {
    const hour = new Date().getHours();
    if (hour < 11) return { day: 'Today', meal: 'Lunch' };
    if (hour < 16) return { day: 'Today', meal: 'Dinner' };
    return { day: 'Tomorrow', meal: 'Breakfast' };
  };

  const [skipData, setSkipData] = useState(getNextMealDefaults());
  const [isSkipped, setIsSkipped] = useState(false);

  const handleSkipSubmit = () => {
    setIsSkipped(true);
    setTimeout(() => setIsSkipped(false), 3000);
  };

  return (
    <div className="calendar-layout">
      <div className="calendar-section">
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          
          {/* Left: Month Navigation */}
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

          {/* Right: Meal Filter (Uses fixed width class) */}
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

        {/* LEGEND */}
        <div className="legend">
          <span className="dot green"></span> Good
          <span className="dot yellow" style={{ marginLeft: '10px' }}></span> Avg
          <span className="dot red" style={{ marginLeft: '10px' }}></span> Bad
        </div>

        {/* CALENDAR GRID */}
        <div className="calendar-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
             <div key={`empty-${i}`} className="calendar-cell empty"></div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const data = getDataForDay(dayNum);
            const statusClass = data ? data.status : 'neutral';

            return (
              <div key={dayNum} className={`calendar-cell ${statusClass}`}>
                <div className="date-num">{dayNum}</div>
                {data ? (
                  <>
                    <div className="rating-score">{data.rating}</div>
                    <div className="dish-name">{data.dish}</div>
                  </>
                ) : (
                  <div className="dish-name" style={{ marginTop: 'auto', opacity: 0.3 }}>-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className={`eat-skip-card ${isSkipped ? 'success-mode' : ''}`}>
          {isSkipped ? (
            <div className="skip-success-content">
              <div className="success-circle">
                <CheckCircle size={50} strokeWidth={3} />
              </div>
              <h4>Skipped!</h4>
              <p>Mess notified for {skipData.day} ({skipData.meal})</p>
            </div>
          ) : (
            <>
              <h3>Eat or Skip?</h3>
              <p style={{marginBottom: '15px', opacity: 0.9}}>Mark your absence to reduce waste.</p>
              <div className="skip-inputs">
                <select className="widget-select" value={skipData.day} onChange={(e) => setSkipData({...skipData, day: e.target.value})}>
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                </select>
                <select className="widget-select" value={skipData.meal} onChange={(e) => setSkipData({...skipData, meal: e.target.value})}>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>
              <button className="action-btn" onClick={handleSkipSubmit}>Skip This Meal</button>
            </>
          )}
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