import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Trash2, RefreshCw, FileBarChart2,
  TrendingDown, TrendingUp, AlertTriangle, Award,
  ChevronUp, ChevronDown
} from 'lucide-react';

/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner'];

const WASTE_CATS = [
  { key: 'plate_waste',      label: 'Plate Waste',      short: 'Plate',    color: '#e74c3c' },
  { key: 'kitchen_uncooked', label: 'Kitchen Uncooked', short: 'Uncooked', color: '#f39c12' },
  { key: 'kitchen_cooked',   label: 'Kitchen Cooked',   short: 'Cooked',   color: '#6c5ce7' },
];

const TIME_PRESETS = [
  { key: 'today',      label: 'Today'      },
  { key: 'yesterday',  label: 'Yesterday'  },
  { key: 'week',       label: 'This Week'  },
  { key: 'last_week',  label: 'Last Week'  },
  { key: 'month',      label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all',        label: 'All Time'   },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const fmtLong    = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
const fmtShort   = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
const fmtFull    = (d) => new Date(d).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });

function getDateRange(preset) {
  const now = new Date();
  const tod = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: tod, to: endOfDay(now), label: `Today — ${fmtLong(now)}` };
    case 'yesterday': {
      const yest = new Date(tod); yest.setDate(tod.getDate()-1);
      return { from: startOfDay(yest), to: endOfDay(yest), label: `Yesterday — ${fmtLong(yest)}` };
    }
    case 'week': {
      const mon = new Date(tod);
      mon.setDate(tod.getDate() - tod.getDay() + (tod.getDay()===0?-6:1));
      return { from: mon, to: endOfDay(now), label: `This week (${fmtShort(mon)} – ${fmtShort(now)})` };
    }
    case 'last_week': {
      const lm = new Date(tod);
      lm.setDate(tod.getDate() - tod.getDay() + (tod.getDay()===0?-6:1) - 7);
      const ls = new Date(lm); ls.setDate(lm.getDate()+6);
      return { from: startOfDay(lm), to: endOfDay(ls), label: `Last week (${fmtShort(lm)} – ${fmtShort(ls)})` };
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

function relativeDayLabel(dateStr) {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6)  return d.toLocaleDateString('en-IN', { weekday:'short' });
  return fmtFull(d);
}

/* Simple inline bar */
const MiniBar = ({ val, max, color }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
    <div style={{ flex:1, height:'7px', background:'var(--border-color)', borderRadius:'4px', overflow:'hidden', minWidth:'50px' }}>
      <div style={{ width: max>0?`${Math.min(100,(val/max)*100)}%`:'0%', height:'7px', borderRadius:'4px', background:color, transition:'width 0.5s ease' }}/>
    </div>
    <span style={{ fontWeight:700, fontSize:'0.8rem', color:'var(--text-main)', width:'44px', textAlign:'right' }}>{val.toFixed(1)}</span>
  </div>
);

/* ─────────────────────────────────────────────
   DAILY TREND CHART
───────────────────────────────────────────── */
const DailyTrend = ({ data }) => {
  if (!data.length) return <div className="admin-empty" style={{ padding:'24px 0' }}><p style={{ margin:0, fontSize:'0.85rem' }}>No trend data</p></div>;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const H = 120;
  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', minWidth: data.length*44, padding:'4px 0 0', height: H+40 }}>
        {data.map((d, i) => {
          const barH = Math.max(4, (d.total / maxVal) * H);
          const isMax = d.total === maxVal;
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', flex:1, minWidth:'38px' }}>
              {/* Val label on hover / always on max */}
              <span style={{
                fontSize:'0.65rem', fontWeight:700,
                color: isMax ? 'var(--danger)' : 'var(--text-muted)',
                opacity: isMax ? 1 : 0.7,
              }}>{d.total.toFixed(1)}</span>
              {/* Stacked bar */}
              <div style={{ width:'100%', display:'flex', flexDirection:'column-reverse', borderRadius:'5px', overflow:'hidden', height: barH }}>
                {WASTE_CATS.map(cat => {
                  const catH = d.total > 0 ? (d[cat.key]/d.total)*barH : 0;
                  return catH > 0 ? (
                    <div key={cat.key} style={{ height:catH, background:cat.color, width:'100%' }}
                      title={`${cat.label}: ${d[cat.key].toFixed(1)} kg`}/>
                  ) : null;
                })}
              </div>
              {/* Date label */}
              <span style={{ fontSize:'0.62rem', color:'var(--text-muted)', textAlign:'center', lineHeight:1.2, whiteSpace:'nowrap' }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display:'flex', gap:'14px', marginTop:'10px', flexWrap:'wrap' }}>
        {WASTE_CATS.map(c => (
          <div key={c.key} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <div style={{ width:9, height:9, borderRadius:'2px', background:c.color }}/>
            <span style={{ fontSize:'0.69rem', color:'var(--text-muted)' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const WasteReportsView = () => {
  const [allReports, setAllReports] = useState([]);
  const [caterers,   setCaterers]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  const [timePreset, setTimePreset] = useState('month');
  const [filterMess, setFilterMess] = useState('all');
  const [filterMeal, setFilterMeal] = useState('all');
  const [search,     setSearch]     = useState('');
  const [sortKey,    setSortKey]    = useState('report_date');
  const [sortDir,    setSortDir]    = useState('desc');

  const dateRange = useMemo(() => getDateRange(timePreset), [timePreset]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [{ data: reports }, { data: cats }] = await Promise.all([
        supabase.from('waste_reports')
          .select('report_id,report_date,meal_type,plate_waste,kitchen_uncooked,kitchen_cooked,created_at,caterers(name)')
          .order('report_date', { ascending: false }),
        supabase.from('caterers').select('caterer_id,name').order('name'),
      ]);
      setAllReports(reports || []);
      setCaterers(cats || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  /* ── Filtered by time + mess + meal + search ── */
  const filtered = useMemo(() => {
    return allReports.filter(r => {
      const d = new Date(r.report_date);
      const inRange = !dateRange.from || (d >= dateRange.from && d <= (dateRange.to || new Date()));
      const messOk  = filterMess === 'all' || r.caterers?.name === filterMess;
      const mealOk  = filterMeal === 'all' || r.meal_type === filterMeal;
      const srchOk  = !search || (r.caterers?.name||'').toLowerCase().includes(search.toLowerCase());
      return inRange && messOk && mealOk && srchOk;
    });
  }, [allReports, dateRange, filterMess, filterMeal, search]);

  /* ── Sorted table rows ── */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === 'report_date') { av = new Date(a.report_date); bv = new Date(b.report_date); }
      else if (sortKey === 'mess')   { av = a.caterers?.name||''; bv = b.caterers?.name||''; }
      else if (sortKey === 'total')  { av = (Number(a.plate_waste)||0)+(Number(a.kitchen_uncooked)||0)+(Number(a.kitchen_cooked)||0); bv=(Number(b.plate_waste)||0)+(Number(b.kitchen_uncooked)||0)+(Number(b.kitchen_cooked)||0); }
      else { av = Number(a[sortKey])||0; bv = Number(b[sortKey])||0; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  /* ── Totals ── */
  const totals = useMemo(() => {
    const plate = filtered.reduce((s,r)=>s+(Number(r.plate_waste)||0),0);
    const unc   = filtered.reduce((s,r)=>s+(Number(r.kitchen_uncooked)||0),0);
    const coo   = filtered.reduce((s,r)=>s+(Number(r.kitchen_cooked)||0),0);
    return { plate, unc, coo, grand: plate+unc+coo, count: filtered.length };
  }, [filtered]);

  /* ── Worst single report ── */
  const worstReport = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.reduce((wst, r) => {
      const t = (Number(r.plate_waste)||0)+(Number(r.kitchen_uncooked)||0)+(Number(r.kitchen_cooked)||0);
      const wt= (Number(wst.plate_waste)||0)+(Number(wst.kitchen_uncooked)||0)+(Number(wst.kitchen_cooked)||0);
      return t > wt ? r : wst;
    });
  }, [filtered]);

  /* ── Per-mess summary for mini insight cards ── */
  const messSummary = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const n = r.caterers?.name || 'Unknown';
      if (!map[n]) map[n] = { name:n, plate_waste:0, kitchen_uncooked:0, kitchen_cooked:0, count:0 };
      map[n].plate_waste      += Number(r.plate_waste)||0;
      map[n].kitchen_uncooked += Number(r.kitchen_uncooked)||0;
      map[n].kitchen_cooked   += Number(r.kitchen_cooked)||0;
      map[n].count++;
    });
    return Object.values(map)
      .map(m=>({...m, total: m.plate_waste+m.kitchen_uncooked+m.kitchen_cooked}))
      .sort((a,b)=>b.total-a.total);
  }, [filtered]);

  const maxMessTotal = useMemo(()=>Math.max(...messSummary.map(m=>m.total),1),[messSummary]);

  /* ── Per-meal summary ── */
  const mealSummary = useMemo(() => {
    const types = ['breakfast','lunch','dinner'];
    return types.map(mt => {
      const rows = filtered.filter(r=>r.meal_type===mt);
      const p = rows.reduce((s,r)=>s+(Number(r.plate_waste)||0),0);
      const u = rows.reduce((s,r)=>s+(Number(r.kitchen_uncooked)||0),0);
      const c = rows.reduce((s,r)=>s+(Number(r.kitchen_cooked)||0),0);
      return { label:mt, plate:p, unc:u, coo:c, total:p+u+c, count:rows.length };
    });
  }, [filtered]);

  /* ── Daily trend (last 14 data points) ── */
  const dailyTrend = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const k = r.report_date.slice(0,10);
      if (!map[k]) map[k] = { date:k, plate_waste:0, kitchen_uncooked:0, kitchen_cooked:0 };
      map[k].plate_waste      += Number(r.plate_waste)||0;
      map[k].kitchen_uncooked += Number(r.kitchen_uncooked)||0;
      map[k].kitchen_cooked   += Number(r.kitchen_cooked)||0;
    });
    return Object.values(map)
      .map(d => ({ ...d, total: d.plate_waste+d.kitchen_uncooked+d.kitchen_cooked, label: relativeDayLabel(d.date) }))
      .sort((a,b)=>a.date.localeCompare(b.date))
      .slice(-14);
  }, [filtered]);

  const maxTableTotal = useMemo(()=>Math.max(...sorted.map(r=>(Number(r.plate_waste)||0)+(Number(r.kitchen_uncooked)||0)+(Number(r.kitchen_cooked)||0)),1),[sorted]);

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ChevronDown size={12} style={{ opacity:0.3 }}/>;
    return sortDir === 'asc' ? <ChevronUp size={12} color="var(--primary-green)"/> : <ChevronDown size={12} color="var(--primary-green)"/>;
  };

  const thBtn = (k, label) => (
    <th style={{ cursor:'pointer', userSelect:'none' }} onClick={() => toggleSort(k)}>
      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>{label}<SortIcon k={k}/></span>
    </th>
  );

  if (loading) return (
    <div className="admin-loading" style={{ height:'40vh' }}>
      <Loader2 size={24} className="spin"/> Loading waste reports…
    </div>
  );

  const avgGrand = totals.count > 0 ? (totals.grand/totals.count).toFixed(1) : '—';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* ══ FILTER BAR ══ */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>

        {/* Left — date context */}
        <p style={{ margin:0, fontSize:'0.875rem', fontWeight:700, color:'var(--text-main)' }}>
          {dateRange.label}
          {filterMess!=='all' && <span style={{ color:'var(--text-muted)', fontWeight:600 }}> · {filterMess}</span>}
          {filterMeal!=='all' && <span style={{ color:'var(--text-muted)', fontWeight:600, textTransform:'capitalize' }}> · {filterMeal}</span>}
        </p>

        {/* Right — all controls */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10, padding:3, border:'1px solid var(--border-color)' }}>
            {TIME_PRESETS.map(p => (
              <button key={p.key} onClick={()=>setTimePreset(p.key)} style={{
                padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s', whiteSpace:'nowrap',
                background: timePreset===p.key ? 'var(--bg-card)' : 'transparent',
                color:       timePreset===p.key ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow:   timePreset===p.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{p.label}</button>
            ))}
          </div>

          <select value={filterMess} onChange={e=>setFilterMess(e.target.value)}
            className="admin-filter-select"
            style={{
              fontSize:'0.78rem', fontWeight:600, padding:'6px 32px 6px 10px',
              border:`1px solid ${filterMess!=='all'?'var(--primary-green)':'var(--border-color)'}`,
              background: filterMess!=='all'?'rgba(46,204,113,0.07)':'var(--bg-input)',
            }}>
            <option value="all">All Messes</option>
            {caterers.map(c=><option key={c.caterer_id} value={c.name}>{c.name}</option>)}
          </select>

          <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10, padding:3, border:'1px solid var(--border-color)' }}>
            {MEAL_TYPES.map(m => (
              <button key={m} onClick={()=>setFilterMeal(m)} style={{
                padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700, textTransform:'capitalize', transition:'all 0.15s', whiteSpace:'nowrap',
                background: filterMeal===m ? 'var(--bg-card)' : 'transparent',
                color:       filterMeal===m ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow:   filterMeal===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{m==='all'?'All Meals':m}</button>
            ))}
          </div>

          <button className="icon-btn" onClick={fetchReports} title="Refresh">
            <RefreshCw size={14} className={loading?'spin':''}/>
          </button>
          {(filterMess!=='all'||filterMeal!=='all'||timePreset!=='month') && (
            <button onClick={()=>{setFilterMess('all');setFilterMeal('all');setTimePreset('month');setSearch('');}} style={{
              padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)',
              background:'transparent', color:'var(--danger)', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            }}>✕ Reset</button>
          )}
        </div>
      </div>

      {/* ══ STAT CARDS ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(175px,1fr))', gap:'14px' }}>
        <div className="stat-card">
          <div className="stat-icon blue"><FileBarChart2 size={20}/></div>
          <div className="stat-label">Reports</div>
          <div className="stat-value">{totals.count}</div>
          <div className="stat-sub">{dateRange.label}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Trash2 size={20}/></div>
          <div className="stat-label">Plate Waste</div>
          <div className="stat-value" style={{ color:'#e74c3c' }}>
            {totals.plate.toFixed(1)}<span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> kg</span>
          </div>
          <div className="stat-sub">{dateRange.label}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Trash2 size={20}/></div>
          <div className="stat-label">Kitchen Uncooked</div>
          <div className="stat-value" style={{ color:'#f39c12' }}>
            {totals.unc.toFixed(1)}<span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> kg</span>
          </div>
          <div className="stat-sub">Pre-cooking loss</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue" style={{ background:'rgba(108,92,231,0.12)', color:'var(--primary-blue)' }}>
            <Trash2 size={20}/>
          </div>
          <div className="stat-label">Kitchen Cooked</div>
          <div className="stat-value" style={{ color:'var(--primary-blue)' }}>
            {totals.coo.toFixed(1)}<span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> kg</span>
          </div>
          <div className="stat-sub">Post-cooking loss</div>
        </div>
        <div className="stat-card" style={{ border:'1px solid rgba(231,76,60,0.25)', background:'rgba(231,76,60,0.03)' }}>
          <div className="stat-icon red"><TrendingDown size={20}/></div>
          <div className="stat-label">Grand Total</div>
          <div className="stat-value">{totals.grand.toFixed(1)}<span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> kg</span></div>
          <div className="stat-sub">Avg {avgGrand} kg / report</div>
        </div>
        {worstReport && (
          <div className="stat-card" style={{ border:'1px solid rgba(241,196,15,0.3)', background:'rgba(241,196,15,0.04)' }}>
            <div className="stat-icon yellow"><AlertTriangle size={20}/></div>
            <div className="stat-label">Worst Report</div>
            <div style={{ fontSize:'0.88rem', fontWeight:800, color:'var(--text-main)', lineHeight:1.3 }}>
              {worstReport.caterers?.name || '—'}
            </div>
            <div className="stat-sub" style={{ textTransform:'capitalize' }}>
              {relativeDayLabel(worstReport.report_date)} · {worstReport.meal_type}
            </div>
          </div>
        )}
      </div>

      {/* ══ INSIGHTS ROW: Mess mini-bars + Meal summary + Daily trend ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

        {/* Per-mess total waste bars */}
        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Total Waste by Mess</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            All 3 categories combined · {dateRange.label}
          </p>
          {messSummary.length === 0
            ? <div className="admin-empty" style={{ padding:'20px 0' }}><p style={{ margin:0, fontSize:'0.85rem' }}>No data</p></div>
            : messSummary.map((m, i) => (
              <div key={m.name} style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:22, height:22, borderRadius:'6px', fontWeight:800, fontSize:'0.72rem',
                      background: i===0?'rgba(231,76,60,0.12)': i===messSummary.length-1?'rgba(46,204,113,0.12)':'var(--bg-hover)',
                      color: i===0?'var(--danger)': i===messSummary.length-1?'var(--primary-green)':'var(--text-muted)',
                    }}>{i+1}</span>
                    <span style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text-main)' }}>{m.name}</span>
                    {i===0 && messSummary.length>1 && <span style={{ fontSize:'0.65rem', background:'rgba(231,76,60,0.1)', color:'var(--danger)', padding:'2px 6px', borderRadius:'20px', fontWeight:700 }}>Most</span>}
                    {i===messSummary.length-1 && messSummary.length>1 && <span style={{ fontSize:'0.65rem', background:'rgba(46,204,113,0.1)', color:'var(--primary-green)', padding:'2px 6px', borderRadius:'20px', fontWeight:700 }}>Best 🌿</span>}
                  </div>
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{m.count} report{m.count!==1?'s':''}</span>
                </div>
                <MiniBar val={m.total} max={maxMessTotal} color={i===0?'#e74c3c':i===messSummary.length-1?'#2ecc71':'var(--primary-blue)'}/>
              </div>
            ))
          }
        </div>

        {/* Per-meal summary */}
        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Waste by Meal Type</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Breakdown per meal · {dateRange.label}
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
            {mealSummary.map(m => {
              const maxCat = Math.max(m.plate, m.unc, m.coo, 1);
              return (
                <div key={m.label} style={{
                  padding:'12px 0',
                  borderBottom:'1px solid var(--border-color)',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                    <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-main)', textTransform:'capitalize' }}>{m.label}</span>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{m.count} report{m.count!==1?'s':''}</span>
                      <span style={{ fontSize:'0.82rem', fontWeight:800, color: m.total>0?'var(--text-main)':'var(--text-muted)' }}>
                        {m.total.toFixed(1)} kg
                      </span>
                    </div>
                  </div>
                  {m.total === 0 ? (
                    <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>No data for this period</span>
                  ) : (
                    WASTE_CATS.map(cat => (
                      <div key={cat.key} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px' }}>
                        <div style={{ width:8, height:8, borderRadius:'2px', background:cat.color, flexShrink:0 }}/>
                        <span style={{ width:'100px', fontSize:'0.7rem', color:'var(--text-muted)', flexShrink:0 }}>{cat.label}</span>
                        <div style={{ flex:1, height:'7px', background:'var(--border-color)', borderRadius:'4px', overflow:'hidden' }}>
                          <div style={{ width:maxCat>0?`${(m[cat.key.replace('plate_waste','plate').replace('kitchen_uncooked','unc').replace('kitchen_cooked','coo')]/maxCat)*100}%`:'0%', height:'7px', background:cat.color, borderRadius:'4px', transition:'width 0.5s ease' }}/>
                        </div>
                        <span style={{ width:'44px', fontSize:'0.74rem', fontWeight:700, color:cat.color, textAlign:'right' }}>
                          {m[cat.key.replace('plate_waste','plate').replace('kitchen_uncooked','unc').replace('kitchen_cooked','coo')].toFixed(1)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ DAILY TREND CHART ══ */}
      {dailyTrend.length > 1 && (
        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Daily Waste Trend</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Total waste per day (stacked by category) · {dateRange.label}
            {dailyTrend.length < filtered.length ? ` · showing ${dailyTrend.length} days` : ''}
          </p>
          <DailyTrend data={dailyTrend}/>
        </div>
      )}

      {/* ══ DETAILED TABLE ══ */}
      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <div>
            <h3 style={{ margin:0 }}>All Waste Reports</h3>
            <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
              📅 {dateRange.label}
              {filterMess !== 'all' && ` · ${filterMess}`}
              {filterMeal !== 'all' && ` · ${filterMeal} only`}
              {' '}&mdash; {sorted.length} record{sorted.length!==1?'s':''}{' '}
              · Click column headers to sort
            </p>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="admin-empty">
            <FileBarChart2 size={48} className="admin-empty-icon"/>
            <p style={{ margin:0, fontWeight:600 }}>No reports found</p>
            <p style={{ margin:0, fontSize:'0.83rem' }}>Try adjusting the time range or filters</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  {thBtn('report_date', 'Date')}
                  {thBtn('mess', 'Mess')}
                  <th>Meal</th>
                  {thBtn('plate_waste',      <span style={{ color:'#e74c3c' }}>Plate (kg)</span>)}
                  {thBtn('kitchen_uncooked', <span style={{ color:'#f39c12' }}>Uncooked (kg)</span>)}
                  {thBtn('kitchen_cooked',   <span style={{ color:'#6c5ce7' }}>Cooked (kg)</span>)}
                  {thBtn('total', 'Total')}
                  <th>Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const plate = Number(r.plate_waste)||0;
                  const unc   = Number(r.kitchen_uncooked)||0;
                  const coo   = Number(r.kitchen_cooked)||0;
                  const total = plate+unc+coo;
                  const dayLabel = relativeDayLabel(r.report_date);
                  const isToday = dayLabel === 'Today';
                  const isYest  = dayLabel === 'Yesterday';
                  return (
                    <tr key={r.report_id}>
                      <td className="muted">{i+1}</td>
                      <td>
                        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                          <span style={{
                            fontSize:'0.8rem', fontWeight:700,
                            color: isToday?'var(--primary-green)': isYest?'var(--primary-blue)':'var(--text-main)',
                          }}>{dayLabel}</span>
                          <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>
                            {new Date(r.report_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight:600 }}>{r.caterers?.name||'—'}</td>
                      <td><span className={`meal-pill ${r.meal_type}`}>{r.meal_type}</span></td>
                      <td><span style={{ fontWeight:700, color:'#e74c3c' }}>{plate.toFixed(1)}</span></td>
                      <td><span style={{ fontWeight:700, color:'#f39c12' }}>{unc.toFixed(1)}</span></td>
                      <td><span style={{ fontWeight:700, color:'#6c5ce7' }}>{coo.toFixed(1)}</span></td>
                      <td>
                        <span style={{
                          fontWeight:800, fontSize:'0.92rem',
                          color: total>20?'var(--danger)': total>10?'var(--warning)':'var(--text-main)',
                        }}>{total.toFixed(1)} kg</span>
                      </td>
                      <td style={{ minWidth:'130px' }}>
                        {/* stacked mini-bar */}
                        <div style={{ display:'flex', height:'10px', borderRadius:'5px', overflow:'hidden', gap:'1px', minWidth:'110px' }}>
                          {WASTE_CATS.map(cat => {
                            const v = Number(r[cat.key])||0;
                            const p = total>0?(v/total)*100:0;
                            return p>0?<div key={cat.key} style={{ width:`${p}%`, background:cat.color }} title={`${cat.label}: ${v.toFixed(1)} kg`}/>:null;
                          })}
                        </div>
                        <div style={{ display:'flex', gap:'6px', marginTop:'3px' }}>
                          {WASTE_CATS.map(cat => {
                            const v = Number(r[cat.key])||0;
                            const p = total>0?(v/total)*100:0;
                            return p>5?<span key={cat.key} style={{ fontSize:'0.62rem', color:cat.color, fontWeight:700 }}>{p.toFixed(0)}%</span>:null;
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:'2px solid var(--border-color)', background:'var(--bg-hover)' }}>
                  <td colSpan={4} style={{ padding:'12px 20px', fontWeight:800, fontSize:'0.85rem' }}>
                    TOTAL — {sorted.length} reports · {dateRange.label}
                  </td>
                  <td style={{ padding:'12px 20px', fontWeight:800, color:'#e74c3c' }}>{totals.plate.toFixed(1)} kg</td>
                  <td style={{ padding:'12px 20px', fontWeight:800, color:'#f39c12' }}>{totals.unc.toFixed(1)} kg</td>
                  <td style={{ padding:'12px 20px', fontWeight:800, color:'#6c5ce7' }}>{totals.coo.toFixed(1)} kg</td>
                  <td style={{ padding:'12px 20px', fontWeight:800, fontSize:'1rem' }}>{totals.grand.toFixed(1)} kg</td>
                  <td style={{ padding:'12px 20px', fontSize:'0.78rem', color:'var(--text-muted)' }}>avg {avgGrand} kg / report</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default WasteReportsView;