import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MessageSquare, Smile, Meh, Frown, Loader2 } from 'lucide-react';

const MessFeedbackView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [calendarData, setCalendarData] = useState([]);
  const [recentComments, setRecentComments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default meal based on current time
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
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // ==========================================
  // FETCH FEEDBACK DATA FROM SUPABASE
  // ==========================================
  useEffect(() => {
    const fetchFeedbackData = async () => {
      setLoading(true);
      try {
        // 1. Get current logged-in Caterer
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        // 2. Format date range (YYYY-MM-DD)
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        // 3. Fetch Aggregated Daily Averages for Grid
        const { data: calData, error: calError } = await supabase
          .from('feedback_cal')
          .select('*')
          .eq('caterer_id', user.id)
          .eq('meal_type', mealType.toLowerCase())
          .gte('date', startOfMonth)
          .lte('date', endOfMonth);

        if (calError) throw calError;

        // 4. Fetch Recent Comments for Sidebar
        const { data: commentData, error: commentError } = await supabase
          .from('feedback')
          .select('*')
          .eq('caterer_id', user.id)
          .eq('meal_type', mealType.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(5);

        if (commentError) throw commentError;

        // Map data for grid lookup
        const formattedCal = (calData || []).map(row => ({
          day: parseInt(row.date.split('-')[2], 10),
          average: row.average,
          count: row.feedback_count
        }));

        setCalendarData(formattedCal);
        setRecentComments(commentData || []);
      } catch (err) {
        console.error("Error fetching feedback:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedbackData();
  }, [month, year, mealType]);

  const getDataForDay = (dayNum) => {
    return calendarData.find(d => d.day === dayNum);
  };

  const getStatusClass = (rating) => {
    if (rating >= 7) return 'good';
    if (rating >= 5) return 'mid';
    return 'bad';
  };

  const averageRating = useMemo(() => {
    if (calendarData.length === 0) return '0.0';
    const sum = calendarData.reduce((acc, curr) => acc + curr.average, 0);
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
    <div className="calendar-layout">
      <div className="calendar-section">
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="nav-header">
            <button onClick={prevMonth} className="nav-arrow-btn"><ChevronLeft size={20} /></button>
            <span className="month-label">{monthNames[month]} {year}</span>
            <button onClick={nextMonth} className="nav-arrow-btn"><ChevronRight size={20} /></button>
          </div>

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
          <span className="dot green"></span> Good (7+)
          <span className="dot yellow" style={{ marginLeft: '10px' }}></span> Avg (5-7)
          <span className="dot red" style={{ marginLeft: '10px' }}></span> Bad (&lt;5)
        </div>

        {/* CALENDAR GRID */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <Loader2 className="spinner" size={40} />
          </div>
        ) : (
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
              const statusClass = data ? getStatusClass(data.average) : 'neutral';

              return (
                <div key={dayNum} className={`calendar-cell ${statusClass}`}>
                  <div className="date-num">{dayNum}</div>
                  {data ? (
                    <>
                      <div className="rating-score">{data.average.toFixed(1)}</div>
                      <div className="dish-name">{data.count} reviews</div>
                    </>
                  ) : <div className="dish-name" style={{ marginTop: 'auto', opacity: 0.2 }}>-</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SIDEBAR WIDGETS */}
      <div className="sidebar-widgets">
        <div className="card" style={{ textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <moodConfig.Icon size={44} style={{ marginBottom: 10, color: moodConfig.color }} />
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-main)' }}>{averageRating}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Monthly {mealType} Average</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 5 }}>Mess: <strong>{messName}</strong></p>
        </div>

        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--text-main)' }}>Recent Comments</h3>
          {recentComments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No comments for this meal yet.</p>
          ) : (
            <div className="caterer-comments">
              {recentComments.map((c, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    <span className={`dot ${getStatusClass(c.rating)}`} style={{ width: 'auto', height: 'auto', padding: '2px 8px', borderRadius: '4px', color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>
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
        /* Theme Aware Overrides */
        .calendar-cell.good { background: rgba(46, 204, 113, 0.08); border: 1px solid rgba(46, 204, 113, 0.4); }
        .calendar-cell.mid { background: rgba(230, 126, 34, 0.08); border: 1px solid rgba(230, 126, 34, 0.4); }
        .calendar-cell.bad { background: rgba(231, 76, 60, 0.08); border: 1px solid rgba(231, 76, 60, 0.4); }

        [data-theme='dark'] .calendar-cell.good { background: rgba(46, 204, 113, 0.2); border-color: var(--primary-green); }
        [data-theme='dark'] .calendar-cell.mid { background: rgba(230, 126, 34, 0.2); border-color: #e67e22; }
        [data-theme='dark'] .calendar-cell.bad { background: rgba(231, 76, 60, 0.2); border-color: var(--danger); }
        
        .nav-header { background: var(--bg-card); border: 1px solid var(--border-color); }
        .month-label { color: var(--text-main); }
        .header-select { background-color: var(--bg-input); color: var(--text-main); border-color: var(--border-color); }
      `}</style>
    </div>
  );
};

export default MessFeedbackView;