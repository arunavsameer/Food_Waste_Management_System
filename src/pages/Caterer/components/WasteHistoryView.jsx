import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Coffee, Utensils, Moon, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const WasteHistoryView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Set loading to true immediately on nav click to trigger dimmed state
  const prevMonth = () => {
    setLoading(true);
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setLoading(true);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  useEffect(() => {
    const fetchMonthData = async () => {
      // Note: We don't clear dbLogs here so the old data stays visible 
      // behind the dimmed overlay until the new data arrives.
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const start = new Date(year, month, 1).toISOString().split('T')[0];
      const end = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('waste_reports')
        .select('*')
        .eq('caterer_id', user.id)
        .gte('report_date', start)
        .lte('report_date', end)
        .order('report_date', { ascending: true });

      if (!error) {
        setDbLogs(data || []);
      }
      setLoading(false);
    };

    fetchMonthData();
  }, [year, month]);

  const wasteByDay = useMemo(() => {
    const map = new Map();
    dbLogs.forEach((log) => {
      const day = parseInt(log.report_date.split('-')[2], 10);
      if (!map.has(day)) {
        map.set(day, { totalDayWaste: 0, mealCount: 0, allMeals: [] });
      }
      const dayData = map.get(day);
      const logTotal = (Number(log.kitchen_uncooked) || 0) + 
                       (Number(log.kitchen_cooked) || 0) + 
                       (Number(log.plate_waste) || 0);
      dayData.totalDayWaste += logTotal;
      dayData.mealCount += 1;
      dayData.allMeals.push(log);
    });
    map.forEach((data) => {
      data.dayAvg = data.mealCount > 0 ? Number((data.totalDayWaste / data.mealCount).toFixed(1)) : 0;
    });
    return map;
  }, [dbLogs]);

  const stats = useMemo(() => {
    if (dbLogs.length === 0) return { avg: '0.0', totalMeals: 0 };
    const grandTotalWaste = dbLogs.reduce((acc, m) => 
      acc + (Number(m.kitchen_uncooked) || 0) + (Number(m.kitchen_cooked) || 0) + (Number(m.plate_waste) || 0)
    , 0);
    return { avg: (grandTotalWaste / dbLogs.length).toFixed(1), totalMeals: dbLogs.length };
  }, [dbLogs]);

  const getStatus = (val) => {
    if (val === 0) return 'neutral';
    if (val <= 10) return 'good';
    if (val <= 25) return 'mid';
    return 'bad';
  };

  return (
    <div className="calendar-layout">
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
          <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            Daily Average Waste
          </div>
        </div>

        {/* Grid is always rendered, loading state is handled via CSS classes */}
        <div className={`calendar-grid ${loading ? 'grid-loading' : ''}`}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => <div key={d} className="grid-header">{d}</div>)}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} className="calendar-cell empty" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayData = wasteByDay.get(dayNum);
            const avg = dayData?.dayAvg || 0;

            return (
              <div 
                key={dayNum} 
                className={`calendar-cell ${getStatus(avg)} ${dayData ? 'has-data' : ''}`}
                onClick={() => dayData && setSelectedDayDetail({ day: dayNum, meals: dayData.allMeals, total: dayData.totalDayWaste, count: dayData.mealCount })}
              >
                <div className="date-num">{dayNum}</div>
                {avg > 0 ? (
                  <>
                    <div className="rating-score">{avg}</div>
                    <div className="dish-name">kg / meal</div>
                  </>
                ) : <div className="dish-name" style={{ opacity: 0.3 }}>-</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className={`eat-skip-card ${loading ? 'widget-loading' : ''}`} style={{ background: 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)' }}>
          <h3>Your Mess Stats</h3>
          <p>Average waste per meal this month.</p>
          <span className="big-score" style={{ fontSize: '3.5rem', fontWeight: 900, color: 'white' }}>{stats.avg}</span>
          <p>KG PER MEAL</p>
          <div style={{ marginTop: '10px', fontSize: '0.85rem', opacity: 0.9 }}>Total Logs: {stats.totalMeals}</div>
        </div>
      </div>

      {/* Modal remains unchanged logic-wise, but ensure styles use variables */}
      {selectedDayDetail && (
        <div className="emoji-shower-overlay" style={{ background: 'rgba(0,0,0,0.85)', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="feedback-card" style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '16px', minWidth: '400px', position: 'relative', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <button onClick={() => setSelectedDayDetail(null)} style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>
            <h3 style={{ marginBottom: '10px', color: 'var(--text-main)' }}>Day {selectedDayDetail.day} Breakdown</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Total: <strong>{selectedDayDetail.total.toFixed(1)}kg</strong> across <strong>{selectedDayDetail.count} meals</strong>.</p>
            
            {['breakfast', 'lunch', 'dinner'].map(type => {
              const m = selectedDayDetail.meals.find(meal => meal.meal_type.toLowerCase().trim() === type);
              return (
                <div key={type} className="menu-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {type === 'breakfast' && <Coffee size={20} color="#e67e22" />}
                    {type === 'lunch' && <Utensils size={20} color="#e67e22" />}
                    {type === 'dinner' && <Moon size={20} color="#e67e22" />}
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-main)' }}>{type}</span>
                  </div>
                  {m ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{(Number(m.kitchen_cooked) + Number(m.kitchen_uncooked) + Number(m.plate_waste)).toFixed(1)} kg</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>K: {m.kitchen_cooked} | P: {m.plate_waste}</div>
                    </div>
                  ) : <span style={{ color: 'var(--border-color)', fontSize: '0.8rem' }}>No Entry</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .calendar-grid { transition: opacity 0.3s ease; }
        .grid-loading { opacity: 0.5; pointer-events: none; }
        .widget-loading { filter: blur(2px); opacity: 0.7; pointer-events: none; }

        .calendar-cell.has-data { cursor: pointer; }
        .calendar-cell.good { background-color: rgba(46, 204, 113, 0.08); border-color: rgba(46, 204, 113, 0.4); }
        .calendar-cell.mid { background-color: rgba(230, 126, 34, 0.08); border-color: rgba(230, 126, 34, 0.4); }
        .calendar-cell.bad { background-color: rgba(231, 76, 60, 0.08); border-color: rgba(231, 76, 60, 0.4); }

        [data-theme='dark'] .calendar-cell.good { background: rgba(46, 204, 113, 0.2); border-color: var(--primary-green); }
        [data-theme='dark'] .calendar-cell.mid { background: rgba(230, 126, 34, 0.2); border-color: #e67e22; }
        [data-theme='dark'] .calendar-cell.bad { background: rgba(231, 76, 60, 0.2); border-color: var(--danger); }
        
        .nav-header { background: var(--bg-card); border-color: var(--border-color); }
        .month-label { color: var(--text-main); display: flex; align-items: center; gap: 8px; }
        .nav-arrow-btn { color: var(--text-muted); }
      `}</style>
    </div>
  );
};

export default WasteHistoryView;