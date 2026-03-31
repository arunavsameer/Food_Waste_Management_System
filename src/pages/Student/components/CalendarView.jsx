import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle, ChevronLeft, ChevronRight, X, AlertCircle, Loader2 } from 'lucide-react'; 

const SKIP_CUTOFF_TIMES = {
  Breakfast: { hour: 7, minute: 0 },   
  Lunch:     { hour: 11, minute: 30 }, 
  Dinner:    { hour: 19, minute: 0 }   
};

const CalendarView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); 
  const [loading, setLoading] = useState(true); // Added loading state
  
  const [caterersList, setCaterersList] = useState([]);
  const [selectedCatererId, setSelectedCatererId] = useState('');
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
  const startDay = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7; 

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Helper to format date string without UTC timezone shift
  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const prevMonth = () => {
    setLoading(true);
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    setLoading(true);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const showErrorToast = (message) => {
    setToastError(message);
    setTimeout(() => setToastError(null), 3500); 
  };

  // 1. Fetch Caterers and set initial selected caterer
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: caterersData, error: caterersError } = await supabase
          .from('caterers')
          .select('caterer_id, name')
          .order('name');
          
        if (caterersError) throw caterersError;
        if (caterersData) setCaterersList(caterersData);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('caterer_id')
          .eq('id', user.id)
          .single();

        if (studentError) throw studentError;

        if (studentData?.caterer_id) {
          setSelectedCatererId(studentData.caterer_id);
        } else if (caterersData && caterersData.length > 0) {
          setSelectedCatererId(caterersData[0].caterer_id);
        }
      } catch (err) {
        console.error("Error fetching initial caterer data:", err.message);
      }
    };

    fetchInitialData();
  }, []);

  // 2. Fetch Calendar Feedback Data
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (!selectedCatererId) return;
      setLoading(true);

      try {
        // FIXED: Using local date strings instead of .toISOString()
        const startOfMonth = formatLocalDate(new Date(year, month, 1));
        const endOfMonth = formatLocalDate(new Date(year, month + 1, 0));

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
            dish: 'Standard Menu' 
          };
        });

        setCalendarData(formattedData);
      } catch (err) {
        console.error("Error fetching calendar data:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [month, year, mealType, selectedCatererId]);

  const getDataForDay = (dayNum) => calendarData.find(d => d.day === dayNum);

  const [skipData, setSkipData] = useState({ day: 'Today', meal: 'Lunch' });
  const [isSkipped, setIsSkipped] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false); 

  const handleSkipSubmit = async () => {
    setIsSkipping(true);
    setToastError(null); 
    
    try {
      if (skipData.day === 'Today') {
        const now = new Date();
        const cutoff = SKIP_CUTOFF_TIMES[skipData.meal];

        if (now.getHours() > cutoff.hour || (now.getHours() === cutoff.hour && now.getMinutes() >= cutoff.minute)) {
          const ampm = cutoff.hour >= 12 ? 'PM' : 'AM';
          const displayHour = cutoff.hour > 12 ? cutoff.hour - 12 : (cutoff.hour === 0 ? 12 : cutoff.hour);
          throw new Error(`Too late to skip today's ${skipData.meal}. The cutoff was ${displayHour}:${cutoff.minute.toString().padStart(2, '0')} ${ampm}.`);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to skip meals.");

      const targetDate = new Date();
      if (skipData.day === 'Tomorrow') targetDate.setDate(targetDate.getDate() + 1);
      
      const { error } = await supabase.from('skip_table').insert([{
        date: formatLocalDate(targetDate),
        menu_type: skipData.meal.toLowerCase(),
        student_id: user.id
      }]);

      if (error) {
        if (error.code === '23505') throw new Error(`Already skipped ${skipData.meal} for ${skipData.day}.`);
        throw error;
      }

      setIsSkipped(true);
      setTimeout(() => setIsSkipped(false), 3000);
    } catch (err) {
      showErrorToast(err.message || "Failed to skip meal.");
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <div className="calendar-layout" style={{ position: 'relative' }}>
      
      {toastError && (
        <div className="feedback-toast error" onClick={() => setToastError(null)} style={{ cursor: 'pointer' }}>
          <div className="toast-icon"><AlertCircle color="#ffffff" size={16} /></div>
          <div>{toastError}</div>
        </div>
      )}

      {selectedDay && (
        <div 
          onClick={() => setSelectedDay(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '350px', position: 'relative', color: 'var(--text-main)' }}
          >
            <button onClick={() => setSelectedDay(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{monthNames[month]} {selectedDay.day}, {year}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}><span>Meal</span><strong>{mealType}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span>Avg Rating</span>
              <strong style={{ color: selectedDay.status === 'good' ? 'var(--primary-green)' : selectedDay.status === 'mid' ? 'var(--warning)' : 'var(--danger)' }}>
                {selectedDay.rating} / 10
              </strong>
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
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={selectedCatererId} onChange={(e) => setSelectedCatererId(e.target.value)} className="header-select">
              {caterersList.map(c => <option key={c.caterer_id} value={c.caterer_id}>{c.name}</option>)}
            </select>
            <select value={mealType} onChange={(e) => { setLoading(true); setMealType(e.target.value); }} className="header-select">
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
            </select>
          </div>
        </div>

        <div className={`calendar-grid ${loading ? 'loading-blur' : ''}`}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <div key={d} className="grid-header">{d}</div>)}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="calendar-cell empty"></div>)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const data = getDataForDay(dayNum);
            return (
              <div key={dayNum} className={`calendar-cell ${data ? data.status : 'neutral'}`} onClick={() => data && setSelectedDay(data)} style={{ cursor: data ? 'pointer' : 'default' }}>
                <div className="date-num">{dayNum}</div>
                {data ? (
                  <>
                    <div className="rating-score">{data.rating}</div>
                    <div className="dish-name">Menu Item</div>
                  </>
                ) : <div className="dish-name" style={{ opacity: 0.3 }}>-</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className={`eat-skip-card ${isSkipped ? 'success-mode' : ''}`}>
          {isSkipped ? (
            <div className="skip-success-content">
              <div className="success-circle"><CheckCircle size={50} strokeWidth={3} /></div>
              <h4>Skipped!</h4>
              <p>Mess notified for {skipData.day} ({skipData.meal})</p>
            </div>
          ) : (
            <>
              <h3>Eat or Skip?</h3>
              <p style={{marginBottom: '15px', opacity: 0.9}}>Mark absence to reduce waste.</p>
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
      </div>

      <style>{`
        .loading-blur { opacity: 0.5; filter: blur(2px); pointer-events: none; transition: all 0.3s ease; }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default CalendarView;