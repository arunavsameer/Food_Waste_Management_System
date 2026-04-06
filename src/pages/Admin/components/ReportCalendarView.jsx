import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, X, Coffee, Utensils, Moon, Loader2 } from 'lucide-react';

// Helper — avoids UTC timezone offset bug from toISOString()
const toLocalISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Colour logic: based on number of meal entries logged that day
// 0 entries → neutral, 1 → red, 2 → yellow, 3 → green
const getEntryStatus = (count) => {
  if (!count || count === 0) return 'neutral';
  if (count === 1) return 'bad';
  if (count === 2) return 'mid';
  return 'good'; // 3+
};

const ReportCalendarView = () => {
  const [currentDate, setCurrentDate]       = useState(new Date());
  const [caterersList, setCaterersList]     = useState([]);
  const [selectedCatererId, setSelectedCatererId] = useState('');
  const [wasteData, setWasteData]           = useState([]); // raw rows from waste_reports
  const [loading, setLoading]               = useState(false);
  const [selectedDay, setSelectedDay]       = useState(null); // for modal

  const year         = currentDate.getFullYear();
  const month        = currentDate.getMonth();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const startDay     = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7; // Monday = 0

  // ── Fetch caterers once ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('caterers')
        .select('caterer_id, name')
        .order('name');
      if (!error && data?.length) {
        setCaterersList(data);
        setSelectedCatererId(data[0].caterer_id);
      }
    };
    load();
  }, []);

  // ── Fetch waste_reports for selected month + caterer ──────────────────────
  useEffect(() => {
    if (!selectedCatererId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const start = toLocalISODate(new Date(year, month, 1));
      const end   = toLocalISODate(new Date(year, month + 1, 0));

      const { data, error } = await supabase
        .from('waste_reports')
        .select('report_date, meal_type, plate_waste, kitchen_uncooked, kitchen_cooked')
        .eq('caterer_id', selectedCatererId)
        .gte('report_date', start)
        .lte('report_date', end)
        .order('report_date', { ascending: true });

      if (!cancelled) {
        if (!error) setWasteData(data || []);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [currentDate, selectedCatererId]);

  // ── Build per-day summary ─────────────────────────────────────────────────
  const dayMap = useMemo(() => {
    const map = new Map(); // day → { totalWaste, mealCount, meals: [] }

    wasteData.forEach(row => {
      const day = parseInt(row.report_date.split('-')[2], 10);
      if (!map.has(day)) map.set(day, { totalWaste: 0, mealCount: 0, meals: [] });

      const d    = map.get(day);
      const waste = Number(row.plate_waste || 0)
                  + Number(row.kitchen_uncooked || 0)
                  + Number(row.kitchen_cooked || 0);

      d.totalWaste += waste;
      d.mealCount  += 1;
      d.meals.push({ ...row, total: waste });
    });

    // Compute avgWaste per meal for display
    map.forEach(d => {
      d.avgWaste = d.mealCount > 0
        ? Number((d.totalWaste / d.mealCount).toFixed(1))
        : 0;
    });

    return map;
  }, [wasteData]);

  // ── Month-level stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (wasteData.length === 0)
      return { totalReports: 0, totalWaste: '0.0', avgPerMeal: '0.0', fullDays: 0 };

    const total = wasteData.reduce(
      (s, r) => s + Number(r.plate_waste||0) + Number(r.kitchen_uncooked||0) + Number(r.kitchen_cooked||0), 0
    );

    let fullDays = 0;
    dayMap.forEach(d => { if (d.mealCount >= 3) fullDays++; });

    return {
      totalReports: wasteData.length,
      totalWaste:   total.toFixed(1),
      avgPerMeal:   (total / wasteData.length).toFixed(1),
      fullDays,
    };
  }, [wasteData, dayMap]);

  return (
    <div className="calendar-layout" style={{ position: 'relative' }}>

      {/* ── Day detail modal ─────────────────────────────────────────────── */}
      {selectedDay && (
        <div
          onClick={() => setSelectedDay(null)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
              padding: '25px', borderRadius: '16px', width: '90%', maxWidth: '380px',
              position: 'relative', color: 'var(--text-main)', boxShadow: 'var(--shadow)',
            }}
          >
            <button
              onClick={() => setSelectedDay(null)}
              style={{ position: 'absolute', top: 15, right: 15, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={22} />
            </button>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>
              {monthNames[month]} {selectedDay.day}, {year}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              {selectedDay.mealCount} of 3 meals reported &nbsp;·&nbsp;
              Total: <strong style={{ color: 'var(--text-main)' }}>{selectedDay.totalWaste.toFixed(1)} kg</strong>
            </p>

            {/* Entry count badge */}
            <div style={{ marginBottom: '18px' }}>
              {[1, 2, 3].map(n => (
                <span key={n} style={{
                  display: 'inline-block', marginRight: 6,
                  padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                  background: n <= selectedDay.mealCount
                    ? (selectedDay.mealCount === 1 ? '#e74c3c' : selectedDay.mealCount === 2 ? '#edbd00' : '#2ecc71')
                    : 'var(--border-color)',
                  color: n <= selectedDay.mealCount ? 'white' : 'var(--text-muted)',
                }}>
                  {n === 1 ? 'Breakfast' : n === 2 ? 'Lunch' : 'Dinner'}
                </span>
              ))}
            </div>

            {/* Per-meal breakdown */}
            {['breakfast', 'lunch', 'dinner'].map(type => {
              const meal = selectedDay.meals.find(m => m.meal_type?.toLowerCase().trim() === type);
              const icons = { breakfast: <Coffee size={15} color="#e67e22" />, lunch: <Utensils size={15} color="#e67e22" />, dinner: <Moon size={15} color="#e67e22" /> };
              return (
                <div key={type} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 0', borderBottom: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.87rem' }}>
                    {icons[type]}
                    <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-main)' }}>{type}</span>
                  </div>
                  {meal ? (
                    <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{meal.total.toFixed(1)} kg</strong>
                      <div>
                        Plate {Number(meal.plate_waste).toFixed(1)} · 
                        Uncooked {Number(meal.kitchen_uncooked).toFixed(1)} · 
                        Cooked {Number(meal.kitchen_cooked).toFixed(1)}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--border-color)', fontSize: '0.78rem' }}>Not reported</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Calendar section ─────────────────────────────────────────────── */}
      <div className="calendar-section">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div className="nav-header">
            <button className="nav-arrow-btn" onClick={() => { setLoading(true); setCurrentDate(new Date(year, month - 1, 1)); }}>
              <ChevronLeft size={20} />
            </button>
            <span className="month-label">
              {monthNames[month]} {year}
              {loading && <Loader2 size={13} style={{ marginLeft: 7, opacity: 0.5, animation: 'spin 1s linear infinite' }} />}
            </span>
            <button className="nav-arrow-btn" onClick={() => { setLoading(true); setCurrentDate(new Date(year, month + 1, 1)); }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Caterer picker */}
          <select
            value={selectedCatererId}
            onChange={e => setSelectedCatererId(e.target.value)}
            className="header-select"
          >
            {caterersList.length === 0 && <option value="">Loading...</option>}
            {caterersList.map(c => (
              <option key={c.caterer_id} value={c.caterer_id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="legend" style={{ marginBottom: 14 }}>
          <span className="dot red"   style={{ marginRight: 4 }}></span> 1 entry &nbsp;
          <span className="dot yellow" style={{ marginRight: 4 }}></span> 2 entries &nbsp;
          <span className="dot green"  style={{ marginRight: 4 }}></span> All 3 entries
        </div>

        {/* Grid */}
        <div className={`calendar-grid ${loading ? 'grid-loading' : ''}`}>
          {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="calendar-cell empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const data   = dayMap.get(dayNum);
            const status = getEntryStatus(data?.mealCount);

            return (
              <div
                key={dayNum}
                className={`calendar-cell ${status}`}
                onClick={() => data && setSelectedDay({ day: dayNum, ...data })}
                style={{ cursor: data ? 'pointer' : 'default' }}
                onMouseOver={e  => data && (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseOut={e   => data && (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div className="date-num">{dayNum}</div>
                {data ? (
                  <>
                    <div className="rating-score" style={{ fontSize: '1rem' }}>
                      {data.avgWaste}
                    </div>
                    <div className="dish-name" style={{ fontSize: '0.63rem' }}>kg/meal</div>
                  </>
                ) : (
                  <div className="dish-name" style={{ opacity: 0.2 }}>-</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="sidebar-widgets">

        {/* Summary stat card */}
        <div style={{
          background: 'linear-gradient(135deg, #e67e22, #d35400)',
          borderRadius: 16, padding: '22px 20px', color: 'white',
          boxShadow: '0 8px 24px rgba(230,126,34,0.35)',
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.85, marginBottom: 4 }}>Monthly Average Waste</div>
          <div style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1.1 }}>{stats.avgPerMeal}</div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8 }}>KG PER MEAL</div>
        </div>

        {/* Stats breakdown */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 16, padding: '20px', boxShadow: 'var(--shadow)',
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-main)' }}>
            Month Stats
          </h4>

          {[
            { label: 'Total Reports',     value: stats.totalReports },
            { label: 'Total Waste (kg)',   value: stats.totalWaste },
            { label: 'Avg per Meal (kg)',  value: stats.avgPerMeal },
            { label: 'Fully Reported Days', value: stats.fullDays },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: '1px solid var(--border-color)',
              fontSize: '0.88rem',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <strong style={{ color: 'var(--text-main)' }}>{value}</strong>
            </div>
          ))}
        </div>

        {/* Colour guide */}
        {/* <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 16, padding: '18px 20px', boxShadow: 'var(--shadow)',
        }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '1rem', color: 'var(--text-main)' }}>Colour Guide</h4>
          {[
            { color: '#2ecc71', label: 'All 3 meals reported' },
            { color: '#edbd00', label: '2 meals reported' },
            { color: '#e74c3c', label: '1 meal reported' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div> */}
      </div>

      <style>{`
        .grid-loading { opacity: 0.45; pointer-events: none; transition: opacity 0.3s; }
        .calendar-cell { transition: transform 0.1s ease; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ReportCalendarView;