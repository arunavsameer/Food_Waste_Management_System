import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react'; 

// ==========================================
// CONFIGURATION: SKIP CUTOFF TIMES (24-Hour Format)
// Easy to change later. hour: 0-23, minute: 0-59
// ==========================================
const SKIP_CUTOFF_TIMES = {
  Breakfast: { hour: 7, minute: 0 },   // 7:00 AM
  Lunch:     { hour: 11, minute: 30 }, // 11:30 AM
  Dinner:    { hour: 19, minute: 0 }   // 7:00 PM
};

const CalendarView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); 
  
  // State for caterer selection
  const [caterersList, setCaterersList] = useState([]);
  const [selectedCatererId, setSelectedCatererId] = useState('');
  
  // State for our bottom-right error toast
  const [toastError, setToastError] = useState(null);
  
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
  
  // Calculate padding for Monday-start calendar
  // 0 is Sunday, 1 is Monday -> map to: Monday=0, Tuesday=1 ... Sunday=6
  const startDay = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7; 

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const showErrorToast = (message) => {
    setToastError(message);
    setTimeout(() => setToastError(null), 3500); 
  };

  // 1. Fetch Caterers and set initial selected caterer based on student profile
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch all available caterers
        const { data: caterersData, error: caterersError } = await supabase
          .from('caterers')
          .select('caterer_id, name')
          .order('name');
          
        if (caterersError) throw caterersError;
        if (caterersData) setCaterersList(caterersData);

        // Fetch current user's default caterer
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) return;

        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('caterer_id')
          .eq('id', session.user.id)
          .single();

        if (studentError) throw studentError;

        if (studentData?.caterer_id) {
          setSelectedCatererId(studentData.caterer_id);
        } else if (caterersData && caterersData.length > 0) {
          // Fallback to first caterer if student has no assigned caterer
          setSelectedCatererId(caterersData[0].caterer_id);
        }
      } catch (err) {
        console.error("Error fetching initial caterer data:", err.message);
      }
    };

    fetchInitialData();
  }, []);

  // 2. Fetch Calendar Feedback Data when date, meal, or caterer changes
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (!selectedCatererId) return; // Don't fetch until we have a caterer selected

      try {
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('feedback_cal')
          .select('*')
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .eq('meal_type', mealType.toLowerCase())
          .eq('caterer_id', selectedCatererId); 

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
  }, [month, year, mealType, selectedCatererId]); // Re-run if caterer changes

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
  const [isSkipping, setIsSkipping] = useState(false); 

  const handleSkipSubmit = async () => {
    setIsSkipping(true);
    setToastError(null); 
    
    try {
      if (skipData.day === 'Today') {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const cutoff = SKIP_CUTOFF_TIMES[skipData.meal];

        if (
          currentHour > cutoff.hour || 
          (currentHour === cutoff.hour && currentMinute >= cutoff.minute)
        ) {
          const ampm = cutoff.hour >= 12 ? 'PM' : 'AM';
          const displayHour = cutoff.hour > 12 ? cutoff.hour - 12 : (cutoff.hour === 0 ? 12 : cutoff.hour);
          const displayMinute = cutoff.minute.toString().padStart(2, '0');
          
          throw new Error(`It is too late to skip today's ${skipData.meal}. The cutoff time was ${displayHour}:${displayMinute} ${ampm}.`);
        }
      }

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Please log in to skip meals.");

      const targetDate = new Date();
      if (skipData.day === 'Tomorrow') {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      const dateString = targetDate.toISOString().split('T')[0];
      const menuType = skipData.meal.toLowerCase(); 

      const { error } = await supabase
        .from('skip_table')
        .insert([{
          date: dateString,
          menu_type: menuType,
          student_id: session.user.id
        }]);

      if (error) {
        if (error.code === '23505') {
          throw new Error(`You have already skipped ${skipData.meal} for ${skipData.day}.`);
        }
        throw error;
      }

      setIsSkipped(true);
      setTimeout(() => setIsSkipped(false), 3000);
    } catch (err) {
      showErrorToast(err.message || "Failed to mark meal as skipped. Please try again.");
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <div className="calendar-layout" style={{ position: 'relative' }}>
      
      {toastError && (
        <div 
          className="feedback-toast error" 
          onClick={() => setToastError(null)}
          style={{ cursor: 'pointer' }}
        >
          <div className="toast-icon">
            <AlertCircle color="#ffffff" size={16} />
          </div>
          <div>{toastError}</div>
        </div>
      )}

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="nav-header">
            <button onClick={prevMonth} className="nav-arrow-btn"><ChevronLeft size={20} /></button>
            <span className="month-label">{monthNames[month]} {year}</span>
            <button onClick={nextMonth} className="nav-arrow-btn"><ChevronRight size={20} /></button>
          </div>
          
          {/* Controls Container */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* New Caterer Dropdown */}
            <select 
              value={selectedCatererId} 
              onChange={(e) => setSelectedCatererId(e.target.value)} 
              className="header-select"
            >
              {caterersList.length === 0 && <option value="">Loading...</option>}
              {caterersList.map(caterer => (
                <option key={caterer.caterer_id} value={caterer.caterer_id}>
                  {caterer.name}
                </option>
              ))}
            </select>

            <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="header-select">
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
            </select>
          </div>
        </div>

        <div className="legend">
          <span className="dot green"></span> Good
          <span className="dot yellow" style={{ marginLeft: '10px' }}></span> Avg
          <span className="dot red" style={{ marginLeft: '10px' }}></span> Bad
        </div>

        <div className="calendar-grid">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
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
              <button className="action-btn" onClick={handleSkipSubmit} disabled={isSkipping}>
                 {isSkipping ? 'Processing...' : 'Skip This Meal'}
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