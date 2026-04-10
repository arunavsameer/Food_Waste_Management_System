import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, X, MessageSquare, Smile, Meh, Frown, Loader2 } from 'lucide-react';

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

  // ✅ Monday-start: same formula as WasteHistoryView
  const startDay = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const prevMonth = () => { setLoading(true); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setLoading(true); setCurrentDate(new Date(year, month + 1, 1)); };

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const formatLocalDate = (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        };

        const startOfMonth = formatLocalDate(new Date(year, month, 1));
        const endOfMonth   = formatLocalDate(new Date(year, month + 1, 0));

        const [{ data: calData, error: calError }, { data: rawComments, error: commentError }] = await Promise.all([
          supabase
            .from('feedback_cal')
            .select('*')
            .eq('caterer_id', user.id)
            .eq('meal_type', mealType.toLowerCase())
            .gte('date', startOfMonth)
            .lte('date', endOfMonth),
          supabase
            .from('feedback')
            .select('*')
            .eq('caterer_id', user.id)
            .eq('meal_type', mealType.toLowerCase())
            .order('id', { ascending: false })
            .limit(5),
        ]);

        if (calError) throw calError;
        if (commentError) throw commentError;

        const formattedData = (calData || []).map(row => {
          const score = row.average;
          let status = 'bad';
          if (score >= 7) status = 'good';
          else if (score >= 5) status = 'mid';
          return {
            day:    parseInt(row.date.split('-')[2], 10),
            rating: score.toFixed(1),
            count:  row.feedback_count,
            status,
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
    if (num === 0)    return { Icon: MessageSquare, color: 'var(--text-muted)' };
    if (num >= 7.5)   return { Icon: Smile,         color: 'var(--primary-green)' };
    if (num >= 5)     return { Icon: Meh,            color: 'var(--warning)' };
    return              { Icon: Frown,           color: 'var(--danger)' };
  }, [averageRating]);

  return (
    <div className="calendar-layout" style={{ position: 'relative' }}>

      {/* ── Day Detail Modal — matches WasteHistoryView style ── */}
      {selectedDay && (
        <div
          onClick={() => setSelectedDay(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)', padding: '25px', borderRadius: '16px',
              minWidth: '340px', position: 'relative',
              border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)',
            }}
          >
            <button
              onClick={() => setSelectedDay(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginTop: 0, marginBottom: '5px', fontSize: '1.1rem', color: 'var(--text-main)' }}>
              {monthNames[month]} {selectedDay.day}, {year}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {mealType} · {selectedDay.count} review{selectedDay.count !== 1 ? 's' : ''}
            </p>

            {[
              { label: 'Meal Type',      value: mealType },
              { label: 'Average Score',  value: `${selectedDay.rating} / 10`, highlight: true, status: selectedDay.status },
              { label: 'Participation',  value: `${selectedDay.count} Reviews` },
            ].map(({ label, value, highlight, status }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{label}</span>
                <strong style={{
                  fontSize: highlight ? '1.15rem' : '0.95rem',
                  color: highlight
                    ? (status === 'good' ? 'var(--primary-green)' : status === 'mid' ? 'var(--warning)' : 'var(--danger)')
                    : 'var(--text-main)',
                }}>
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar Section — matches WasteHistoryView ── */}
      <div className="calendar-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>

          {/* Nav header — exact same as WasteHistoryView */}
          <div className="nav-header">
            <button onClick={prevMonth} className="nav-arrow-btn"><ChevronLeft size={18} /></button>
            <span className="month-label" style={{ fontSize: '0.95rem' }}>
              {monthNames[month]} {year}
              {loading && <Loader2 className="spinner" size={14} style={{ marginLeft: '8px', opacity: 0.6 }} />}
            </span>
            <button onClick={nextMonth} className="nav-arrow-btn"><ChevronRight size={18} /></button>
          </div>

          {/* Meal selector — matches WasteHistoryView weekly select style */}
          <select
            value={mealType}
            onChange={(e) => { setLoading(true); setMealType(e.target.value); }}
            className="caterer-header-select"
            style={{ width: '130px', height: '36px', fontSize: '0.85rem', paddingLeft: '12px', margin: 0 }}
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>

        {/* ✅ Monday-start headers */}
        <div className={`calendar-grid ${loading ? 'grid-loading' : ''}`}>
          {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
            <div key={d} className="grid-header" style={{ fontSize: '0.75rem' }}>{d}</div>
          ))}

          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="calendar-cell empty" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const data   = getDataForDay(dayNum);
            const statusClass = data ? data.status : 'neutral';

            return (
              <div
                key={dayNum}
                className={`calendar-cell ${statusClass} ${data ? 'has-data' : ''}`}
                onClick={() => data && setSelectedDay(data)}
                style={{ cursor: data ? 'pointer' : 'default' }}
              >
                <div className="date-num">{dayNum}</div>
                {data ? (
                  <>
                    <div className="rating-score" style={{ fontSize: '1rem' }}>{data.rating}</div>
                    <div className="dish-name" style={{ fontSize: '0.65rem' }}>{data.count} rev.</div>
                  </>
                ) : (
                  <div className="dish-name" style={{ opacity: 0.2 }}>-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sidebar — matches WasteHistoryView sidebar style ── */}
      <div className="sidebar-widgets">

        {/* Stats card — same style as Mess Stats in WasteHistoryView */}
        <div style={{
          background:    'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
          borderRadius:  '16px',
          marginBottom:  '15px',
          padding:       '0 20px',
          height:        '180px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          textAlign:     'center',
          gap:           '4px',
        }}>
          <moodConfig.Icon size={32} style={{ color: 'white', marginBottom: '4px' }} />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>Feedback Score</span>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>Monthly {mealType} Average</span>
          <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'white', lineHeight: 1.1, margin: '4px 0 2px 0' }}>
            {averageRating}
          </span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.75)' }}>
            OUT OF 10
          </span>
        </div>

        {/* Recent Comments card — matches WasteHistoryView chart card style */}
        <div style={{
          background:   'var(--bg-card)',
          border:       '1px solid var(--border-color)',
          padding:      '20px',
          borderRadius: '16px',
          boxShadow:    'var(--shadow)',
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 800 }}>
            Recent Comments
          </h4>

          {recentComments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              No comments for this meal yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {recentComments.map((c, i) => {
                const score = parseFloat(c.rating);
                const color = score >= 7 ? 'var(--primary-green)' : score >= 5 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <div key={i} style={{
                    padding: '12px 0',
                    borderBottom: i < recentComments.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {c.date || 'Recent'}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        color: 'white', background: color,
                        padding: '2px 8px', borderRadius: '6px',
                      }}>
                        {c.rating}/10
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>
                      {c.comment}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .calendar-grid { transition: opacity 0.3s ease; }
        .grid-loading { opacity: 0.5; pointer-events: none; }
        .widget-loading { filter: blur(2px); opacity: 0.7; pointer-events: none; }
        .calendar-cell.good { background-color: rgba(46,204,113,0.08); border-color: rgba(46,204,113,0.4); }
        .calendar-cell.mid  { background-color: rgba(230,126,34,0.08);  border-color: rgba(230,126,34,0.4); }
        .calendar-cell.bad  { background-color: rgba(231,76,60,0.08);   border-color: rgba(231,76,60,0.4); }
        [data-theme='dark'] .calendar-cell.good { background: rgba(46,204,113,0.2); }
        [data-theme='dark'] .calendar-cell.mid  { background: rgba(230,126,34,0.2); }
        [data-theme='dark'] .calendar-cell.bad  { background: rgba(231,76,60,0.2); }
      `}</style>
    </div>
  );
};

export default MessFeedbackView;