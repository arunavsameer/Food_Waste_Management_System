import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'; 

const CalendarView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); 
  
  const getRealTimeMeal = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  };

  const [mealType, setMealType] = useState(getRealTimeMeal());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); 

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) return; 
        
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('caterer_id')
          .eq('id', session.user.id)
          .single();

        if (studentError || !studentData?.caterer_id) return;

        const catererId = studentData.caterer_id;
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('feedback_cal')
          .select('*')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .eq('meal_type', mealType.toLowerCase())
          .eq('caterer_id', catererId); 

        if (error) throw error;

        const formattedData = data.map(row => {
          const dayNum = parseInt(row.date.split('-')[2], 10);
          const score = row.average;
          
          let status = 'bad';
          if (score >= 7) status = 'good';
          else if (score >= 5) status = 'mid';

          return {
            day: dayNum,
            rating: score.toFixed(1),
            count: row.feedback_count, 
            status: status,
            dish: 'Menu Item' 
          };
        });

        setCalendarData(formattedData);
      } catch (err) {
        console.error("Error fetching calendar data:", err.message);
      }
    };

    fetchCalendarData();
  }, [month, year, mealType]); 

  const getDataForDay = (dayNum) => {
    return calendarData.find(d => d.day === dayNum);
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
    <div className="calendar-layout" style={{ position: 'relative' }}>
      
      {/* MODAL OVERLAY - Themed */}
      {selectedDay && (
        <div 
          onClick={() => setSelectedDay(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
              padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '350px',
              position: 'relative', boxShadow: 'var(--shadow)', color: 'var(--text-main)'
            }}
          >
            <button 
              onClick={() => setSelectedDay(null)} 
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>
              {monthNames[month]} {selectedDay.day}, {year}
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Meal</span>
              <strong>{mealType}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Avg Rating</span>
              <strong style={{ fontSize: '1.2rem', color: selectedDay.status === 'good' ? 'var(--primary-green)' : selectedDay.status === 'mid' ? 'var(--warning)' : 'var(--danger)' }}>
                {selectedDay.rating} / 10
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Feedback</span>
              <strong>{selectedDay.count} Students</strong>
            </div>
          </div>
        </div>
      )}

      <div className="calendar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="nav-header">
            <button onClick={prevMonth} className="nav-arrow-btn"><ChevronLeft size={20} /></button>
            <span className="month-label">{monthNames[month]} {year}</span>
            <button onClick={nextMonth} className="nav-arrow-btn"><ChevronRight size={20} /></button>
          </div>
          <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="header-select">
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>

        <div className="legend">
          <span className="dot green"></span> Good
          <span className="dot yellow" style={{ marginLeft: '10px' }}></span> Avg
          <span className="dot red" style={{ marginLeft: '10px' }}></span> Bad
        </div>

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
              <div 
                key={dayNum} 
                className={`calendar-cell ${statusClass}`}
                onClick={() => data && setSelectedDay(data)}
                style={{ cursor: data ? 'pointer' : 'default', transition: 'transform 0.1s' }}
                onMouseOver={(e) => data && (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => data && (e.currentTarget.style.transform = 'scale(1)')}
              >
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