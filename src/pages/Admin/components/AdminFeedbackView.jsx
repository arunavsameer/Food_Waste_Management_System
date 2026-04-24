import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, MessageSquare, RefreshCw, ChevronLeft, ChevronRight,
  LayoutList, BarChart2, Star, Users, UtensilsCrossed, Trophy, AlertTriangle,
  TrendingUp, TrendingDown
} from 'lucide-react';

const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner'];
const TIME_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all', label: 'All Time' },
];
const RAW_PAGE_SIZE = 10;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const fmtLong = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
const fmtShort = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
const fmtDisplay = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

function getDateRange(preset) {
  const now = new Date();
  const tod = startOfDay(now);
  switch (preset) {
    case 'today': {
      const prevFrom = new Date(tod);
      prevFrom.setDate(prevFrom.getDate() - 1);
      return {
        from: tod,
        to: endOfDay(now),
        prevFrom,
        prevTo: new Date(tod.getTime() - 1),
        label: `Today — ${fmtLong(now)}`,
      };
    }
    case 'week': {
      const mon = new Date(tod);
      mon.setDate(tod.getDate() - tod.getDay() + (tod.getDay() === 0 ? -6 : 1));
      const prevFrom = new Date(mon);
      prevFrom.setDate(prevFrom.getDate() - 7);
      return {
        from: mon,
        to: endOfDay(now),
        prevFrom,
        prevTo: new Date(mon.getTime() - 1),
        label: `This week (${fmtShort(mon)} – ${fmtShort(now)})`,
      };
    }
    case 'month': {
      const fm = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from: fm,
        to: endOfDay(now),
        prevFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        prevTo: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        label: now.toLocaleDateString('en-IN', { month:'long', year:'numeric' }),
      };
    }
    case 'last_month': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: startOfDay(lm),
        to: endOfDay(lme),
        prevFrom: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        prevTo: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999),
        label: lm.toLocaleDateString('en-IN', { month:'long', year:'numeric' }),
      };
    }
    default:
      return { from: null, to: null, prevFrom: null, prevTo: null, label: 'All time' };
  }
}

function relativeDayLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6) return d.toLocaleDateString('en-IN', { weekday:'short' });
  return d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' });
}

const scoreTone = (avg) => avg >= 7.5 ? '#2ecc71' : avg >= 5 ? '#f39c12' : '#e74c3c';

const getTrend = (current, previous) => {
  if (previous === null || previous === undefined || Number.isNaN(previous)) return null;
  if (Math.abs(previous) < 0.0001) {
    if (Math.abs(current) < 0.0001) return 0;
    return current > 0 ? 100 : -100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

const ScorePill = ({ avg }) => {
  const color = scoreTone(avg);
  const bg = avg >= 7.5 ? 'rgba(46,204,113,0.12)' : avg >= 5 ? 'rgba(243,156,18,0.12)' : 'rgba(231,76,60,0.12)';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      minWidth:'58px', padding:'4px 10px', borderRadius:'999px',
      background:bg, color, fontSize:'0.8rem', fontWeight:800,
      border:`1px solid ${color}33`,
    }}>
      {avg.toFixed(2)}
    </span>
  );
};

const TrendBadge = ({ pct, inverse = false }) => {
  if (pct === null || Number.isNaN(pct)) return null;

  if (Math.abs(pct) < 0.5) {
    return (
      <span className="feedback-trend-badge" style={{ color:'#d7e1ec', background:'rgba(20,28,38,0.42)' }}>
        — same
      </span>
    );
  }

  const good = inverse ? pct < 0 : pct > 0;
  const color = good ? '#2ecc71' : '#e74c3c';
  const Icon = pct > 0 ? TrendingUp : TrendingDown;

  return (
    <span className="feedback-trend-badge" style={{ color, background: good ? 'rgba(11, 61, 38, 0.44)' : 'rgba(88, 24, 24, 0.42)' }}>
      <Icon size={11} strokeWidth={3} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
};

const AdminFeedbackView = () => {
  const [allRows, setAllRows] = useState([]);
  const [caterers, setCaterers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsModal, setCommentsModal] = useState({
    open: false,
    loading: false,
    row: null,
    comments: [],
  });

  const [timePreset, setTimePreset] = useState('month');
  const [filterMess, setFilterMess] = useState('all');
  const [filterMeal, setFilterMeal] = useState('all');
  const [showRaw, setShowRaw] = useState(false);
  const [rawPage, setRawPage] = useState(1);

  const dateRange = useMemo(() => getDateRange(timePreset), [timePreset]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: rows }, { data: cats }] = await Promise.all([
        supabase.from('feedback_cal')
          .select('date,meal_type,feedback_count,average,caterer_id,caterers(name)')
          .order('date', { ascending: false }),
        supabase.from('caterers').select('caterer_id,name').order('name'),
      ]);
      setAllRows(rows || []);
      setCaterers(cats || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCommentsModal = async (row) => {
    setCommentsModal({
      open: true,
      loading: true,
      row,
      comments: [],
    });

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, rating, comment, date')
        .eq('caterer_id', row.caterer_id)
        .eq('meal_type', row.meal_type)
        .eq('date', row.date)
        .not('comment', 'is', null)
        .order('id', { ascending: false });

      if (error) throw error;

      const cleanedComments = (data || []).filter((item) => item.comment?.trim());

      setCommentsModal({
        open: true,
        loading: false,
        row,
        comments: cleanedComments,
      });
    } catch (error) {
      console.error(error);
      setCommentsModal({
        open: true,
        loading: false,
        row,
        comments: [],
      });
    }
  };

  const closeCommentsModal = () => {
    setCommentsModal({
      open: false,
      loading: false,
      row: null,
      comments: [],
    });
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => allRows.filter(r => {
    const d = new Date(r.date);
    const inRange = !dateRange.from || (d >= dateRange.from && d <= (dateRange.to || new Date()));
    const messOk = filterMess === 'all' || r.caterers?.name === filterMess;
    const mealOk = filterMeal === 'all' || r.meal_type === filterMeal;
    return inRange && messOk && mealOk;
  }), [allRows, dateRange, filterMess, filterMeal]);

  const previousFiltered = useMemo(() => {
    if (!dateRange.prevFrom || !dateRange.prevTo) return [];
    return allRows.filter(r => {
      const d = new Date(r.date);
      const inRange = d >= dateRange.prevFrom && d <= dateRange.prevTo;
      const messOk = filterMess === 'all' || r.caterers?.name === filterMess;
      const mealOk = filterMeal === 'all' || r.meal_type === filterMeal;
      return inRange && messOk && mealOk;
    });
  }, [allRows, dateRange, filterMess, filterMeal]);

  const stats = useMemo(() => {
    const totalResponses = filtered.reduce((s, r) => s + (r.feedback_count || 0), 0);
    const weightedSum = filtered.reduce((s, r) => s + (Number(r.average) || 0) * (r.feedback_count || 0), 0);
    const overallAvg = totalResponses > 0 ? weightedSum / totalResponses : 0;
    return { totalMeals: filtered.length, totalResponses, overallAvg };
  }, [filtered]);

  const previousStats = useMemo(() => {
    const totalResponses = previousFiltered.reduce((s, r) => s + (r.feedback_count || 0), 0);
    const weightedSum = previousFiltered.reduce((s, r) => s + (Number(r.average) || 0) * (r.feedback_count || 0), 0);
    const overallAvg = totalResponses > 0 ? weightedSum / totalResponses : 0;
    return { totalMeals: previousFiltered.length, totalResponses, overallAvg };
  }, [previousFiltered]);

  const messSummary = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const name = r.caterers?.name || 'Unknown';
      if (!map[name]) map[name] = { name, Meals:0, responses:0, weighted:0 };
      map[name].Meals += 1;
      map[name].responses += r.feedback_count || 0;
      map[name].weighted += (Number(r.average) || 0) * (r.feedback_count || 0);
    });
    return Object.values(map)
      .map(m => ({ ...m, avg: m.responses > 0 ? m.weighted / m.responses : 0 }))
      .sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const mealSummary = useMemo(() => ['breakfast', 'lunch', 'dinner'].map(label => {
    const rows = filtered.filter(r => r.meal_type === label);
    const responses = rows.reduce((s, r) => s + (r.feedback_count || 0), 0);
    const weighted = rows.reduce((s, r) => s + (Number(r.average) || 0) * (r.feedback_count || 0), 0);
    return {
      label,
      Meals: rows.length,
      responses,
      avg: responses > 0 ? weighted / responses : 0,
    };
  }), [filtered]);

  const rawSorted = useMemo(() => [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)), [filtered]);
  const totalRawPages = Math.max(1, Math.ceil(rawSorted.length / RAW_PAGE_SIZE));
  const rawPageSafe = Math.min(rawPage, totalRawPages);
  const rawSlice = rawSorted.slice((rawPageSafe - 1) * RAW_PAGE_SIZE, rawPageSafe * RAW_PAGE_SIZE);

  const bestMess = messSummary[0] || null;
  const worstMess = messSummary.length > 1 ? messSummary[messSummary.length - 1] : null;
  const strongestMeal = [...mealSummary]
    .filter((meal) => meal.responses > 0)
    .sort((a, b) => b.avg - a.avg)[0] || null;
  const weakestMeal = [...mealSummary]
    .filter((meal) => meal.responses > 0)
    .sort((a, b) => a.avg - b.avg)[0] || null;
  const previousMealSummary = useMemo(() => ['breakfast', 'lunch', 'dinner'].map(label => {
    const rows = previousFiltered.filter(r => r.meal_type === label);
    const responses = rows.reduce((s, r) => s + (r.feedback_count || 0), 0);
    const weighted = rows.reduce((s, r) => s + (Number(r.average) || 0) * (r.feedback_count || 0), 0);
    return {
      label,
      Meals: rows.length,
      responses,
      avg: responses > 0 ? weighted / responses : 0,
    };
  }), [previousFiltered]);
  const filtersActive = filterMess !== 'all' || filterMeal !== 'all' || timePreset !== 'month';
  const strongestMealPrevious = strongestMeal
    ? previousMealSummary.find((meal) => meal.label === strongestMeal.label) || null
    : null;
  const scoreTrend = dateRange.prevFrom ? getTrend(stats.overallAvg, previousStats.overallAvg) : null;
  const responsesTrend = dateRange.prevFrom ? getTrend(stats.totalResponses, previousStats.totalResponses) : null;
  const mealTrend = strongestMeal && strongestMealPrevious && strongestMealPrevious.responses > 0
    ? getTrend(strongestMeal.avg, strongestMealPrevious.avg)
    : null;

  if (loading) {
    return (
      <div className="admin-loading" style={{ height:'40vh' }}>
        <Loader2 size={24} className="spin"/> Loading feedback data…
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
      {commentsModal.open && (
        <div className="modal-backdrop" onClick={closeCommentsModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth:'640px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px' }}>
              <div>
                <h3 className="modal-title" style={{ margin:'0 0 8px 0' }}>
                  <MessageSquare size={18} />
                  Feedback Comments
                </h3>
                {commentsModal.row && (
                  <p style={{ margin:0, fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.5 }}>
                    {(commentsModal.row.caterers?.name || '—')} · {fmtDisplay(commentsModal.row.date)} · {commentsModal.row.meal_type}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeCommentsModal}
                className="btn-ghost"
                style={{ padding:'6px 10px' }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop:'18px' }}>
              {commentsModal.loading ? (
                <div className="admin-loading" style={{ padding:'24px 0' }}>
                  <Loader2 size={18} className="spin" /> Loading comments…
                </div>
              ) : commentsModal.comments.length === 0 ? (
                <div className="admin-empty" style={{ padding:'24px 0' }}>
                  <MessageSquare size={36} className="admin-empty-icon" />
                  <p style={{ margin:0, fontWeight:600 }}>No written comments</p>
                  <p style={{ margin:0, fontSize:'0.82rem' }}>Ratings exist for this meal, but students did not leave text feedback.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxHeight:'420px', overflowY:'auto', paddingRight:'4px' }}>
                  {commentsModal.comments.map((item) => {
                    const ratingColor = item.rating >= 7 ? 'var(--primary-green)' : item.rating >= 5 ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <div
                        key={item.id}
                        style={{
                          padding:'14px 16px',
                          borderRadius:'14px',
                          border:'1px solid var(--border-color)',
                          background:'var(--bg-hover)',
                        }}
                      >
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                          <span style={{ fontSize:'0.74rem', color:'var(--text-muted)', fontWeight:700 }}>
                            {fmtDisplay(item.date)}
                          </span>
                          <span style={{
                            display:'inline-flex',
                            alignItems:'center',
                            padding:'3px 9px',
                            borderRadius:'999px',
                            fontSize:'0.72rem',
                            fontWeight:800,
                            color:ratingColor,
                            background:`${ratingColor}18`,
                          }}>
                            {item.rating}/10
                          </span>
                        </div>
                        <p style={{ margin:0, fontSize:'0.9rem', lineHeight:1.5, color:'var(--text-main)' }}>
                          {item.comment}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10, padding:3, border:'1px solid var(--border-color)' }}>
          {TIME_PRESETS.map(p => (
            <button key={p.key} onClick={() => { setTimePreset(p.key); setRawPage(1); }} style={{
              padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
              fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s', whiteSpace:'nowrap',
              background: timePreset === p.key ? 'var(--bg-card)' : 'transparent',
              color: timePreset === p.key ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: timePreset === p.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{p.label}</button>
          ))}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <select value={filterMess} onChange={e => { setFilterMess(e.target.value); setRawPage(1); }}
            className="admin-filter-select"
            style={{
              fontSize:'0.78rem', fontWeight:600, padding:'6px 32px 6px 10px',
              border:`1px solid ${filterMess !== 'all' ? 'var(--primary-green)' : 'var(--border-color)'}`,
              background: filterMess !== 'all' ? 'rgba(46,204,113,0.07)' : 'var(--bg-input)',
            }}>
            <option value="all">All Messes</option>
            {caterers.map(c => <option key={c.caterer_id} value={c.name}>{c.name}</option>)}
          </select>

          <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10, padding:3, border:'1px solid var(--border-color)' }}>
            {MEAL_TYPES.map(m => (
              <button key={m} onClick={() => { setFilterMeal(m); setRawPage(1); }} style={{
                padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700, textTransform:'capitalize', transition:'all 0.15s', whiteSpace:'nowrap',
                background: filterMeal === m ? 'var(--bg-card)' : 'transparent',
                color: filterMeal === m ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: filterMeal === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{m === 'all' ? 'All Meals' : m}</button>
            ))}
          </div>

          <button className="icon-btn" onClick={fetchAll} title="Refresh">
            <RefreshCw size={14}/>
          </button>

          {filtersActive && (
            <button onClick={() => { setFilterMess('all'); setFilterMeal('all'); setTimePreset('month'); setRawPage(1); }} style={{
              padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)',
              background:'transparent', color:'var(--danger)', fontSize:'0.75rem',
              fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            }}>✕ Reset</button>
          )}
        </div>
      </div>

      <div style={{
        display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap',
        padding:'10px 16px', borderRadius:'10px',
        background:'var(--bg-hover)', border:'1px solid var(--border-color)',
        fontSize:'0.82rem',
      }}>
        <span style={{ fontWeight:700, color:'var(--text-main)' }}>
          {dateRange.label}
        </span>
        {filterMess !== 'all' && <span style={{ color:'var(--primary-green)', fontWeight:600 }}>· {filterMess}</span>}
        {filterMeal !== 'all' && <span style={{ color:'var(--primary-blue)', fontWeight:600, textTransform:'capitalize' }}>· {filterMeal}</span>}
        <span style={{
          marginLeft:'auto', color:'var(--text-muted)', fontWeight:600,
          borderLeft:'1px solid var(--border-color)', paddingLeft:'16px',
        }}>
          <strong style={{ color:'var(--text-main)' }}>{stats.totalMeals}</strong> entr{stats.totalMeals !== 1 ? 'ies' : 'y'}
          {' '}· avg <strong style={{ color: scoreTone(stats.overallAvg) }}>{stats.totalResponses > 0 ? `${stats.overallAvg.toFixed(2)} / 10` : '—'}</strong>
          {' '}· responses <strong style={{ color:'var(--text-main)' }}>{stats.totalResponses.toLocaleString()}</strong>
        </span>
      </div>

      <div className="feedback-hero-grid">
        <div className="feedback-hero-card feedback-hero-card-score admin-hover-lift">
          <div className="feedback-hero-badge-wrap">
            <TrendBadge pct={scoreTrend} />
          </div>
          <div className="feedback-hero-icon"><Star size={18} /></div>
          <div className="feedback-hero-label">Overall Feedback Score</div>
          <div className="feedback-hero-value">
            {stats.totalResponses > 0 ? stats.overallAvg.toFixed(2) : '—'}
            {stats.totalResponses > 0 && <span>/10</span>}
          </div>
          <div className="feedback-hero-meta">
            {bestMess ? `Top mess: ${bestMess.name}` : 'Waiting for feedback data'}
          </div>
        </div>

        <div className="feedback-hero-card feedback-hero-card-responses admin-hover-lift">
          <div className="feedback-hero-badge-wrap">
            <TrendBadge pct={responsesTrend} />
          </div>
          <div className="feedback-hero-icon"><Users size={18} /></div>
          <div className="feedback-hero-label">Response Coverage</div>
          <div className="feedback-hero-value">{stats.totalResponses.toLocaleString()}</div>
          <div className="feedback-hero-meta">
            {stats.totalMeals} meal{stats.totalMeals !== 1 ? 's' : ''} tracked in this range
          </div>
        </div>

        <div className="feedback-hero-card feedback-hero-card-meal admin-hover-lift">
          <div className="feedback-hero-badge-wrap">
            <TrendBadge pct={mealTrend} />
          </div>
          <div className="feedback-hero-icon"><UtensilsCrossed size={18} /></div>
          <div className="feedback-hero-label">Meal Trend Snapshot</div>
          <div className="feedback-hero-value" style={{ fontSize:'1.7rem' }}>
            {strongestMeal ? strongestMeal.label : 'No data'}
          </div>
          <div className="feedback-hero-meta">
            {strongestMeal
              ? `${strongestMeal.avg.toFixed(2)} / 10${weakestMeal && weakestMeal.label !== strongestMeal.label ? ` · lowest ${weakestMeal.label} at ${weakestMeal.avg.toFixed(2)}` : ''}`
              : 'No meal-level summary available'}
          </div>
        </div>
      </div>

      <div className="admin-table-wrapper feedback-benchmark-card admin-hover-lift">
        <div className="admin-table-header feedback-benchmark-header">
          <div>
            <h3 style={{ margin:0 }}>Mess Performance Snapshot</h3>
            <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
              One merged section for ranking and highlights so the page stays lighter · {dateRange.label}
              {filterMess !== 'all' && ` · ${filterMess}`}
              {filterMeal !== 'all' && ` · ${filterMeal} only`}
            </p>
          </div>
          <div className="feedback-benchmark-highlights">
            <div className="feedback-benchmark-chip feedback-benchmark-chip-best">
              <Trophy size={16} />
              <div>
                <strong>{bestMess ? bestMess.name : 'No data'}</strong>
                <span>{bestMess ? `${bestMess.avg.toFixed(2)} / 10` : 'Highest rated mess'}</span>
              </div>
            </div>
            <div className="feedback-benchmark-chip feedback-benchmark-chip-worst">
              <AlertTriangle size={16} />
              <div>
                <strong>{worstMess ? worstMess.name : '—'}</strong>
                <span>{worstMess ? `${worstMess.avg.toFixed(2)} / 10` : 'Need at least two messes'}</span>
              </div>
            </div>
          </div>
        </div>

        {messSummary.length === 0 ? (
          <div className="admin-empty">
            <BarChart2 size={48} className="admin-empty-icon"/>
            <p style={{ margin:0, fontWeight:600 }}>No feedback for this period</p>
            <p style={{ margin:0, fontSize:'0.83rem' }}>Try adjusting the time range or filters</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mess</th>
                  <th>Meals</th>
                  <th>Responses</th>
                  <th>Avg Score</th>
                  <th>vs Overall</th>
                </tr>
              </thead>
              <tbody>
                {messSummary.map((m, i) => {
                  const diff = m.avg - stats.overallAvg;
                  return (
                    <tr key={m.name}>
                      <td className="muted">{i + 1}</td>
                      <td style={{ fontWeight:700 }}>{m.name}</td>
                      <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.Meals}</td>
                      <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.responses.toLocaleString()}</td>
                      <td><ScorePill avg={m.avg}/></td>
                      <td style={{ fontWeight:700, color: diff > 0 ? '#2ecc71' : diff < 0 ? '#e74c3c' : 'var(--text-muted)' }}>
                        {stats.totalResponses === 0 ? '—' : diff === 0 ? 'same' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:'2px solid var(--border-color)', background:'var(--bg-hover)' }}>
                  <td colSpan={4} style={{ padding:'10px 20px', fontWeight:800, fontSize:'0.82rem', color:'var(--text-muted)' }}>
                    Overall ({stats.totalMeals} Meals)
                  </td>
                  <td style={{ padding:'10px 20px' }}>
                    {stats.totalResponses > 0 ? <ScorePill avg={stats.overallAvg}/> : '—'}
                  </td>
                  <td style={{ padding:'10px 20px', fontSize:'0.75rem', color:'var(--text-muted)' }}>baseline</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="chart-card admin-hover-lift">
        <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Feedback by Meal Type</h3>
        <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
          Compact meal-wise breakdown so the section stays readable
        </p>
        <div style={{ overflowX:'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Meals</th>
                <th>Responses</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {mealSummary.map(m => (
                <tr key={m.label}>
                  <td style={{ fontWeight:700, textTransform:'capitalize' }}>{m.label}</td>
                  <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.Meals}</td>
                  <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.responses.toLocaleString()}</td>
                  <td>{m.responses > 0 ? <ScorePill avg={m.avg}/> : <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <button
          onClick={() => { setShowRaw(v => !v); setRawPage(1); }}
          style={{
            display:'flex', alignItems:'center', gap:'8px',
            padding:'9px 16px', borderRadius:'10px', cursor:'pointer',
            border:'1px solid var(--border-color)',
            background: showRaw ? 'var(--bg-hover)' : 'transparent',
            color:'var(--text-main)', fontSize:'0.82rem', fontWeight:700,
            transition:'all 0.15s',
          }}>
          <LayoutList size={15}/>
          {showRaw ? 'Hide' : 'View'} Individual Feedback
          <span style={{ marginLeft:'4px', padding:'2px 8px', borderRadius:'12px',
                         background:'var(--bg-hover)', fontSize:'0.72rem',
                         color:'var(--text-muted)', fontWeight:600 }}>
            {filtered.length}
          </span>
        </button>

        {showRaw && (
          <div className="admin-table-wrapper" style={{ marginTop:'12px' }}>
            <div className="admin-table-header">
              <div>
                <h3 style={{ margin:0 }}>Individual Feedback</h3>
                <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
                  {filtered.length} Meals · page {rawPageSafe} of {totalRawPages} · sorted by date desc
                </p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <button
                  disabled={rawPageSafe <= 1}
                  onClick={() => setRawPage(p => Math.max(1, p - 1))}
                  className="icon-btn"
                  style={{ opacity: rawPageSafe <= 1 ? 0.35 : 1 }}>
                  <ChevronLeft size={14}/>
                </button>
                {Array.from({ length: totalRawPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - rawPageSafe) <= 2)
                  .map(p => (
                    <button key={p} onClick={() => setRawPage(p)} style={{
                      width:28, height:28, borderRadius:7, border:'1px solid var(--border-color)',
                      background: p === rawPageSafe ? 'var(--primary-green)' : 'transparent',
                      color: p === rawPageSafe ? '#fff' : 'var(--text-muted)',
                      fontWeight:700, fontSize:'0.75rem', cursor:'pointer',
                    }}>{p}</button>
                  ))
                }
                <button
                  disabled={rawPageSafe >= totalRawPages}
                  onClick={() => setRawPage(p => Math.min(totalRawPages, p + 1))}
                  className="icon-btn"
                  style={{ opacity: rawPageSafe >= totalRawPages ? 0.35 : 1 }}>
                  <ChevronRight size={14}/>
                </button>
              </div>
            </div>

            {rawSlice.length === 0 ? (
              <div className="admin-empty">
                <MessageSquare size={48} className="admin-empty-icon"/>
                <p style={{ margin:0, fontWeight:600 }}>No feedback found</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Mess</th>
                      <th>Meal</th>
                      <th>Avg Score</th>
                      <th>Responses</th>
                      <th>Status</th>
                      <th>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawSlice.map((r, i) => {
                      const avg = Number(r.average) || 0;
                      const dayLabel = relativeDayLabel(r.date);
                      const rowNum = (rawPageSafe - 1) * RAW_PAGE_SIZE + i + 1;
                      const status = avg >= 7.5 ? 'Positive' : avg >= 5 ? 'Mixed' : 'Needs Attention';
                      const statusColor = avg >= 7.5 ? '#2ecc71' : avg >= 5 ? '#f39c12' : '#e74c3c';
                      return (
                        <tr key={`${r.date}-${r.meal_type}-${r.caterer_id}`}>
                          <td className="muted">{rowNum}</td>
                          <td>
                            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                              <span style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text-main)' }}>{dayLabel}</span>
                              <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{fmtDisplay(r.date)}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight:600 }}>{r.caterers?.name || '—'}</td>
                          <td><span className={`meal-pill ${r.meal_type}`}>{r.meal_type}</span></td>
                          <td><ScorePill avg={avg}/></td>
                          <td>
                            <span style={{
                              background:'var(--bg-hover)', padding:'3px 10px',
                              borderRadius:'20px', fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)',
                            }}>
                              {(r.feedback_count || 0).toLocaleString()} response{r.feedback_count !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display:'inline-flex', alignItems:'center', gap:'4px',
                              padding:'3px 8px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:700,
                              background:`${statusColor}1A`, color:statusColor,
                            }}>
                              {status}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => openCommentsModal(r)}
                              className="btn-ghost"
                              style={{ padding:'6px 10px', fontSize:'0.75rem', fontWeight:700 }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalRawPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'6px', padding:'14px', borderTop:'1px solid var(--border-color)' }}>
                <button
                  disabled={rawPageSafe <= 1}
                  onClick={() => setRawPage(p => Math.max(1, p - 1))}
                  className="icon-btn"
                  style={{ opacity: rawPageSafe <= 1 ? 0.35 : 1 }}>
                  <ChevronLeft size={14}/>
                </button>
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:600 }}>
                  {rawPageSafe} / {totalRawPages} ({filtered.length} Meals)
                </span>
                <button
                  disabled={rawPageSafe >= totalRawPages}
                  onClick={() => setRawPage(p => Math.min(totalRawPages, p + 1))}
                  className="icon-btn"
                  style={{ opacity: rawPageSafe >= totalRawPages ? 0.35 : 1 }}>
                  <ChevronRight size={14}/>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeedbackView;
