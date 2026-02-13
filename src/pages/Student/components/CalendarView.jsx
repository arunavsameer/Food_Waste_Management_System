import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react'; 

const CalendarView = ({ messName }) => {
  // --- 1. Calendar Data Logic (Views CURRENT Meal) ---
  const getCurrentMealType = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  };

  const [mealType, setMealType] = useState(getCurrentMealType());

  // --- 2. Skip Widget Logic (Defaults to NEXT Meal) ---
  const getNextMealDefaults = () => {
    const hour = new Date().getHours();
    // Logic: Propose the upcoming meal relative to now
    if (hour < 11) return { day: 'Today', meal: 'Lunch' };      // Morning -> Skip Lunch
    if (hour < 16) return { day: 'Today', meal: 'Dinner' };     // Afternoon -> Skip Dinner
    return { day: 'Tomorrow', meal: 'Breakfast' };              // Evening -> Skip Tmrw Breakfast
  };

  const [skipData, setSkipData] = useState(getNextMealDefaults());
  const [isSkipped, setIsSkipped] = useState(false);

  const handleSkipSubmit = () => {
    setIsSkipped(true);
    // Reset after 3 seconds
    setTimeout(() => {
      setIsSkipped(false);
      // Optional: Reset to default after success?
      // setSkipData(getNextMealDefaults()); 
    }, 3000);
  };

  // Mock Data
  const allData = [
    { day: 14, type: 'Lunch', rating: 8.0, dish: 'Butter Chicken', status: 'good' },
    { day: 15, type: 'Lunch', rating: 8.0, dish: 'Dal Makhani', status: 'good' },
    { day: 16, type: 'Lunch', rating: 9.0, dish: 'Fried Rice', status: 'good' },
    { day: 17, type: 'Lunch', rating: 6.0, dish: 'Chole Bhature', status: 'mid' },
    { day: 18, type: 'Lunch', rating: 4.5, dish: 'Biryani', status: 'bad' },
    { day: 19, type: 'Lunch', rating: 7.0, dish: 'Rajma Chawal', status: 'mid' },
    { day: 20, type: 'Lunch', rating: 7.0, dish: 'Masala Dosa', status: 'mid' },
    { day: 14, type: 'Dinner', rating: 5.0, dish: 'Mix Veg', status: 'mid' },
    { day: 15, type: 'Dinner', rating: 4.0, dish: 'Egg Curry', status: 'bad' },
    { day: 16, type: 'Dinner', rating: 8.5, dish: 'Paneer', status: 'good' },
  ];

  const visibleDays = allData.filter(d => d.type === mealType);

  return (
    <div className="calendar-layout">
      <div className="calendar-section">
        
        {/* Header with Filter */}
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

        {/* Calendar Grid */}
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
        
        {/* --- EAT OR SKIP WIDGET --- */}
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
                <select 
                  className="widget-select"
                  value={skipData.day}
                  onChange={(e) => setSkipData({...skipData, day: e.target.value})}
                >
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                </select>

                <select 
                  className="widget-select"
                  value={skipData.meal}
                  onChange={(e) => setSkipData({...skipData, meal: e.target.value})}
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>

              <button className="action-btn" onClick={handleSkipSubmit}>
                Skip This Meal
              </button>
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