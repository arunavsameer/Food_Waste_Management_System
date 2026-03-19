import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Coffee, Utensils, Moon, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// Helper to avoid the UTC timezone offset bug caused by toISOString()
const toLocalISODate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WasteHistoryView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [chartMealType, setChartMealType] = useState('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Calculate padding for Monday-start calendar
  // 0 is Sunday, 1 is Monday -> map to: Monday=0, Tuesday=1 ... Sunday=6
  const startDay = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7; 
  
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const prevMonth = () => { setLoading(true); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setLoading(true); setCurrentDate(new Date(year, month + 1, 1)); };

  useEffect(() => {
    const fetchHistoryData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const endMonth = new Date(year, month + 1, 0);
      const endMonthStr = toLocalISODate(endMonth);
      
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const startRangeStr = toLocalISODate(fourteenDaysAgo);

      const { data, error } = await supabase
        .from('waste_reports')
        .select('*')
        .eq('caterer_id', user.id)
        .gte('report_date', startRangeStr)
        .lte('report_date', endMonthStr)
        .order('report_date', { ascending: true });

      if (!error) setDbLogs(data || []);
      setLoading(false);
    };
    fetchHistoryData();
  }, [year, month]);

  const weeklyComparisonData = useMemo(() => {
    // Array shifted to start on Monday
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const today = new Date();
    const todayStr = toLocalISODate(today);

    // Get the most recent Monday
    const currentMon = new Date(today);
    const dayOfWeek = currentMon.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentMon.setDate(currentMon.getDate() - diffToMonday);
    currentMon.setHours(0, 0, 0, 0);

    const prevMon = new Date(currentMon);
    prevMon.setDate(currentMon.getDate() - 7);

    return days.map((dayName, index) => {
      const curDate = new Date(currentMon);
      curDate.setDate(currentMon.getDate() + index);
      const curDateStr = toLocalISODate(curDate);

      const preDate = new Date(prevMon);
      preDate.setDate(prevMon.getDate() + index);
      const preDateStr = toLocalISODate(preDate);

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
          {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
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

      {/* MESS STATS CARD */}
      <div style={{
        background: 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)',
        borderRadius: '16px',
        marginBottom: '15px',
        padding: '20px 24px',
        height: '180px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '4px',
        boxShadow: 'var(--shadow)'
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

        {/* WEEKLY ANALYSIS CARD */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          padding: '20px',
          borderRadius: '16px',
          boxShadow: 'var(--shadow)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>Weekly Analysis</h4>

            <select
              value={chartMealType}
              onChange={(e) => setChartMealType(e.target.value)}
              className="caterer-header-select"
              style={{
                width: '130px',
                height: '36px',
                fontSize: '0.85rem',
                paddingLeft: '12px',
                margin: 0
              }}
            >
              <option value="all">All Meals</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>

          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyComparisonData} margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
                {/* FIXED GRID: Using --text-muted with 0.25 opacity ensures visibility across themes */}
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--text-muted)" opacity={0.25} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }} 
                  dy={15} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} 
                  width={45}          
                  tickMargin={8}      
                  allowDecimals={false} 
                  domain={[0, 'auto']} 
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    padding: '12px 16px',
                    color: 'var(--text-main)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                  }} 
                  labelStyle={{ color: 'var(--text-main)', fontWeight: 800, marginBottom: '8px' }} 
                  itemStyle={{ fontWeight: 600, padding: '3px 0' }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center" 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '20px', fontWeight: 600, color: 'var(--text-main)' }} 
                />
                <Line 
                  name="Current Week" 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#e67e22"
                  strokeWidth={3} 
                  connectNulls={false}
                  dot={{ r: 5, fill: '#e67e22', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                  activeDot={{ r: 7, strokeWidth: 0 }} 
                />
                <Line 
                  name="Previous Week" 
                  type="monotone" 
                  dataKey="previous"
                  stroke="var(--text-muted)" 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  opacity={0.5} 
                  dot={{ r: 4 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {selectedDayDetail && (
        <div 
          onClick={() => setSelectedDayDetail(null)}
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)', padding: '25px', borderRadius: '16px',
              minWidth: '350px', position: 'relative', border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow)'
            }}
          >
            <button onClick={() => setSelectedDayDetail(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '5px', fontSize: '1.1rem', color: 'var(--text-main)' }}>
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