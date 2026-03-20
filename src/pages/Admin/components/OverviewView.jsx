import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Users, Trash2, UtensilsCrossed,
  TrendingDown, TrendingUp, Filter, RefreshCw, Calendar
} from 'lucide-react';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const MEAL_TYPES = ['all', 'breakfast', 'lunch', 'dinner'];

const WASTE_CATS = [
  { key: 'plate_waste',      label: 'Plate Waste',      color: '#e74c3c', light: 'rgba(231,76,60,0.13)'  },
  { key: 'kitchen_uncooked', label: 'Kitchen Uncooked', color: '#f39c12', light: 'rgba(243,156,18,0.13)' },
  { key: 'kitchen_cooked',   label: 'Kitchen Cooked',   color: '#6c5ce7', light: 'rgba(108,92,231,0.13)' },
];

/* date helpers */
const today      = () => new Date();
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const fmtDate    = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
const fmtDateShort = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });

const TIME_PRESETS = [
  { key: 'today',       label: 'Today'         },
  { key: 'week',        label: 'This Week'      },
  { key: 'month',       label: 'This Month'     },
  { key: 'last_month',  label: 'Last Month'     },
  { key: 'all',         label: 'All Time'       },
];

function getDateRange(preset) {
  const now = today();
  const sd  = startOfDay(now);
  switch (preset) {
    case 'today':      return { from: sd, to: now, label: `Today, ${fmtDate(now)}` };
    case 'week': {
      const mon = new Date(sd);
      mon.setDate(sd.getDate() - sd.getDay() + (sd.getDay() === 0 ? -6 : 1));
      return { from: mon, to: now, label: `This week (${fmtDateShort(mon)} – ${fmtDateShort(now)})` };
    }
    case 'month': {
      const fm = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fm, to: now, label: `${now.toLocaleDateString('en-IN', { month:'long', year:'numeric' })}` };
    }
    case 'last_month': {
      const lm  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: lm, to: lme, label: `${lm.toLocaleDateString('en-IN', { month:'long', year:'numeric' })}` };
    }
    default: return { from: null, to: null, label: 'All time' };
  }
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */
const GroupedBar = ({ row, max, animate }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{row.name}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{row.total.toFixed(1)} kg total</span>
    </div>
    {WASTE_CATS.map(cat => {
      const val = row[cat.key] || 0;
      const w   = max > 0 ? (val / max) * 100 : 0;
      return (
        <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '3px', background: cat.color, flexShrink: 0 }} />
          <span style={{ width: '120px', fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{cat.label}</span>
          <div style={{ flex: 1, height: '10px', background: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              height: '10px', borderRadius: '5px', background: cat.color,
              width: animate ? `${w}%` : '0%',
              transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <span style={{ width: '48px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', textAlign: 'right' }}>
            {val.toFixed(1)}
          </span>
        </div>
      );
    })}
  </div>
);

const DonutChart = ({ data, total }) => {
  const R = 68, CX = 88, CY = 88, SW = 20;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const slices = data.map(d => {
    const dash = total > 0 ? (d.value / total) * circ : 0;
    const sl   = { ...d, dash, gap: circ - dash, offset };
    offset += dash;
    return sl;
  });
  return (
    <svg viewBox="0 0 176 176" width="176" height="176" style={{ flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-color)" strokeWidth={SW} />
      {slices.map(s => (
        <circle key={s.key} cx={CX} cy={CY} r={R} fill="none"
          stroke={s.color} strokeWidth={SW}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset + circ / 4}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      ))}
      <text x={CX} y={CY - 7} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--text-main)">{total.toFixed(0)}</text>
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize="9" fill="var(--text-muted)">kg total</text>
    </svg>
  );
};

const StackedBar = ({ row }) => (
  <div style={{ marginBottom: '13px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)' }}>{row.name}</span>
      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{row.total.toFixed(1)} kg</span>
    </div>
    <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', gap: '1px' }}>
      {WASTE_CATS.map(cat => {
        const pct = row.total > 0 ? ((row[cat.key] || 0) / row.total) * 100 : 0;
        return pct > 0 ? (
          <div key={cat.key} title={`${cat.label}: ${(row[cat.key]||0).toFixed(1)} kg (${pct.toFixed(1)}%)`}
            style={{ width: `${pct}%`, background: cat.color, cursor: 'default', transition: 'width 0.5s ease' }} />
        ) : null;
      })}
    </div>
    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
      {WASTE_CATS.map(cat => {
        const pct = row.total > 0 ? ((row[cat.key] || 0) / row.total) * 100 : 0;
        return pct > 3 ? (
          <span key={cat.key} style={{ fontSize: '0.67rem', color: cat.color, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
        ) : null;
      })}
    </div>
  </div>
);

const MealBar = ({ label, values, max }) => (
  <div style={{ marginBottom: '18px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>{label}</span>
      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{values.reduce((s,v)=>s+v,0).toFixed(1)} kg</span>
    </div>
    {WASTE_CATS.map((cat, i) => (
      <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <span style={{ width: '120px', fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{cat.label}</span>
        <div style={{ flex: 1, height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '8px', borderRadius: '4px', background: cat.color,
            width: max > 0 ? `${(values[i] / max) * 100}%` : '0%',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <span style={{ width: '44px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', textAlign: 'right' }}>
          {values[i].toFixed(1)}
        </span>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const OverviewView = () => {
  const [allReports, setAllReports] = useState([]);
  const [caterers,   setCaterers]   = useState([]);
  const [profiles,   setProfiles]   = useState({ students: 0, caterers: 0 });
  const [loading,    setLoading]    = useState(true);
  const [animate,    setAnimate]    = useState(false);

  const [filterMess,   setFilterMess]   = useState('all');
  const [filterMeal,   setFilterMeal]   = useState('all');
  const [timePreset,   setTimePreset]   = useState('month');

  const dateRange = useMemo(() => getDateRange(timePreset), [timePreset]);

  const fetchAll = async () => {
    setLoading(true); setAnimate(false);
    try {
      const [{ count: sc }, { count: cc }, { data: reports }, { data: cats }] = await Promise.all([
        supabase.from('profiles').select('*', { count:'exact', head:true }).eq('role','student'),
        supabase.from('profiles').select('*', { count:'exact', head:true }).eq('role','caterer'),
        supabase.from('waste_reports')
          .select('report_id,report_date,meal_type,plate_waste,kitchen_uncooked,kitchen_cooked,caterers(name)')
          .order('report_date', { ascending: false }),
        supabase.from('caterers').select('caterer_id,name').order('name'),
      ]);
      setProfiles({ students: sc || 0, caterers: cc || 0 });
      setAllReports(reports || []);
      setCaterers(cats || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setTimeout(() => setAnimate(true), 80); }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { setAnimate(false); setTimeout(() => setAnimate(true), 80); }, [filterMess, filterMeal, timePreset]);

  const filtered = useMemo(() => {
    return allReports.filter(r => {
      const d = new Date(r.report_date);
      const inRange = !dateRange.from || (d >= dateRange.from && d <= (dateRange.to || new Date()));
      return inRange &&
        (filterMess === 'all' || r.caterers?.name === filterMess) &&
        (filterMeal === 'all' || r.meal_type === filterMeal);
    });
  }, [allReports, filterMess, filterMeal, dateRange]);

  const totals = useMemo(() => {
    const plate = filtered.reduce((s,r) => s + (Number(r.plate_waste)||0), 0);
    const unc   = filtered.reduce((s,r) => s + (Number(r.kitchen_uncooked)||0), 0);
    const coo   = filtered.reduce((s,r) => s + (Number(r.kitchen_cooked)||0), 0);
    return { plate, unc, coo, grand: plate+unc+coo, count: filtered.length };
  }, [filtered]);

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
    return Object.values(map).map(m => ({ ...m, total: m.plate_waste+m.kitchen_uncooked+m.kitchen_cooked })).sort((a,b)=>b.total-a.total);
  }, [filtered]);

  const mealSummary = useMemo(() => {
    const types = filterMeal === 'all' ? ['breakfast','lunch','dinner'] : [filterMeal];
    return types.map(mt => {
      const rows = filtered.filter(r => r.meal_type === mt);
      const p = rows.reduce((s,r)=>s+(Number(r.plate_waste)||0),0);
      const u = rows.reduce((s,r)=>s+(Number(r.kitchen_uncooked)||0),0);
      const c = rows.reduce((s,r)=>s+(Number(r.kitchen_cooked)||0),0);
      return { label: mt, values:[p,u,c], total: p+u+c };
    }).filter(m => m.total > 0);
  }, [filtered, filterMeal]);

  const maxMealVal = useMemo(() => Math.max(...mealSummary.flatMap(m=>m.values), 1), [mealSummary]);
  const maxGrouped = useMemo(() => Math.max(...messSummary.map(m=>Math.max(m.plate_waste,m.kitchen_uncooked,m.kitchen_cooked)), 1), [messSummary]);

  const donutData = [
    { key:'plate', label:'Plate Waste',      color:'#e74c3c', value: totals.plate },
    { key:'unc',   label:'Kitchen Uncooked',  color:'#f39c12', value: totals.unc   },
    { key:'coo',   label:'Kitchen Cooked',    color:'#6c5ce7', value: totals.coo   },
  ];

  const avgGrand  = totals.count > 0 ? (totals.grand / totals.count).toFixed(1) : '—';
  const worstMess = messSummary.length > 0 ? messSummary[0] : null;
  const bestMess  = messSummary.length > 1 ? messSummary[messSummary.length-1] : null;
  const filtersActive = filterMess !== 'all' || filterMeal !== 'all' || timePreset !== 'month';

  if (loading) return (
    <div className="admin-loading" style={{ height: '40vh' }}>
      <Loader2 size={24} className="spin" /> Loading overview…
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'22px' }}>

      {/* ══ DATA CONTEXT BANNER ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        background: 'rgba(46,204,113,0.07)', border: '1px solid rgba(46,204,113,0.2)',
        borderRadius: '12px', padding: '11px 18px',
      }}>
        <Calendar size={16} color="var(--primary-green)" />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
          Showing data for:
        </span>
        <span style={{ fontSize: '0.82rem', color: 'var(--primary-green)', fontWeight: 800 }}>
          {dateRange.label}
        </span>
        {filterMess !== 'all' && (
          <>
            <span style={{ color: 'var(--border-color)' }}>·</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Mess:</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--primary-blue)', fontWeight: 700 }}>{filterMess}</span>
          </>
        )}
        {filterMeal !== 'all' && (
          <>
            <span style={{ color: 'var(--border-color)' }}>·</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Meal:</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--primary-blue)', fontWeight: 700, textTransform: 'capitalize' }}>{filterMeal}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {totals.count} report{totals.count !== 1 ? 's' : ''} matched
        </span>
      </div>

      {/* ══ FILTER BAR ══ */}
      <div style={{
        display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap',
        background:'var(--bg-card)', border:'1px solid var(--border-color)',
        borderRadius:'14px', padding:'14px 18px', boxShadow:'var(--shadow)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'var(--text-muted)', fontWeight:700, fontSize:'0.78rem', marginRight:'4px' }}>
          <Filter size={14} /> FILTERS
        </div>

        {/* Time presets */}
        <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
          {TIME_PRESETS.map(p => (
            <button key={p.key} onClick={() => setTimePreset(p.key)} style={{
              padding:'7px 12px', borderRadius:'8px', border:'none', cursor:'pointer',
              fontSize:'0.78rem', fontWeight:700,
              background: timePreset === p.key ? 'var(--primary-blue)' : 'var(--bg-hover)',
              color:       timePreset === p.key ? '#fff' : 'var(--text-muted)',
              transition:'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>

        <div style={{ width:'1px', height:'24px', background:'var(--border-color)' }} />

        {/* Mess */}
        <select value={filterMess} onChange={e=>setFilterMess(e.target.value)} style={{
          padding:'8px 34px 8px 12px', borderRadius:'10px', outline:'none', fontFamily:'inherit', fontWeight:600,
          border:`1px solid ${filterMess!=='all'?'var(--primary-green)':'var(--border-color)'}`,
          background: filterMess!=='all' ? 'rgba(46,204,113,0.08)' : 'var(--bg-input)',
          color:'var(--text-main)', fontSize:'0.875rem', cursor:'pointer', appearance:'none',
          backgroundImage:"url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232ecc71' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
          backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', backgroundSize:'14px',
        }}>
          <option value="all">All Messes</option>
          {caterers.map(c => <option key={c.caterer_id} value={c.name}>{c.name}</option>)}
        </select>

        {/* Meal tabs */}
        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
          {MEAL_TYPES.map(m => (
            <button key={m} onClick={() => setFilterMeal(m)} style={{
              padding:'7px 13px', borderRadius:'8px', border:'none', cursor:'pointer',
              fontSize:'0.78rem', fontWeight:700, textTransform:'capitalize',
              background: filterMeal===m ? 'var(--primary-green)' : 'var(--bg-hover)',
              color:       filterMeal===m ? '#fff' : 'var(--text-muted)',
              transition:'all 0.15s',
            }}>{m === 'all' ? 'All Meals' : m}</button>
          ))}
        </div>

        <button className="icon-btn" onClick={fetchAll} title="Refresh data" style={{ marginLeft:'auto' }}>
          <RefreshCw size={15} />
        </button>

        {filtersActive && (
          <button onClick={() => { setFilterMess('all'); setFilterMeal('all'); setTimePreset('month'); }} style={{
            padding:'6px 12px', borderRadius:'8px', border:'1px solid var(--border-color)',
            background:'transparent', color:'var(--danger)', fontSize:'0.78rem', fontWeight:600, cursor:'pointer',
          }}>✕ Reset</button>
        )}
      </div>

      {/* ══ STAT CARDS ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(178px,1fr))', gap:'14px' }}>
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={20}/></div>
          <div className="stat-label">Students</div>
          <div className="stat-value">{profiles.students}</div>
          <div className="stat-sub">All registered</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><UtensilsCrossed size={20}/></div>
          <div className="stat-label">Caterers</div>
          <div className="stat-value">{profiles.caterers}</div>
          <div className="stat-sub">Active messes</div>
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
          <div className="stat-sub">Pre-cooking loss · {dateRange.label}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue" style={{ background:'rgba(108,92,231,0.12)', color:'var(--primary-blue)' }}>
            <Trash2 size={20}/>
          </div>
          <div className="stat-label">Kitchen Cooked</div>
          <div className="stat-value" style={{ color:'var(--primary-blue)' }}>
            {totals.coo.toFixed(1)}<span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> kg</span>
          </div>
          <div className="stat-sub">Post-cooking loss · {dateRange.label}</div>
        </div>
        <div className="stat-card" style={{ border:'1px solid rgba(231,76,60,0.25)', background:'rgba(231,76,60,0.03)' }}>
          <div className="stat-icon red"><TrendingDown size={20}/></div>
          <div className="stat-label">Grand Total</div>
          <div className="stat-value">
            {totals.grand.toFixed(1)}<span style={{ fontSize:'1rem', fontWeight:400, color:'var(--text-muted)' }}> kg</span>
          </div>
          <div className="stat-sub">Avg {avgGrand} kg / report</div>
        </div>
      </div>

      {/* ══ ROW 1: Grouped bars + Donut ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 310px', gap:'20px', alignItems:'start' }}>

        <div className="chart-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'22px' }}>
            <div>
              <h3 style={{ margin:0, fontSize:'1rem', fontWeight:800 }}>Waste Breakdown by Mess</h3>
              <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
                All 3 categories · {dateRange.label}
                {filterMeal !== 'all' && ` · ${filterMeal} only`}
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'5px', flexShrink:0 }}>
              {WASTE_CATS.map(c => (
                <div key={c.key} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:9, height:9, borderRadius:'2px', background:c.color }} />
                  <span style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          {messSummary.length === 0
            ? <div className="admin-empty"><Trash2 size={40} className="admin-empty-icon"/><p>No data for selected filters</p></div>
            : messSummary.map(row => <GroupedBar key={row.name} row={row} max={maxGrouped} animate={animate}/>)
          }
        </div>

        <div className="chart-card" style={{ padding:'22px' }}>
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Waste Distribution</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>{dateRange.label}</p>
          {totals.grand === 0
            ? <div className="admin-empty" style={{ padding:'30px 0' }}><Trash2 size={36} className="admin-empty-icon"/><p style={{ margin:0, fontSize:'0.85rem' }}>No data</p></div>
            : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px' }}>
                <DonutChart data={donutData} total={totals.grand}/>
                <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'9px' }}>
                  {donutData.map(d => {
                    const pct = totals.grand > 0 ? ((d.value/totals.grand)*100).toFixed(1) : 0;
                    return (
                      <div key={d.key} style={{
                        display:'flex', alignItems:'center', gap:'9px',
                        padding:'8px 12px', borderRadius:'10px',
                        background: d.color+'18', border:`1px solid ${d.color}30`,
                      }}>
                        <div style={{ width:9, height:9, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                        <span style={{ flex:1, fontSize:'0.78rem', fontWeight:600, color:'var(--text-main)' }}>{d.label}</span>
                        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)' }}>{d.value.toFixed(1)} kg</span>
                        <span style={{ fontSize:'0.85rem', fontWeight:800, color:d.color }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          }
        </div>
      </div>

      {/* ══ ROW 2: Stacked + Meal ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Waste Composition per Mess</h3>
          <p style={{ margin:'0 0 14px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Proportional split across categories · {dateRange.label}
          </p>
          <div style={{ display:'flex', gap:'12px', marginBottom:'14px', flexWrap:'wrap' }}>
            {WASTE_CATS.map(c => (
              <div key={c.key} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <div style={{ width:9, height:9, borderRadius:'2px', background:c.color }}/>
                <span style={{ fontSize:'0.69rem', color:'var(--text-muted)' }}>{c.label}</span>
              </div>
            ))}
          </div>
          {messSummary.length === 0
            ? <div className="admin-empty" style={{ padding:'20px 0' }}><p style={{ margin:0, fontSize:'0.85rem' }}>No data</p></div>
            : messSummary.map(row => <StackedBar key={row.name} row={row}/>)
          }
        </div>

        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Waste by Meal Type</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Per-category waste across breakfast, lunch & dinner · {dateRange.label}
          </p>
          {mealSummary.length === 0
            ? <div className="admin-empty" style={{ padding:'20px 0' }}><p style={{ margin:0, fontSize:'0.85rem' }}>No meal data</p></div>
            : mealSummary.map(m => <MealBar key={m.label} label={m.label} values={m.values} max={maxMealVal}/>)
          }
        </div>
      </div>

      {/* ══ ROW 3: Table ══ */}
      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <div>
            <h3 style={{ margin:0 }}>Mess-wise Waste Summary</h3>
            <div style={{ display:'flex', gap:'14px', marginTop:'5px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>
                {dateRange.label}
                {filterMess !== 'all' && ` · ${filterMess}`}
                {filterMeal !== 'all' && ` · ${filterMeal}`}
              </span>
              {worstMess && <span style={{ fontSize:'0.74rem', color:'var(--danger)' }}>Most wasteful: <strong>{worstMess.name}</strong> ({worstMess.total.toFixed(1)} kg)</span>}
              {bestMess  && <span style={{ fontSize:'0.74rem', color:'var(--primary-green)' }}>Best: <strong>{bestMess.name}</strong> ({bestMess.total.toFixed(1)} kg)</span>}
            </div>
          </div>
          <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{totals.count} report{totals.count!==1?'s':''}</div>
        </div>

        {messSummary.length === 0
          ? <div className="admin-empty"><Trash2 size={42} className="admin-empty-icon"/><p style={{ margin:0, fontWeight:600 }}>No data for current filters</p></div>
          : (
            <div style={{ overflowX:'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Mess</th><th>Reports</th>
                    <th style={{ color:'#e74c3c' }}>Plate (kg)</th>
                    <th style={{ color:'#f39c12' }}>K. Uncooked (kg)</th>
                    <th style={{ color:'#6c5ce7' }}>K. Cooked (kg)</th>
                    <th>Total</th><th>Share</th><th>Avg/Report</th>
                  </tr>
                </thead>
                <tbody>
                  {messSummary.map((row, i) => {
                    const share  = totals.grand > 0 ? ((row.total/totals.grand)*100).toFixed(1) : 0;
                    const avgRep = row.count > 0 ? (row.total/row.count).toFixed(1) : '—';
                    const isWorst = i===0 && messSummary.length>1;
                    const isBest  = i===messSummary.length-1 && messSummary.length>1;
                    return (
                      <tr key={row.name}>
                        <td>
                          <span style={{
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            width:26, height:26, borderRadius:'7px', fontWeight:800, fontSize:'0.8rem',
                            background: isWorst?'rgba(231,76,60,0.12)': isBest?'rgba(46,204,113,0.12)':'var(--bg-hover)',
                            color: isWorst?'var(--danger)': isBest?'var(--primary-green)':'var(--text-muted)',
                          }}>{i+1}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight:700 }}>{row.name}</span>
                          {isWorst && <span style={{ marginLeft:'7px', fontSize:'0.67rem', background:'rgba(231,76,60,0.12)', color:'var(--danger)', padding:'2px 7px', borderRadius:'20px', fontWeight:700 }}>Most Waste</span>}
                          {isBest  && <span style={{ marginLeft:'7px', fontSize:'0.67rem', background:'rgba(46,204,113,0.12)', color:'var(--primary-green)', padding:'2px 7px', borderRadius:'20px', fontWeight:700 }}>Best</span>}
                        </td>
                        <td className="muted">{row.count}</td>
                        <td><span style={{ fontWeight:700, color:'#e74c3c' }}>{row.plate_waste.toFixed(1)}</span></td>
                        <td><span style={{ fontWeight:700, color:'#f39c12' }}>{row.kitchen_uncooked.toFixed(1)}</span></td>
                        <td><span style={{ fontWeight:700, color:'#6c5ce7' }}>{row.kitchen_cooked.toFixed(1)}</span></td>
                        <td><span style={{ fontWeight:800, fontSize:'0.95rem' }}>{row.total.toFixed(1)} kg</span></td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                            <div style={{ width:'56px', height:'6px', background:'var(--border-color)', borderRadius:'3px', overflow:'hidden' }}>
                              <div style={{ width:`${share}%`, height:'6px', borderRadius:'3px', background:'var(--danger)' }}/>
                            </div>
                            <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)' }}>{share}%</span>
                          </div>
                        </td>
                        <td className="muted" style={{ fontWeight:700 }}>{avgRep} kg</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop:'2px solid var(--border-color)', background:'var(--bg-hover)' }}>
                    <td colSpan={2} style={{ padding:'12px 20px', fontWeight:800, fontSize:'0.85rem' }}>TOTAL</td>
                    <td style={{ padding:'12px 20px', color:'var(--text-muted)', fontSize:'0.82rem', fontWeight:600 }}>{totals.count}</td>
                    <td style={{ padding:'12px 20px', fontWeight:800, color:'#e74c3c' }}>{totals.plate.toFixed(1)}</td>
                    <td style={{ padding:'12px 20px', fontWeight:800, color:'#f39c12' }}>{totals.unc.toFixed(1)}</td>
                    <td style={{ padding:'12px 20px', fontWeight:800, color:'#6c5ce7' }}>{totals.coo.toFixed(1)}</td>
                    <td style={{ padding:'12px 20px', fontWeight:800, fontSize:'1rem' }}>{totals.grand.toFixed(1)} kg</td>
                    <td style={{ padding:'12px 20px', fontWeight:700, color:'var(--text-muted)' }}>100%</td>
                    <td style={{ padding:'12px 20px', fontWeight:700, color:'var(--text-muted)' }}>{avgGrand} kg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        }
      </div>

    </div>
  );
};

export default OverviewView;