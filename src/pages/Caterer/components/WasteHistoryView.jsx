import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Coffee, Utensils, Moon, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const WasteHistoryView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [chartMealType, setChartMealType] = useState('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const prevMonth = () => { setLoading(true); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setLoading(true); setCurrentDate(new Date(year, month + 1, 1)); };

  useEffect(() => {
    const fetchHistoryData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const endMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const startRange = fourteenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('waste_reports')
        .select('*')
        .eq('caterer_id', user.id)
        .gte('report_date', startRange)
        .lte('report_date', endMonth)
        .order('report_date', { ascending: true });

      if (!error) setDbLogs(data || []);
      setLoading(false);
    };
    fetchHistoryData();
  }, [year, month]);

  const weeklyComparisonData = useMemo(() => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const currentSun = new Date(today);
    currentSun.setDate(today.getDate() - today.getDay());
    currentSun.setHours(0, 0, 0, 0);

    const prevSun = new Date(currentSun);
    prevSun.setDate(currentSun.getDate() - 7);

    return days.map((dayName, index) => {
      const curDate = new Date(currentSun);
      curDate.setDate(currentSun.getDate() + index);
      const curDateStr = curDate.toISOString().split('T')[0];

      const preDate = new Date(prevSun);
      preDate.setDate(prevSun.getDate() + index);
      const preDateStr = preDate.toISOString().split('T')[0];

      const getWaste = (dateStr) => {
        const val = dbLogs
          .filter(log => log.report_date === dateStr && (chartMealType === 'all' || log.meal_type.toLowerCase() === chartMealType))
          .reduce((sum, log) => sum + (Number(log.kitchen_uncooked) + Number(log.kitchen_cooked) + Number(log.plate_waste)), 0);
        return val || 0;
      };

      return {
        name: dayName,
        current: curDateStr > todayStr ? null : getWaste(curDateStr),
        previous: getWaste(preDateStr)
      };
    });
  }, [dbLogs, chartMealType]);

  const wasteByDay = useMemo(() => {
    const map = new Map();
    const monthLogs = dbLogs.filter(log => {
      const d = new Date(log.report_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    monthLogs.forEach((log) => {
      const day = parseInt(log.report_date.split('-')[2], 10);
      if (!map.has(day)) map.set(day, { totalDayWaste: 0, mealCount: 0, allMeals: [] });
      const dayData = map.get(day);
      dayData.totalDayWaste += (Number(log.kitchen_uncooked) + Number(log.kitchen_cooked) + Number(log.plate_waste));
      dayData.mealCount += 1;
      dayData.allMeals.push(log);
    });
    map.forEach((data) => data.dayAvg = data.mealCount > 0 ? Number((data.totalDayWaste / data.mealCount).toFixed(1)) : 0);
    return map;
  }, [dbLogs, year, month]);

  const stats = useMemo(() => {
    const monthLogs = dbLogs.filter(log => {
      const d = new Date(log.report_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    if (monthLogs.length === 0) return { avg: '0.0', totalMeals: 0 };
    const total = monthLogs.reduce((acc, m) => acc + (Number(m.kitchen_uncooked) + Number(m.kitchen_cooked) + Number(m.plate_waste)), 0);
    return { avg: (total / monthLogs.length).toFixed(1), totalMeals: monthLogs.length };
  }, [dbLogs, year, month]);

  return (
    <div className="calendar-layout">
      <div className="calendar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div className="nav-header">
            <button onClick={prevMonth} className="nav-arrow-btn"><ChevronLeft size={18} /></button>
            <span className="month-label" style={{ fontSize: '0.95rem' }}>
              {monthNames[month]} {year}
              {loading && <Loader2 className="spinner" size={14} style={{ marginLeft: '8px', opacity: 0.6 }} />}
            </span>
            <button onClick={nextMonth} className="nav-arrow-btn"><ChevronRight size={18} /></button>
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Daily Average Waste</div>
        </div>

        <div className={`calendar-grid ${loading ? 'grid-loading' : ''}`}>
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
            <div key={d} className="grid-header" style={{ fontSize: '0.75rem' }}>{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="calendar-cell empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const data = wasteByDay.get(dayNum);
            const avg = data?.dayAvg || 0;
            return (
              <div
                key={dayNum}
                className={`calendar-cell ${getStatus(avg)} ${data ? 'has-data' : ''}`}
                onClick={() => data && setSelectedDayDetail({ day: dayNum, meals: data.allMeals, total: data.totalDayWaste, count: data.mealCount })}
              >
                <div className="date-num">{dayNum}</div>
                {avg > 0 ? (
                  <>
                    <div className="rating-score" style={{ fontSize: '1rem' }}>{avg}</div>
                    <div className="dish-name" style={{ fontSize: '0.65rem' }}>kg/meal</div>
                  </>
                ) : (
                  <div className="dish-name" style={{ opacity: 0.2 }}>-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets">

      {/* ✅ MESS STATS CARD — vertical layout, medium height */}
      <div style={{
        background: 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)',
        borderRadius: '16px',
        marginBottom: '15px',
        padding: '20px 24px',
        height: '180px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',       /* ← center horizontally */
        justifyContent: 'center',   /* ← center vertically */
        textAlign: 'center',        /* ← center text */
        gap: '4px',
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>Mess Stats</span>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>Monthly Average</span>
        <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'white', lineHeight: 1.1, margin: '6px 0 2px 0' }}>
          {stats.avg}
        </span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)' }}>
          KG PER MEAL
        </span>
      </div>

        {/* ✅ WEEKLY ANALYSIS CARD */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          padding: '15px',
          borderRadius: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 800 }}>Weekly Analysis</h4>

            {/* ✅ Compact custom-styled select */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                value={chartMealType}
                onChange={(e) => setChartMealType(e.target.value)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '3px 24px 3px 8px',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  colorScheme: 'dark light',
                  lineHeight: '1.4',
                }}
              >
                <option value="all">All Meals</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
              {/* custom chevron */}
              <svg
                style={{ position: 'absolute', right: '6px', pointerEvents: 'none', opacity: 0.6 }}
                width="10" height="10" viewBox="0 0 10 10" fill="none"
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyComparisonData} margin={{ left: -25, right: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.4} />
                <XAxis dataKey="name" axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }} dy={8} />
                <YAxis axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 9 }} width={45} allowDecimals={false} />
                <Tooltip contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'var(--text-main)'
                }} labelStyle={{ color: 'var(--text-main)' }} itemStyle={{ color: 'var(--text-main)' }} />
                <Legend verticalAlign="bottom" align="center" iconType="circle"
                  wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 600, color: 'var(--text-main)' }} />
                <Line name="Current" type="monotone" dataKey="current" stroke="#e67e22"
                  strokeWidth={3} connectNulls={false}
                  dot={{ r: 4, fill: '#e67e22', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                  activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line name="Previous" type="monotone" dataKey="previous"
                  stroke="var(--text-muted)" strokeDasharray="4 4" strokeWidth={2} opacity={0.5} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {selectedDayDetail && (
        <div className="emoji-shower-overlay"
          style={{ background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{
            background: 'var(--bg-card)', padding: '25px', borderRadius: '16px',
            minWidth: '350px', position: 'relative', border: '1px solid var(--border-color)'
          }}>
            <button onClick={() => setSelectedDayDetail(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '5px', fontSize: '1.1rem', color: 'var(--text-main)' }}>
              Day {selectedDayDetail.day} Breakdown
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
              Total: <strong>{selectedDayDetail.total.toFixed(1)}kg</strong>
            </p>
            {['breakfast', 'lunch', 'dinner'].map(type => {
              const m = selectedDayDetail.meals.find(meal => meal.meal_type.toLowerCase().trim() === type);
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                    {type === 'breakfast' ? <Coffee size={16} color="#e67e22" /> : type === 'lunch' ? <Utensils size={16} color="#e67e22" /> : <Moon size={16} color="#e67e22" />}
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-main)' }}>{type}</span>
                  </div>
                  {m
                    ? <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        {(Number(m.kitchen_cooked) + Number(m.kitchen_uncooked) + Number(m.plate_waste)).toFixed(1)} kg
                      </div>
                    : <span style={{ color: 'var(--border-color)', fontSize: '0.75rem' }}>-</span>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .calendar-grid { transition: opacity 0.3s ease; }
        .grid-loading { opacity: 0.5; pointer-events: none; }
        .calendar-cell.good { background-color: rgba(46,204,113,0.08); border-color: rgba(46,204,113,0.4); }
        .calendar-cell.mid  { background-color: rgba(230,126,34,0.08);  border-color: rgba(230,126,34,0.4); }
        .calendar-cell.bad  { background-color: rgba(231,76,60,0.08);   border-color: rgba(231,76,60,0.4); }
        [data-theme='dark'] .calendar-cell.good { background: rgba(46,204,113,0.2); }
        [data-theme='dark'] .calendar-cell.mid  { background: rgba(230,126,34,0.2); }
        [data-theme='dark'] .calendar-cell.bad  { background: rgba(231,76,60,0.2); }
        [data-theme='dark'] .recharts-legend-item-text { color: var(--text-main) !important; }
        [data-theme='dark'] .recharts-default-tooltip {
          background: var(--bg-card) !important;
          border-color: var(--border-color) !important;
          color: var(--text-main) !important;
        }
      `}</style>
    </div>
  );
};

const getStatus = (val) => {
  if (val === 0) return 'neutral';
  if (val <= 10) return 'good';
  if (val <= 25) return 'mid';
  return 'bad';
};

export default WasteHistoryView;