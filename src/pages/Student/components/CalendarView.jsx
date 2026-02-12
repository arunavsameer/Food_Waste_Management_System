import React from 'react';

const CalendarView = ({ messName }) => {
  const calendarDays = [
    { day: 14, rating: 8.0, dish: 'Butter Chicken', status: 'good' },
    { day: 15, rating: 8.0, dish: 'Dal Makhani', status: 'good' },
    { day: 16, rating: 9.0, dish: 'Fried Rice', status: 'good' },
    { day: 17, rating: 6.0, dish: 'Chole Bhature', status: 'mid' },
    { day: 18, rating: 4.5, dish: 'Biryani', status: 'bad' },
    { day: 19, rating: 7.0, dish: 'Rajma Chawal', status: 'mid' },
    { day: 20, rating: 7.0, dish: 'Masala Dosa', status: 'mid' },
  ];

  const getStatusColor = (status) => {
    if (status === 'good') return '#d1fae5';
    if (status === 'mid') return '#fef3c7';
    return '#fee2e2';
  };

  return (
    <div className="calendar-layout">
      <div className="calendar-section">
        <div className="legend">
          <span className="dot green"></span> Good ({'>'}7.5)
          <span className="dot yellow"></span> Average (5-7.5)
          <span className="dot red"></span> Bad ({'<'}5)
        </div>

        <div className="calendar-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          {calendarDays.map((item, index) => (
            <div key={index} className="calendar-cell" style={{ backgroundColor: getStatusColor(item.status) }}>
              <div className="date-num">{item.day}</div>
              <div className="rating-score">{item.rating}</div>
              <div className="dish-name">{item.dish}</div>
            </div>
          ))}
          {[...Array(20)].map((_, i) => <div key={i} className="calendar-cell empty"></div>)}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className="eat-skip-card">
          <h3>Eat or Skip?</h3>
          <p>Based on last week's "Rajma Chawal" (Fri):</p>
          <div className="rating-display">
            <span className="big-score">8.2</span>
            <span className="avg-label">Average Rating</span>
          </div>
          <button className="action-btn">Go to Mess</button>
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