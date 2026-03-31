import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase'; 
import { Smile, Meh, Frown, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';

const TrendsView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [historyData, setHistoryData] = useState([]);
  const [caterersList, setCaterersList] = useState([]); // State to store caterer names
  const [selectedLog, setSelectedLog] = useState(null); 
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
  const startDay = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7; 
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  // 1. Fetch Caterers once on mount
  useEffect(() => {
    const fetchCaterers = async () => {
      const { data, error } = await supabase
        .from('caterers')
        .select('caterer_id, name');
      if (!error) setCaterersList(data);
    };
    fetchCaterers();
  }, []);

  // 2. Fetch Feedback and map names
  useEffect(() => {
    const fetchMyFeedback = async () => {
      setLoading(true);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const startOfMonth = formatLocalDate(new Date(year, month, 1));
        const endOfMonth = formatLocalDate(new Date(year, month + 1, 0));

        const { data, error } = await supabase
          .from('feedback')
          .select('date, rating, comment, caterer_id') // Fetch caterer_id to map later
          .eq('student_id', user.id)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)
          .eq('meal_type', mealType.toLowerCase());

        if (error) throw error;

        const formattedData = data.map(item => {
          // Resolve caterer name from the pre-fetched list
          const caterer = caterersList.find(c => c.caterer_id === item.caterer_id);
          return {
            day: parseInt(item.date.split('-')[2], 10),
            rating: item.rating,
            comment: item.comment || '-',
            catererName: caterer ? caterer.name : 'EcoPlate Mess'
          };
        });

        setHistoryData(formattedData);
      } catch (err) {
        console.error("Error fetching trend data:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMyFeedback();
  }, [month, year, mealType, caterersList]); // Re-run when caterersList loads

  const getLogForDay = (dayNum) => historyData.find(h => h.day === dayNum);

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
      
      {/* MODAL OVERLAY */}
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
            <button onClick={() => setSelectedLog(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.2rem' }}>
              {monthNames[month]} {selectedLog.day}, {year}
            </h3>
            
            {/* FIXED: Caterer Name Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Caterer</span>
              <strong style={{ color: 'var(--primary-blue)' }}>{selectedLog.catererName}</strong>
            </div>

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
              <p style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '15px', borderRadius: '8px', marginTop: '8px', fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-main)' }}>
                {selectedLog.comment === '-' ? "No comment provided." : `"${selectedLog.comment}"`}
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
          <select value={mealType} onChange={(e) => { setLoading(true); setMealType(e.target.value); }} className="header-select">
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>
        
        <div className={`calendar-grid ${loading ? 'loading-blur' : ''}`}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <div key={d} className="grid-header">{d}</div>)}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="calendar-cell empty"></div>)}

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
                style={{ cursor: log ? 'pointer' : 'default' }}
              >
                <div className="date-num">{dayNum}</div>
                {log ? (
                  <>
                    <div className="rating-score">{log.rating}</div>
                    {/* RESTORED: Basic comment snippet in cell */}
                    <div className="dish-name" style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                      {log.comment !== '-' ? log.comment : '-'}
                    </div>
                  </>
                ) : <div className="dish-name" style={{ opacity: 0.3 }}>-</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets" style={{ flex: 1 }}>
        <div className="menu-card" style={{ textAlign: 'center' }}>
            {loading ? <Loader2 className="spinner" size={48} /> : <MoodIcon size={48} style={{ color: moodColor }} />}
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{averageRating}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Avg {mealType} Rating</p>
        </div>
      </div>

      <style>{`
        .loading-blur { opacity: 0.5; filter: blur(2px); pointer-events: none; transition: all 0.3s; }
        .spinner { animation: spin 1s linear infinite; margin: 0 auto; color: var(--primary-green); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default TrendsView;