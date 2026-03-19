import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase'; 
import { Smile, Meh, Frown, ChevronLeft, ChevronRight, X } from 'lucide-react';

const TrendsView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [historyData, setHistoryData] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null); 

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

  useEffect(() => {
    const fetchMyFeedback = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) return;

        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('feedback')
          .select('date, rating, comment')
          .eq('student_id', session.user.id)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .eq('meal_type', mealType.toLowerCase());

        if (error) throw error;

        const formattedData = data.map(item => ({
          day: parseInt(item.date.split('-')[2], 10),
          rating: item.rating,
          comment: item.comment || '-' 
        }));

        setHistoryData(formattedData);
      } catch (err) {
        console.error("Error fetching trend data:", err.message);
      }
    };

    fetchMyFeedback();
  }, [month, year, mealType]); 

  const getLogForDay = (dayNum) => {
    return historyData.find(h => h.day === dayNum);
  };

  const averageRating = historyData.length > 0
    ? (historyData.reduce((sum, item) => sum + item.rating, 0) / historyData.length).toFixed(1)
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
    <div className="calendar-layout" style={{ position: 'relative' }}>
      
      {/* MODAL OVERLAY - Themed */}
      {selectedLog && (
        <div 
          onClick={() => setSelectedLog(null)}
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
              onClick={() => setSelectedLog(null)} 
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>
              {monthNames[month]} {selectedLog.day}, {year}
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Meal</span>
              <strong>{mealType}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Your Rating</span>
              <strong style={{ fontSize: '1.2rem', color: selectedLog.rating >= 7 ? 'var(--primary-green)' : selectedLog.rating >= 5 ? 'var(--warning)' : 'var(--danger)' }}>
                {selectedLog.rating} / 10
              </strong>
            </div>
            <div style={{ marginTop: '20px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your Comment</span>
              <p style={{
                backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', 
                padding: '15px', borderRadius: '8px', marginTop: '8px', fontSize: '0.95rem', 
                lineHeight: '1.5', fontStyle: selectedLog.comment === '-' ? 'italic' : 'normal',
                color: selectedLog.comment === '-' ? 'var(--text-muted)' : 'var(--text-main)'
              }}>
                {selectedLog.comment === '-' ? "No comment provided for this meal." : `"${selectedLog.comment}"`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="calendar-section" style={{ flex: 3 }}>
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
        
        <div className="calendar-grid">
          {/* Changed header array to start on Monday */}
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
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
              <div 
                key={dayNum} 
                className={`calendar-cell ${statusClass}`}
                onClick={() => log && setSelectedLog(log)}
                style={{ cursor: log ? 'pointer' : 'default', transition: 'transform 0.1s' }}
                onMouseOver={(e) => log && (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => log && (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div className="date-num">{dayNum}</div>
                {log ? (
                  <>
                    <div className="rating-score">{log.rating}</div>
                    <div className="dish-name" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                      {log.comment !== '-' ? log.comment : '-'}
                    </div>
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
                <strong>{historyData.length}</strong>
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