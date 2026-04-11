import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, MessageSquare, RefreshCw,
  TrendingUp, TrendingDown, ThumbsUp, ThumbsDown
} from 'lucide-react';

/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner'];

const TIME_PRESETS = [
  { key: 'today',      label: 'Today'      },
  { key: 'week',       label: 'This Week'  },
  { key: 'month',      label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all',        label: 'All Time'   },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const fmtLong    = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
const fmtShort   = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
const fmtDisplay = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

function getDateRange(preset) {
  const now = new Date();
  const tod = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: tod, to: endOfDay(now), label: `Today — ${fmtLong(now)}` };
    case 'week': {
      const mon = new Date(tod);
      mon.setDate(tod.getDate() - tod.getDay() + (tod.getDay() === 0 ? -6 : 1));
      return { from: mon, to: endOfDay(now), label: `This week (${fmtShort(mon)} – ${fmtShort(now)})` };
    }
    case 'month': {
      const fm = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fm, to: endOfDay(now), label: now.toLocaleDateString('en-IN', { month:'long', year:'numeric' }) };
    }
    case 'last_month': {
      const lm  = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(lm), to: endOfDay(lme), label: lm.toLocaleDateString('en-IN', { month:'long', year:'numeric' }) };
    }
    default:
      return { from: null, to: null, label: 'All time' };
  }
}

/* Score pill — colour-coded number, out of 10 */
const ScorePill = ({ avg }) => {
  const color = avg >= 7.5 ? '#2ecc71' : avg >= 5 ? '#f39c12' : '#e74c3c';
  const bg    = avg >= 7.5 ? 'rgba(46,204,113,0.12)' : avg >= 5 ? 'rgba(243,156,18,0.12)' : 'rgba(231,76,60,0.12)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '20px',
      background: bg,
      color: color,
      fontWeight: 800,
      fontSize: '0.88rem',
      border: `1px solid ${color}33`,
      minWidth: '52px',
      textAlign: 'center',
    }}>
      {Number(avg).toFixed(2)}
    </span>
  );
};

/* Score bar 0–10 */
const ScoreBar = ({ avg }) => {
  const pct   = Math.min(100, (avg / 10) * 100);
  const color = avg >= 7.5 ? '#2ecc71' : avg >= 5 ? '#f39c12' : '#e74c3c';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
      <div style={{ flex:1, height:'7px', background:'var(--border-color)', borderRadius:'4px', overflow:'hidden', minWidth:'70px' }}>
        <div style={{ width:`${pct}%`, height:'7px', background:color, borderRadius:'4px', transition:'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize:'0.75rem', fontWeight:700, color, width:'34px', textAlign:'right' }}>{avg.toFixed(2)}</span>
    </div>
  );
};

/* Relative day label */
function relativeDayLabel(dateStr) {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' });
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const AdminFeedbackView = () => {
  const [allRows,  setAllRows]  = useState([]);
  const [caterers, setCaterers] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [timePreset, setTimePreset] = useState('month');
  const [filterMess, setFilterMess] = useState('all');
  const [filterMeal, setFilterMeal] = useState('all');
  const [search,     setSearch]     = useState('');

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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── Apply filters ── */
  const filtered = useMemo(() => {
    return allRows.filter(r => {
      const d = new Date(r.date);
      const inRange = !dateRange.from || (d >= dateRange.from && d <= (dateRange.to || new Date()));
      return inRange
        && (filterMess === 'all' || r.caterers?.name === filterMess)
        && (filterMeal === 'all' || r.meal_type === filterMeal)
        && (!search || (r.caterers?.name||'').toLowerCase().includes(search.toLowerCase()));
    });
  }, [allRows, dateRange, filterMess, filterMeal, search]);

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const totalResponses = filtered.reduce((s,r) => s + (r.feedback_count||0), 0);
    const weightedSum    = filtered.reduce((s,r) => s + (Number(r.average)||0) * (r.feedback_count||0), 0);
    const overallAvg     = totalResponses > 0 ? weightedSum / totalResponses : null;
    return { totalEntries: filtered.length, totalResponses, overallAvg };
  }, [filtered]);

  /* ── Per-mess aggregation ── */
  const messSummary = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const n = r.caterers?.name || 'Unknown';
      if (!map[n]) map[n] = { name:n, sumWeighted:0, totalResp:0, entries:0 };
      map[n].sumWeighted += (Number(r.average)||0) * (r.feedback_count||0);
      map[n].totalResp   += r.feedback_count||0;
      map[n].entries++;
    });
    return Object.values(map)
      .map(m => ({ ...m, avg: m.totalResp > 0 ? m.sumWeighted / m.totalResp : 0 }))
      .sort((a,b) => b.avg - a.avg);
  }, [filtered]);

  /* ── Per-meal aggregation ── */
  const mealSummary = useMemo(() => {
    const types = filterMeal === 'all' ? ['breakfast','lunch','dinner'] : [filterMeal];
    return types.map(mt => {
      const rows = filtered.filter(r => r.meal_type === mt);
      const totalResp    = rows.reduce((s,r) => s + (r.feedback_count||0), 0);
      const weightedSum  = rows.reduce((s,r) => s + (Number(r.average)||0) * (r.feedback_count||0), 0);
      const avg          = totalResp > 0 ? weightedSum / totalResp : null;
      return { label: mt, entries: rows.length, totalResp, avg };
    });
  }, [filtered, filterMeal]);

  /* ── Best/worst mess ── */
  const bestMess  = messSummary.length > 0 ? messSummary[0] : null;
  const worstMess = messSummary.length > 1 ? messSummary[messSummary.length-1] : null;

  const filtersActive = filterMess !== 'all' || filterMeal !== 'all' || timePreset !== 'month';

  if (loading) return (
    <div className="admin-loading" style={{ height:'40vh' }}>
      <Loader2 size={24} className="spin"/> Loading feedback data…
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* ══ FILTER BAR ══ */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>

        {/* Left — date context */}
        <p style={{ margin:0, fontSize:'0.875rem', fontWeight:700, color:'var(--text-main)' }}>
          {dateRange.label}
          {filterMess !== 'all' && <span style={{ color:'var(--text-muted)', fontWeight:600 }}> · {filterMess}</span>}
          {filterMeal !== 'all' && <span style={{ color:'var(--text-muted)', fontWeight:600, textTransform:'capitalize' }}> · {filterMeal}</span>}
        </p>

        {/* Right — all controls */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10, padding:3, border:'1px solid var(--border-color)' }}>
            {TIME_PRESETS.map(p => (
              <button key={p.key} onClick={() => setTimePreset(p.key)} style={{
                padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s', whiteSpace:'nowrap',
                background: timePreset === p.key ? 'var(--bg-card)' : 'transparent',
                color:       timePreset === p.key ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow:   timePreset === p.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{p.label}</button>
            ))}
          </div>

          <select value={filterMess} onChange={e => setFilterMess(e.target.value)}
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
              <button key={m} onClick={() => setFilterMeal(m)} style={{
                padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700, textTransform:'capitalize', transition:'all 0.15s', whiteSpace:'nowrap',
                background: filterMeal === m ? 'var(--bg-card)' : 'transparent',
                color:       filterMeal === m ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow:   filterMeal === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{m === 'all' ? 'All Meals' : m}</button>
            ))}
          </div>

          <button className="icon-btn" onClick={fetchAll} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin' : ''}/>
          </button>
          {filtersActive && (
            <button onClick={() => { setFilterMess('all'); setFilterMeal('all'); setTimePreset('month'); setSearch(''); }} style={{
              padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)',
              background:'transparent', color:'var(--danger)', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            }}>✕ Reset</button>
          )}
        </div>
      </div>

      {/* ══ STAT CARDS ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(185px,1fr))', gap:'14px' }}>
        <div className="stat-card">
          <div className="stat-icon blue"><MessageSquare size={20}/></div>
          <div className="stat-label">Feedback Entries</div>
          <div className="stat-value">{stats.totalEntries}</div>
          <div className="stat-sub">{dateRange.label}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><MessageSquare size={20}/></div>
          <div className="stat-label">Student Responses</div>
          <div className="stat-value">{stats.totalResponses.toLocaleString()}</div>
          <div className="stat-sub">Total votes submitted</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'rgba(46,204,113,0.12)', color:'var(--primary-green)' }}>
            <TrendingUp size={20}/>
          </div>
          <div className="stat-label">Overall Avg Score</div>
          <div className="stat-value" style={{ color: stats.overallAvg == null ? 'var(--text-muted)' : stats.overallAvg >= 7.5 ? '#2ecc71' : stats.overallAvg >= 5 ? '#f39c12' : '#e74c3c' }}>
            {stats.overallAvg != null ? stats.overallAvg.toFixed(2) : '—'}
            <span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> /10</span>
          </div>
          <div className="stat-sub">Weighted by responses</div>
        </div>
        {bestMess && (
          <div className="stat-card" style={{ border:'1px solid rgba(46,204,113,0.25)', background:'rgba(46,204,113,0.04)' }}>
            <div className="stat-icon green"><ThumbsUp size={20}/></div>
            <div className="stat-label">Highest Rated Mess</div>
            <div style={{ fontSize:'0.95rem', fontWeight:800, color:'var(--text-main)', lineHeight:1.3 }}>{bestMess.name}</div>
            <div className="stat-sub" style={{ color:'#2ecc71', fontWeight:700 }}>{bestMess.avg.toFixed(2)} / 10</div>
          </div>
        )}
        {worstMess && (
          <div className="stat-card" style={{ border:'1px solid rgba(231,76,60,0.2)', background:'rgba(231,76,60,0.03)' }}>
            <div className="stat-icon red"><ThumbsDown size={20}/></div>
            <div className="stat-label">Lowest Rated Mess</div>
            <div style={{ fontSize:'0.95rem', fontWeight:800, color:'var(--text-main)', lineHeight:1.3 }}>{worstMess.name}</div>
            <div className="stat-sub" style={{ color:'#e74c3c', fontWeight:700 }}>{worstMess.avg.toFixed(2)} / 10</div>
          </div>
        )}
      </div>

      {/* ══ INSIGHTS ROW: Mess rankings + Meal breakdown ══ */}
      {filtered.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

          {/* Mess avg score ranking */}
          <div className="chart-card">
            <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Average Score by Mess</h3>
            <p style={{ margin:'0 0 18px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
              Weighted by number of responses · {dateRange.label}
            </p>
            {messSummary.length === 0
              ? <div className="admin-empty" style={{ padding:'20px 0' }}><p style={{ margin:0, fontSize:'0.85rem' }}>No data</p></div>
              : messSummary.map((m, i) => (
                <div key={m.name} style={{ marginBottom:'16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:22, height:22, borderRadius:'6px', fontWeight:800, fontSize:'0.72rem',
                        background: i===0?'rgba(46,204,113,0.12)': i===messSummary.length-1?'rgba(231,76,60,0.12)':'var(--bg-hover)',
                        color: i===0?'var(--primary-green)': i===messSummary.length-1?'var(--danger)':'var(--text-muted)',
                      }}>{i+1}</span>
                      <span style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text-main)' }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>
                      {m.totalResp.toLocaleString()} response{m.totalResp !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ScoreBar avg={m.avg}/>
                </div>
              ))
            }
          </div>

          {/* Per-meal breakdown */}
          <div className="chart-card">
            <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Score by Meal Type</h3>
            <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
              Average score per meal · {dateRange.label}
            </p>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {mealSummary.map((m, i) => (
                <div key={m.label} style={{
                  padding:'14px 0',
                  borderBottom: i < mealSummary.length-1 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                    <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-main)', textTransform:'capitalize' }}>
                      {m.label}
                    </span>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                        {m.totalResp.toLocaleString()} response{m.totalResp !== 1 ? 's' : ''}
                      </span>
                      {m.avg != null
                        ? <ScorePill avg={m.avg}/>
                        : <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>No data</span>
                      }
                    </div>
                  </div>
                  {m.avg != null && <ScoreBar avg={m.avg}/>}
                  {m.avg == null && (
                    <p style={{ margin:0, fontSize:'0.78rem', color:'var(--text-muted)' }}>
                      No feedback submitted for {m.label} in this period
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ DETAIL TABLE ══ */}
      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <div>
            <h3 style={{ margin:0 }}>Feedback Log</h3>
            <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
              📅 {dateRange.label}
              {filterMess !== 'all' && ` · ${filterMess}`}
              {filterMeal !== 'all' && ` · ${filterMeal} only`}
              {' '}— {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="admin-empty">
            <MessageSquare size={48} className="admin-empty-icon"/>
            <p style={{ margin:0, fontWeight:600 }}>No feedback found</p>
            <p style={{ margin:0, fontSize:'0.83rem' }}>Try a different time range or filters</p>
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
                  <th>Score Bar</th>
                  <th>Responses</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const avg      = Number(r.average) || 0;
                  const dayLabel = relativeDayLabel(r.date);
                  const isToday  = dayLabel === 'Today';
                  const isYest   = dayLabel === 'Yesterday';
                  return (
                    <tr key={`${r.date}-${r.meal_type}-${r.caterer_id}`}>
                      <td className="muted">{i+1}</td>
                      <td>
                        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                          <span style={{
                            fontSize:'0.8rem', fontWeight:700,
                            color: isToday?'var(--primary-green)': isYest?'var(--primary-blue)':'var(--text-main)',
                          }}>{dayLabel}</span>
                          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{fmtDisplay(r.date)}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight:600 }}>{r.caterers?.name || '—'}</td>
                      <td><span className={`meal-pill ${r.meal_type}`}>{r.meal_type}</span></td>
                      <td><ScorePill avg={avg}/></td>
                      <td style={{ minWidth:'130px' }}><ScoreBar avg={avg}/></td>
                      <td>
                        <span style={{
                          background:'var(--bg-hover)', padding:'3px 10px',
                          borderRadius:'20px', fontSize:'0.78rem', fontWeight:600,
                          color:'var(--text-muted)',
                        }}>
                          {(r.feedback_count||0).toLocaleString()} response{r.feedback_count !== 1 ? 's' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:'2px solid var(--border-color)', background:'var(--bg-hover)' }}>
                  <td colSpan={4} style={{ padding:'12px 20px', fontWeight:800, fontSize:'0.85rem' }}>
                    TOTAL — {dateRange.label}
                  </td>
                  <td style={{ padding:'12px 20px' }}>
                    {stats.overallAvg != null && <ScorePill avg={stats.overallAvg}/>}
                  </td>
                  <td style={{ padding:'12px 20px' }}>
                    {stats.overallAvg != null && <ScoreBar avg={stats.overallAvg}/>}
                  </td>
                  <td style={{ padding:'12px 20px', fontWeight:800, color:'var(--text-muted)', fontSize:'0.88rem' }}>
                    {stats.totalResponses.toLocaleString()} total
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminFeedbackView;