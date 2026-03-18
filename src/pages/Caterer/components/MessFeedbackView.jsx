import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle, ChevronLeft, ChevronRight, X, MessageSquare, Smile, Meh, Frown, Loader2 } from 'lucide-react'; 

const MessFeedbackView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [calendarData, setCalendarData] = useState([]);
  const [recentComments, setRecentComments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null); 
  const [loading, setLoading] = useState(true);
  
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

  const prevMonth = () => {
    setLoading(true);
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setLoading(true);
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const fetchFeedback = async () => {
      // We don't clear calendarData here to keep the UI from flickering, 
      // but we set loading to show the progress indicator.
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        const { data: calData, error: calError } = await supabase
          .from('feedback_cal')
          .select('*')
          .eq('caterer_id', user.id)
          .eq('meal_type', mealType.toLowerCase())
          .gte('date', startOfMonth)
          .lte('date', endOfMonth);

        if (calError) throw calError;

        const { data: rawComments, error: commentError } = await supabase
          .from('feedback')
          .select('*')
          .eq('caterer_id', user.id)
          .eq('meal_type', mealType.toLowerCase())
          .order('id', { ascending: false })
          .limit(5);

        const formattedData = (calData || []).map(row => {
          const score = row.average;
          let status = 'bad';
          if (score >= 7) status = 'good';
          else if (score >= 5) status = 'mid';

          return {
            day: parseInt(row.date.split('-')[2], 10),
            rating: score.toFixed(1),
            count: row.feedback_count,
            status: status,
            dish: 'Standard Menu' 
          };
        });

        setCalendarData(formattedData);
        setRecentComments(rawComments || []);
      } catch (err) {
        console.error("Error loading feedback:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [month, year, mealType]);

  const getDataForDay = (dayNum) => calendarData.find(d => d.day === dayNum);

  const averageRating = useMemo(() => {
    if (calendarData.length === 0) return '0.0';
    const sum = calendarData.reduce((acc, curr) => acc + parseFloat(curr.rating), 0);
    return (sum / calendarData.length).toFixed(1);
  }, [calendarData]);

  const moodConfig = useMemo(() => {
    const num = parseFloat(averageRating);
    if (num === 0) return { Icon: MessageSquare, color: 'var(--text-muted)' };
    if (num >= 7.5) return { Icon: Smile, color: 'var(--primary-green)' };
    if (num >= 5) return { Icon: Meh, color: 'var(--warning)' };
    return { Icon: Frown, color: 'var(--danger)' };
  }, [averageRating]);

  return (
    <div className="calendar-layout" style={{ position: 'relative' }}>
      
      {/* MODAL OVERLAY */}
      {selectedDay && (
        <div 
          onClick={() => setSelectedDay(null)}
          className="modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
              padding: '25px', borderRadius: '16px', width: '90%', maxWidth: '380px',
              position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', color: 'var(--text-main)'
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
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Meal Type</span>
              <strong>{mealType}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Average Score</span>
              <strong style={{ fontSize: '1.3rem', color: selectedDay.status === 'good' ? 'var(--primary-green)' : selectedDay.status === 'mid' ? 'var(--warning)' : 'var(--danger)' }}>
                {selectedDay.rating} / 10
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Participation</span>
              <strong>{selectedDay.count} Reviews</strong>
            </div>
          </div>
        </div>
      )}

      <div className="calendar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="nav-header" style={{ position: 'relative' }}>
            <button onClick={prevMonth} className="nav-arrow-btn"><ChevronLeft size={20} /></button>
            <span className="month-label">
              {monthNames[month]} {year}
              {loading && <Loader2 className="spinner" size={14} style={{ position: 'absolute', right: '-25px', top: '12px', opacity: 0.6 }} />}
            </span>
            <button onClick={nextMonth} className="nav-arrow-btn"><ChevronRight size={20} /></button>
          </div>

          <select 
            value={mealType}
            onChange={(e) => { setLoading(true); setMealType(e.target.value); }}
            className="header-select"
          >
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

        <div className={`calendar-grid ${loading ? 'grid-loading' : ''}`}>
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
                style={{ cursor: data ? 'pointer' : 'default' }}
              >
                <div className="date-num">{dayNum}</div>
                {data ? (
                  <>
                    <div className="rating-score">{data.rating}</div>
                    <div className="dish-name">{data.count} rev.</div>
                  </>
                ) : <div className="dish-name" style={{ marginTop: 'auto', opacity: 0.2 }}>-</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className={`card ${loading ? 'widget-loading' : ''}`} style={{ textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '25px' }}>
          <moodConfig.Icon size={44} style={{ marginBottom: 10, color: moodConfig.color }} />
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-main)' }}>{averageRating}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Monthly {mealType} Average</p>
        </div>

        <div className={`card ${loading ? 'widget-loading' : ''}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginTop: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text-main)' }}>Recent Comments</h3>
          {recentComments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No comments for this meal yet.</p>
          ) : (
            <div className="caterer-comments">
              {recentComments.map((c, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.date || "Recent Entry"}</span>
                    <span className={`dot ${parseFloat(c.rating) >= 7 ? 'green' : parseFloat(c.rating) >= 5 ? 'yellow' : 'red'}`} style={{ width: 'auto', height: 'auto', padding: '2px 8px', borderRadius: '4px', color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>
                      {c.rating}/10
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>{c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .calendar-grid { transition: opacity 0.3s ease; }
        .grid-loading { opacity: 0.5; pointer-events: none; }
        .widget-loading { filter: blur(2px); opacity: 0.7; pointer-events: none; }

        .calendar-cell.good { background: rgba(46, 204, 113, 0.08); border: 1px solid rgba(46, 204, 113, 0.4); }
        .calendar-cell.mid { background: rgba(230, 126, 34, 0.08); border: 1px solid rgba(230, 126, 34, 0.4); }
        .calendar-cell.bad { background: rgba(231, 76, 60, 0.08); border: 1px solid rgba(231, 76, 60, 0.4); }

        [data-theme='dark'] .calendar-cell.good { background: rgba(46, 204, 113, 0.2); border-color: var(--primary-green); }
        [data-theme='dark'] .calendar-cell.mid { background: rgba(230, 126, 34, 0.2); border-color: #e67e22; }
        [data-theme='dark'] .calendar-cell.bad { background: rgba(231, 76, 60, 0.2); border-color: var(--danger); }
        
        .nav-header { background: var(--bg-card); border: 1px solid var(--border-color); }
        .month-label { color: var(--text-main); display: flex; align-items: center; gap: 8px; }
        .header-select { background-color: var(--bg-input); color: var(--text-main); border-color: var(--border-color); }
      `}</style>
    </div>
  );
};

export default MessFeedbackView;