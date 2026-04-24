import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Trash2, RefreshCw, FileBarChart2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  LayoutList, BarChart2
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
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'week',       label: 'This Week' },
  { key: 'last_week',  label: 'Last Week' },
  { key: 'month',      label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all',        label: 'All Time' },
];
const RAW_PAGE_SIZE = 10;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const fmtLong    = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long',  year:'numeric' });
const fmtShort   = (d) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
const fmtFull    = (d) => new Date(d).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });

function getDateRange(preset) {
  const now = new Date();
  const tod = startOfDay(now);
  switch (preset) {
    case 'today':
      return {
        from: tod,
        to: endOfDay(now),
        prevFrom: startOfDay(new Date(tod.getFullYear(), tod.getMonth(), tod.getDate() - 1)),
        prevTo: endOfDay(new Date(tod.getFullYear(), tod.getMonth(), tod.getDate() - 1)),
        label: `Today — ${fmtLong(now)}`,
      };
    case 'yesterday': {
      const yest = new Date(tod); yest.setDate(tod.getDate()-1);
      const prev = new Date(yest); prev.setDate(yest.getDate()-1);
      return {
        from: startOfDay(yest),
        to: endOfDay(yest),
        prevFrom: startOfDay(prev),
        prevTo: endOfDay(prev),
        label: `Yesterday — ${fmtLong(yest)}`,
      };
    }
    case 'week': {
      const mon = new Date(tod);
      mon.setDate(tod.getDate() - tod.getDay() + (tod.getDay()===0?-6:1));
      const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
      const prevSun = new Date(mon); prevSun.setDate(mon.getDate() - 1);
      return {
        from: mon,
        to: endOfDay(now),
        prevFrom: startOfDay(prevMon),
        prevTo: endOfDay(prevSun),
        label: `This week (${fmtShort(mon)} – ${fmtShort(now)})`,
      };
    }
    case 'last_week': {
      const lm = new Date(tod);
      lm.setDate(tod.getDate() - tod.getDay() + (tod.getDay()===0?-6:1) - 7);
      const ls = new Date(lm); ls.setDate(lm.getDate()+6);
      const prevLm = new Date(lm); prevLm.setDate(lm.getDate() - 7);
      const prevLs = new Date(ls); prevLs.setDate(ls.getDate() - 7);
      return {
        from: startOfDay(lm),
        to: endOfDay(ls),
        prevFrom: startOfDay(prevLm),
        prevTo: endOfDay(prevLs),
        label: `Last week (${fmtShort(lm)} – ${fmtShort(ls)})`,
      };
    }
    case 'month': {
      const fm = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevFm = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const prevLme = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: fm,
        to: endOfDay(now),
        prevFrom: startOfDay(prevFm),
        prevTo: endOfDay(prevLme),
        label: now.toLocaleDateString('en-IN', { month:'long', year:'numeric' }),
      };
    }
    case 'last_month': {
      const lm  = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      const prevLm = new Date(now.getFullYear(), now.getMonth()-2, 1);
      const prevLme = new Date(now.getFullYear(), now.getMonth()-1, 0);
      return {
        from: startOfDay(lm),
        to: endOfDay(lme),
        prevFrom: startOfDay(prevLm),
        prevTo: endOfDay(prevLme),
        label: lm.toLocaleDateString('en-IN', { month:'long', year:'numeric' }),
      };
    }
    default:
      return { from: null, to: null, prevFrom: null, prevTo: null, label: 'All time' };
  }
}

function relativeDayLabel(dateStr) {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6) return d.toLocaleDateString('en-IN', { weekday:'short' });
  return fmtFull(d);
}

/* ─────────────────────────────────────────────
   MINI BAR — used in mess comparison
───────────────────────────────────────────── */
const MiniBar = ({ val, max, color, globalAvgPct }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
    {/* bar track */}
    <div style={{ flex:1, height:'8px', background:'var(--border-color)', borderRadius:'4px',
                  overflow:'visible', position:'relative', minWidth:'60px' }}>
      {/* filled bar */}
      <div style={{
        width: max > 0 ? `${Math.min(100,(val/max)*100)}%` : '0%',
        height:'8px', borderRadius:'4px', background:color,
        transition:'width 0.5s ease', position:'relative', zIndex:1,
      }}/>
      {/* global avg dashed line */}
      {globalAvgPct != null && (
        <div style={{
          position:'absolute', top:'-3px', bottom:'-3px',
          left:`${globalAvgPct}%`,
          width:'2px', background:'var(--text-muted)',
          borderRadius:'1px', opacity:0.55, zIndex:2,
          borderLeft:'2px dashed var(--text-muted)',
        }} title={`Global avg`}/>
      )}
    </div>
    <span style={{ fontWeight:700, fontSize:'0.8rem', color:'var(--text-main)', width:'44px', textAlign:'right' }}>
      {val.toFixed(1)}
    </span>
  </div>
);

const deltaPct = (current, previous) => {
  if (previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

const DeltaBadge = ({ value, inverse = false }) => {
  if (value == null || Number.isNaN(value)) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center',
        padding:'3px 8px', borderRadius:'999px',
        background:'var(--bg-hover)', color:'var(--text-muted)',
        fontSize:'0.7rem', fontWeight:700,
      }}>
        no baseline
      </span>
    );
  }

  const neutral = Math.abs(value) < 0.5;
  const improved = inverse ? value < 0 : value > 0;
  const color = neutral ? 'var(--text-muted)' : improved ? 'var(--primary-green)' : 'var(--danger)';
  const bg = neutral ? 'var(--bg-hover)' : improved ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)';
  const arrow = neutral ? '•' : value > 0 ? '↑' : '↓';

  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:'4px',
      padding:'3px 8px', borderRadius:'999px',
      background:bg, color,
      fontSize:'0.7rem', fontWeight:700,
    }}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const BreakdownDonut = ({ plate, unc, coo, size = 40, thickness = 9 }) => {
  const total = plate + unc + coo;
  const platePct = total > 0 ? (plate / total) * 100 : 0;
  const uncPct = total > 0 ? (unc / total) * 100 : 0;
  const cooPct = Math.max(0, 100 - platePct - uncPct);
  const donut = `conic-gradient(
    ${WASTE_CATS[0].color} 0% ${platePct}%,
    ${WASTE_CATS[1].color} ${platePct}% ${platePct + uncPct}%,
    ${WASTE_CATS[2].color} ${platePct + uncPct}% 100%
  )`;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:'150px' }}>
      <div
        title={`Plate ${plate.toFixed(1)} kg, Uncooked ${unc.toFixed(1)} kg, Cooked ${coo.toFixed(1)} kg`}
        style={{
          width:size,
          height:size,
          borderRadius:'50%',
          background: total > 0 ? donut : 'var(--bg-hover)',
          position:'relative',
          flexShrink:0,
          boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <div style={{
          position:'absolute',
          inset:thickness,
          borderRadius:'50%',
          background:'var(--bg-card)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          fontSize:'0.58rem',
          fontWeight:800,
          color:'var(--text-muted)',
        }}>
          {total > 0 ? `${Math.round(total)}` : '0'}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
        {[
          { label:'P', value:plate, color:WASTE_CATS[0].color },
          { label:'U', value:unc, color:WASTE_CATS[1].color },
          { label:'C', value:coo, color:WASTE_CATS[2].color },
        ].map(item => (
          <div key={item.label} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.65rem' }}>
            <span style={{ width:6, height:6, borderRadius:'999px', background:item.color, display:'inline-block' }} />
            <span style={{ color:'var(--text-muted)', minWidth:'10px' }}>{item.label}</span>
            <span style={{ color:'var(--text-main)', fontWeight:700 }}>{item.value.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BreakdownBars = ({ plate, unc, coo }) => {
  const total = plate + unc + coo;
  return (
    <div style={{ minWidth:'130px' }}>
      <div style={{ display:'flex', height:'10px', borderRadius:'5px', overflow:'hidden', gap:'1px', minWidth:'110px' }}>
        {WASTE_CATS.map(cat => {
          const v = cat.key === 'plate_waste' ? plate : cat.key === 'kitchen_uncooked' ? unc : coo;
          const p = total > 0 ? (v/total)*100 : 0;
          return p > 0 ? (
            <div key={cat.key} style={{ width:`${p}%`, background:cat.color }} title={`${cat.label}: ${v.toFixed(1)} kg`} />
          ) : null;
        })}
      </div>
      <div style={{ display:'flex', gap:'6px', marginTop:'3px' }}>
        {WASTE_CATS.map(cat => {
          const v = cat.key === 'plate_waste' ? plate : cat.key === 'kitchen_uncooked' ? unc : coo;
          const p = total > 0 ? (v/total)*100 : 0;
          return p > 5 ? (
            <span key={cat.key} style={{ fontSize:'0.62rem', color:cat.color, fontWeight:700 }}>
              {p.toFixed(0)}%
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   DAILY TREND CHART
───────────────────────────────────────────── */
const DailyTrend = ({ data }) => {
  if (!data.length) return (
    <div className="admin-empty" style={{ padding:'24px 0' }}>
      <p style={{ margin:0, fontSize:'0.85rem' }}>No trend data</p>
    </div>
  );
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const H = 120;
  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:'6px',
                    minWidth: data.length*44, padding:'4px 0 0', height: H+40 }}>
        {data.map((d, i) => {
          const barH   = Math.max(4, (d.total / maxVal) * H);
          const isMax  = d.total === maxVal;
          return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center',
                                  gap:'4px', flex:1, minWidth:'38px' }}>
              <span style={{
                fontSize:'0.65rem', fontWeight:700,
                color: isMax ? 'var(--danger)' : 'var(--text-muted)',
                opacity: isMax ? 1 : 0.7,
              }}>{d.total.toFixed(1)}</span>
              <div style={{ width:'100%', display:'flex', flexDirection:'column-reverse',
                            borderRadius:'5px', overflow:'hidden', height: barH }}>
                {WASTE_CATS.map(cat => {
                  const catH = d.total > 0 ? (d[cat.key]/d.total)*barH : 0;
                  return catH > 0 ? (
                    <div key={cat.key}
                      style={{ height:catH, background:cat.color, width:'100%' }}
                      title={`${cat.label}: ${d[cat.key].toFixed(1)} kg`}/>
                  ) : null;
                })}
              </div>
              <span style={{ fontSize:'0.62rem', color:'var(--text-muted)', textAlign:'center',
                             lineHeight:1.2, whiteSpace:'nowrap' }}>
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

  // filters
  const [timePreset,  setTimePreset]  = useState('month');
  const [filterMess,  setFilterMess]  = useState('all');
  const [filterMeal,  setFilterMeal]  = useState('all');

  // table state
  const [showRaw,     setShowRaw]     = useState(false);
  const [rawPage,     setRawPage]     = useState(1);
  const [sortKey,     setSortKey]     = useState('report_date');
  const [sortDir,     setSortDir]     = useState('desc');
  const [breakdownView, setBreakdownView] = useState('pie');

  // mess perf table sort
  const [messSortKey, setMessSortKey] = useState('avg');
  const [messSortDir, setMessSortDir] = useState('desc');

  const dateRange = useMemo(() => getDateRange(timePreset), [timePreset]);

  /* ── Fetch ── */
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

  /* ── Filtered ── */
  const filtered = useMemo(() => allReports.filter(r => {
    const d      = new Date(r.report_date);
    const inRange = !dateRange.from || (d >= dateRange.from && d <= (dateRange.to || new Date()));
    const messOk  = filterMess === 'all' || r.caterers?.name === filterMess;
    const mealOk  = filterMeal === 'all' || r.meal_type === filterMeal;
    return inRange && messOk && mealOk;
  }), [allReports, dateRange, filterMess, filterMeal]);

  const prevFiltered = useMemo(() => allReports.filter(r => {
    if (!dateRange.prevFrom) return false;
    const d       = new Date(r.report_date);
    const inRange = d >= dateRange.prevFrom && d <= (dateRange.prevTo || new Date());
    const messOk  = filterMess === 'all' || r.caterers?.name === filterMess;
    const mealOk  = filterMeal === 'all' || r.meal_type === filterMeal;
    return inRange && messOk && mealOk;
  }), [allReports, dateRange, filterMess, filterMeal]);

  /* ── Totals / global avg ── */
  const buildTotals = (rows) => {
    const plate = rows.reduce((s,r) => s+(Number(r.plate_waste)||0), 0);
    const unc   = rows.reduce((s,r) => s+(Number(r.kitchen_uncooked)||0), 0);
    const coo   = rows.reduce((s,r) => s+(Number(r.kitchen_cooked)||0), 0);
    const grand = plate + unc + coo;
    const count = rows.length;
    return { plate, unc, coo, grand, count, avgPerReport: count > 0 ? grand/count : 0 };
  };

  const totals = useMemo(() => buildTotals(filtered), [filtered]);
  const prevTotals = useMemo(() => buildTotals(prevFiltered), [prevFiltered]);

  /* ── Per-mess summary (avg-based) ── */
  const messSummary = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const n = r.caterers?.name || 'Unknown';
      if (!map[n]) map[n] = { name:n, plate_waste:0, kitchen_uncooked:0, kitchen_cooked:0, count:0 };
      map[n].plate_waste       += Number(r.plate_waste)||0;
      map[n].kitchen_uncooked  += Number(r.kitchen_uncooked)||0;
      map[n].kitchen_cooked    += Number(r.kitchen_cooked)||0;
      map[n].count++;
    });
    return Object.values(map).map(m => {
      const total = m.plate_waste + m.kitchen_uncooked + m.kitchen_cooked;
      const avg   = m.count > 0 ? total / m.count : 0;
      return {
        ...m,
        total,
        avg,
        avgPlate:    m.count > 0 ? m.plate_waste      / m.count : 0,
        avgUncooked: m.count > 0 ? m.kitchen_uncooked / m.count : 0,
        avgCooked:   m.count > 0 ? m.kitchen_cooked   / m.count : 0,
      };
    });
  }, [filtered]);

  // Mess comparison panel — always sorted by avg desc
  const messCompare = useMemo(
    () => [...messSummary].sort((a,b) => b.avg - a.avg),
    [messSummary]
  );
  const maxAvg = useMemo(() => Math.max(...messCompare.map(m => m.avg), 1), [messCompare]);
  // global avg as % of maxAvg bar scale
  const globalAvgPct = useMemo(
    () => maxAvg > 0 ? (totals.avgPerReport / maxAvg) * 100 : null,
    [totals.avgPerReport, maxAvg]
  );

  /* ── Mess Performance Table (sortable) ── */
  const messPerf = useMemo(() => {
    const rows = [...messSummary];
    rows.sort((a, b) => {
      const av = a[messSortKey] ?? 0;
      const bv = b[messSortKey] ?? 0;
      const cmp = typeof av === 'string'
        ? av.localeCompare(bv)
        : av < bv ? -1 : av > bv ? 1 : 0;
      return messSortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [messSummary, messSortKey, messSortDir]);

  const toggleMessSort = (key) => {
    if (messSortKey === key) setMessSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setMessSortKey(key); setMessSortDir('desc'); }
  };

  /* ── Raw reports (sorted + paginated) ── */
  const rawSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortKey === 'report_date') { av = new Date(a.report_date); bv = new Date(b.report_date); }
      else if (sortKey === 'mess')   { av = a.caterers?.name||''; bv = b.caterers?.name||''; }
      else if (sortKey === 'total')  {
        av = (Number(a.plate_waste)||0)+(Number(a.kitchen_uncooked)||0)+(Number(a.kitchen_cooked)||0);
        bv = (Number(b.plate_waste)||0)+(Number(b.kitchen_uncooked)||0)+(Number(b.kitchen_cooked)||0);
      }
      else { av = Number(a[sortKey])||0; bv = Number(b[sortKey])||0; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalRawPages = Math.max(1, Math.ceil(rawSorted.length / RAW_PAGE_SIZE));
  const rawPageSafe   = Math.min(rawPage, totalRawPages);
  const rawSlice      = rawSorted.slice((rawPageSafe-1)*RAW_PAGE_SIZE, rawPageSafe*RAW_PAGE_SIZE);

  const toggleSort = (key) => {
    setRawPage(1);
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  /* ── Per-meal summary ── */
  const mealSummary = useMemo(() => ['breakfast','lunch','dinner'].map(mt => {
    const rows = filtered.filter(r => r.meal_type === mt);
    const p = rows.reduce((s,r) => s+(Number(r.plate_waste)||0), 0);
    const u = rows.reduce((s,r) => s+(Number(r.kitchen_uncooked)||0), 0);
    const c = rows.reduce((s,r) => s+(Number(r.kitchen_cooked)||0), 0);
    return { label:mt, plate:p, unc:u, coo:c, total:p+u+c, count:rows.length };
  }), [filtered]);

  const periodComparison = useMemo(() => ({
    avgDelta: deltaPct(totals.avgPerReport, prevTotals.avgPerReport),
    totalDelta: deltaPct(totals.grand, prevTotals.grand),
    countDelta: deltaPct(totals.count, prevTotals.count),
  }), [totals, prevTotals]);

  const messMealComparison = useMemo(() => {
    if (filterMeal !== 'all') return [];

    const byMess = {};
    filtered.forEach(r => {
      const mess = r.caterers?.name || 'Unknown';
      const meal = r.meal_type || 'unknown';
      const total = (Number(r.plate_waste)||0) + (Number(r.kitchen_uncooked)||0) + (Number(r.kitchen_cooked)||0);

      if (!byMess[mess]) byMess[mess] = { name: mess, meals: {}, total: 0, count: 0 };
      if (!byMess[mess].meals[meal]) byMess[mess].meals[meal] = { meal, total: 0, count: 0 };

      byMess[mess].meals[meal].total += total;
      byMess[mess].meals[meal].count += 1;
      byMess[mess].total += total;
      byMess[mess].count += 1;
    });

    return Object.values(byMess)
      .map(m => {
        const meals = Object.values(m.meals)
          .map(x => ({ ...x, avg: x.count > 0 ? x.total / x.count : 0 }))
          .sort((a,b) => a.avg - b.avg);
        if (meals.length === 0) return null;

        const best = meals[0];
        const worst = meals[meals.length - 1];
        return {
          name: m.name,
          best,
          worst,
          messAvg: m.count > 0 ? m.total / m.count : 0,
          spread: worst.avg - best.avg,
        };
      })
      .filter(Boolean)
      .sort((a,b) => b.spread - a.spread);
  }, [filtered, filterMeal]);

  /* ── Daily trend (last 14 days) ── */
  const dailyTrend = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const k = r.report_date.slice(0,10);
      if (!map[k]) map[k] = { date:k, plate_waste:0, kitchen_uncooked:0, kitchen_cooked:0 };
      map[k].plate_waste       += Number(r.plate_waste)||0;
      map[k].kitchen_uncooked  += Number(r.kitchen_uncooked)||0;
      map[k].kitchen_cooked    += Number(r.kitchen_cooked)||0;
    });
    return Object.values(map)
      .map(d => ({ ...d, total: d.plate_waste+d.kitchen_uncooked+d.kitchen_cooked, label: relativeDayLabel(d.date) }))
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [filtered]);

  /* ── Helpers ── */
  const SortIcon = ({ k, dir, active }) => {
    if (!active) return <ChevronDown size={12} style={{ opacity:0.3 }}/>;
    return dir === 'asc'
      ? <ChevronUp   size={12} color="var(--primary-green)"/>
      : <ChevronDown size={12} color="var(--primary-green)"/>;
  };

  const thBtn = (key, label, sortState, toggle) => (
    <th style={{ cursor:'pointer', userSelect:'none' }} onClick={() => toggle(key)}>
      <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        {label}
        <SortIcon k={key} active={sortState.key === key} dir={sortState.dir}/>
      </span>
    </th>
  );

  const vsGlobal = (avg) => {
    if (totals.count === 0) return null;
    const diff = avg - totals.avgPerReport;
    const pct  = totals.avgPerReport > 0 ? (diff / totals.avgPerReport) * 100 : 0;
    return { diff, pct };
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="admin-loading" style={{ height:'40vh' }}>
      <Loader2 size={24} className="spin"/> Loading waste reports…
    </div>
  );

  const isFiltered = filterMess !== 'all' || filterMeal !== 'all' || timePreset !== 'month';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* ══ FILTER BAR ══ */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    flexWrap:'wrap', gap:'10px' }}>
        {/* Time presets */}
        <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10,
                      padding:3, border:'1px solid var(--border-color)' }}>
          {TIME_PRESETS.map(p => (
            <button key={p.key} onClick={() => setTimePreset(p.key)} style={{
              padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
              fontSize:'0.75rem', fontWeight:700, transition:'all 0.15s', whiteSpace:'nowrap',
              background: timePreset===p.key ? 'var(--bg-card)' : 'transparent',
              color:      timePreset===p.key ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow:  timePreset===p.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>{p.label}</button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          {/* Mess filter */}
          <select value={filterMess} onChange={e => setFilterMess(e.target.value)}
            className="admin-filter-select"
            style={{
              fontSize:'0.78rem', fontWeight:600, padding:'6px 32px 6px 10px',
              border:`1px solid ${filterMess!=='all'?'var(--primary-green)':'var(--border-color)'}`,
              background: filterMess!=='all' ? 'rgba(46,204,113,0.07)' : 'var(--bg-input)',
            }}>
            <option value="all">All Messes</option>
            {caterers.map(c => <option key={c.caterer_id} value={c.name}>{c.name}</option>)}
          </select>

          {/* Meal filter */}
          <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10,
                        padding:3, border:'1px solid var(--border-color)' }}>
            {MEAL_TYPES.map(m => (
              <button key={m} onClick={() => setFilterMeal(m)} style={{
                padding:'5px 10px', borderRadius:7, border:'none', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700, textTransform:'capitalize',
                transition:'all 0.15s', whiteSpace:'nowrap',
                background: filterMeal===m ? 'var(--bg-card)' : 'transparent',
                color:      filterMeal===m ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow:  filterMeal===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{m==='all'?'All Meals':m}</button>
            ))}
          </div>

          <button className="icon-btn" onClick={fetchReports} title="Refresh">
            <RefreshCw size={14} className={loading?'spin':''}/>
          </button>

          {isFiltered && (
            <button onClick={() => { setFilterMess('all'); setFilterMeal('all'); setTimePreset('month'); }} style={{
              padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-color)',
              background:'transparent', color:'var(--danger)', fontSize:'0.75rem',
              fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            }}>✕ Reset</button>
          )}
        </div>
      </div>

      {/* ══ CONTEXT BAR ══ */}
      <div style={{
        display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap',
        padding:'10px 16px', borderRadius:'10px',
        background:'var(--bg-hover)', border:'1px solid var(--border-color)',
        fontSize:'0.82rem',
      }}>
        <span style={{ fontWeight:700, color:'var(--text-main)' }}>
          {dateRange.label}
        </span>
        {filterMess !== 'all' && (
          <span style={{ color:'var(--primary-green)', fontWeight:600 }}>· {filterMess}</span>
        )}
        {filterMeal !== 'all' && (
          <span style={{ color:'var(--primary-blue)', fontWeight:600, textTransform:'capitalize' }}>· {filterMeal}</span>
        )}
        <span style={{
          marginLeft:'auto', color:'var(--text-muted)', fontWeight:600,
          borderLeft:'1px solid var(--border-color)', paddingLeft:'16px',
        }}>
          <strong style={{ color:'var(--text-main)' }}>{totals.count}</strong> report{totals.count!==1?'s':''}
          {totals.count > 0 && (
            <>
              {' '}·{' '}
              avg{' '}
              <strong style={{ color:'var(--text-main)' }}>
                {totals.avgPerReport.toFixed(1)} kg
              </strong>
              /report
            </>
          )}
          {totals.count > 0 && (
            <>
              {' '}·{' '}
              total{' '}
              <strong style={{ color:'var(--danger)' }}>
                {totals.grand.toFixed(1)} kg
              </strong>
            </>
          )}
        </span>
      </div>

      {/* ══ INSIGHTS ROW: Mess Comparison + Meal Summary ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

        {/* Mess Comparison — avg/report bars */}
        <div className="chart-card">
          <h3 style={{ margin:'0 0 2px', fontSize:'1rem', fontWeight:800 }}>Mess Comparison</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Avg waste per report · {dateRange.label} · global avg {totals.avgPerReport.toFixed(1)} kg
          </p>

          {messCompare.length === 0
            ? <div className="admin-empty" style={{ padding:'20px 0' }}>
                <p style={{ margin:0, fontSize:'0.85rem' }}>No data</p>
              </div>
            : (
              <div style={{ overflowX:'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mess</th>
                      <th>Reports</th>
                      <th>Total</th>
                      <th>Avg / report</th>
                      <th>vs Global</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messCompare.map((m, i) => {
                      const diff = m.avg - totals.avgPerReport;
                      const pct = totals.avgPerReport > 0 ? (diff / totals.avgPerReport) * 100 : 0;
                      const tone = diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--primary-green)' : 'var(--text-muted)';
                      return (
                        <tr key={m.name}>
                          <td className="muted">{i + 1}</td>
                          <td style={{ fontWeight:700 }}>{m.name}</td>
                          <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.count}</td>
                          <td style={{ fontWeight:700 }}>{m.total.toFixed(1)} kg</td>
                          <td style={{ fontWeight:800, color:'var(--text-main)' }}>{m.avg.toFixed(1)} kg</td>
                          <td style={{ fontWeight:700, color:tone }}>
                            {diff === 0 ? 'same' : `${diff > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        {/* Waste by Meal Type */}
        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Waste by Meal Type</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Breakdown per meal · {dateRange.label}
          </p>
          <div style={{ overflowX:'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Reports</th>
                  <th style={{ color:'#e74c3c' }}>Plate</th>
                  <th style={{ color:'#f39c12' }}>Uncooked</th>
                  <th style={{ color:'#6c5ce7' }}>Cooked</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {mealSummary.map(m => (
                  <tr key={m.label}>
                    <td style={{ fontWeight:700, textTransform:'capitalize' }}>{m.label}</td>
                    <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.count}</td>
                    <td style={{ fontWeight:700, color:'#e74c3c' }}>{m.plate.toFixed(1)} kg</td>
                    <td style={{ fontWeight:700, color:'#f39c12' }}>{m.unc.toFixed(1)} kg</td>
                    <td style={{ fontWeight:700, color:'#6c5ce7' }}>{m.coo.toFixed(1)} kg</td>
                    <td style={{ fontWeight:800, color:'var(--text-main)' }}>{m.total.toFixed(1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══ COMPARISON CARDS: compact + optional ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'20px' }}>
        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Current vs Previous Window</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Same active filters, compared against the previous matching time window
          </p>

          {dateRange.prevFrom ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:'12px' }}>
              <div style={{ padding:'14px', borderRadius:'12px', background:'var(--bg-hover)', border:'1px solid var(--border-color)' }}>
                <div style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', fontWeight:700 }}>
                  Avg / report
                </div>
                <div style={{ marginTop:'6px', fontSize:'1.25rem', fontWeight:800, color:'var(--text-main)' }}>
                  {totals.avgPerReport.toFixed(1)} <span style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>kg</span>
                </div>
                <div style={{ marginTop:'8px' }}>
                  <DeltaBadge value={periodComparison.avgDelta} inverse />
                </div>
              </div>

              <div style={{ padding:'14px', borderRadius:'12px', background:'var(--bg-hover)', border:'1px solid var(--border-color)' }}>
                <div style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', fontWeight:700 }}>
                  Total waste
                </div>
                <div style={{ marginTop:'6px', fontSize:'1.25rem', fontWeight:800, color:'var(--danger)' }}>
                  {totals.grand.toFixed(1)} <span style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>kg</span>
                </div>
                <div style={{ marginTop:'8px' }}>
                  <DeltaBadge value={periodComparison.totalDelta} inverse />
                </div>
              </div>

              <div style={{ padding:'14px', borderRadius:'12px', background:'var(--bg-hover)', border:'1px solid var(--border-color)' }}>
                <div style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.4px', color:'var(--text-muted)', fontWeight:700 }}>
                  Reports
                </div>
                <div style={{ marginTop:'6px', fontSize:'1.25rem', fontWeight:800, color:'var(--text-main)' }}>
                  {totals.count}
                </div>
                <div style={{ marginTop:'8px' }}>
                  <DeltaBadge value={periodComparison.countDelta} />
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-empty" style={{ padding:'18px 0' }}>
              <p style={{ margin:0, fontSize:'0.83rem' }}>No previous comparison window for this preset</p>
            </div>
          )}
        </div>

        <div className="chart-card">
          <h3 style={{ margin:'0 0 4px', fontSize:'1rem', fontWeight:800 }}>Meal Efficiency by Mess</h3>
          <p style={{ margin:'0 0 16px', fontSize:'0.74rem', color:'var(--text-muted)' }}>
            Best and worst meal per mess, ranked by improvement opportunity
          </p>

          {filterMeal !== 'all' ? (
            <div className="admin-empty" style={{ padding:'18px 0' }}>
              <p style={{ margin:0, fontSize:'0.83rem' }}>Clear the meal filter to compare each mess&apos;s strongest and weakest meal</p>
            </div>
          ) : messMealComparison.length === 0 ? (
            <div className="admin-empty" style={{ padding:'18px 0' }}>
              <p style={{ margin:0, fontSize:'0.83rem' }}>No meal comparison data for this period</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {messMealComparison.map((mess, index) => (
                <div key={mess.name} style={{
                  display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'12px', alignItems:'center',
                  padding:'12px 14px', borderRadius:'12px',
                  background:index === 0 ? 'rgba(52, 152, 219, 0.08)' : 'var(--bg-hover)',
                  border:'1px solid var(--border-color)',
                }}>
                  <div style={{
                    width:24, height:24, borderRadius:'7px',
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    background:'var(--bg-card)', color:'var(--text-muted)',
                    fontSize:'0.72rem', fontWeight:800,
                  }}>
                    {index + 1}
                  </div>

                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--text-main)' }}>{mess.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'5px' }}>
                      <span className={`meal-pill ${mess.best.meal}`} style={{ fontSize:'0.72rem' }}>
                        {mess.best.meal}
                      </span>
                      <span style={{ fontSize:'0.74rem', color:'var(--primary-green)', fontWeight:700 }}>
                        best {mess.best.avg.toFixed(1)} kg
                      </span>
                      {mess.best.meal !== mess.worst.meal && (
                        <>
                          <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>vs</span>
                          <span className={`meal-pill ${mess.worst.meal}`} style={{ fontSize:'0.72rem', opacity:0.85 }}>
                            {mess.worst.meal}
                          </span>
                          <span style={{ fontSize:'0.74rem', color:'var(--danger)', fontWeight:700 }}>
                            {mess.worst.avg.toFixed(1)} kg
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700 }}>
                      gap
                    </div>
                    <div style={{ fontSize:'0.98rem', fontWeight:800, color:mess.spread > 0 ? 'var(--primary-blue)' : 'var(--text-muted)' }}>
                      {mess.spread.toFixed(1)} kg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {/* ══ MESS PERFORMANCE TABLE ══ */}
      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <div>
            <h3 style={{ margin:0 }}>Mess Performance Summary</h3>
            <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
              One row per mess · averages across {totals.count} report{totals.count!==1?'s':''} · {dateRange.label}
              {filterMess !== 'all' && ` · ${filterMess}`}
              {filterMeal !== 'all' && ` · ${filterMeal} only`}
            </p>
          </div>
        </div>

        {messPerf.length === 0 ? (
          <div className="admin-empty">
            <BarChart2 size={48} className="admin-empty-icon"/>
            <p style={{ margin:0, fontWeight:600 }}>No data for this period</p>
            <p style={{ margin:0, fontSize:'0.83rem' }}>Try adjusting the time range or filters</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  {thBtn('name',       'Mess',           { key:messSortKey, dir:messSortDir }, toggleMessSort)}
                  {thBtn('count',      'Reports',        { key:messSortKey, dir:messSortDir }, toggleMessSort)}
                  {thBtn('avg',        'Avg / Report',   { key:messSortKey, dir:messSortDir }, toggleMessSort)}
                  {thBtn('avgPlate',   <span style={{ color:'#e74c3c' }}>Plate avg</span>,    { key:messSortKey, dir:messSortDir }, toggleMessSort)}
                  {thBtn('avgUncooked',<span style={{ color:'#f39c12' }}>Uncooked avg</span>, { key:messSortKey, dir:messSortDir }, toggleMessSort)}
                  {thBtn('avgCooked',  <span style={{ color:'#6c5ce7' }}>Cooked avg</span>,   { key:messSortKey, dir:messSortDir }, toggleMessSort)}
                  <th>vs. Global Avg</th>
                </tr>
              </thead>
              <tbody>
                {messPerf.map((m, i) => {
                  const vs = vsGlobal(m.avg);
                  const above = vs && vs.diff > 0;
                  return (
                    <tr key={m.name}>
                      <td style={{ fontWeight:700 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            width:20, height:20, borderRadius:'5px', fontWeight:800, fontSize:'0.7rem',
                            background:'var(--bg-hover)', color:'var(--text-muted)',
                          }}>{i+1}</span>
                          {m.name}
                        </div>
                      </td>
                      <td style={{ color:'var(--text-muted)', fontWeight:600 }}>{m.count}</td>
                      <td>
                        <span style={{ fontWeight:800, fontSize:'0.92rem',
                                       color: m.avg > totals.avgPerReport*1.2 ? 'var(--danger)'
                                            : m.avg < totals.avgPerReport*0.8 ? 'var(--primary-green)'
                                            : 'var(--text-main)' }}>
                          {m.avg.toFixed(1)} kg
                        </span>
                      </td>
                      <td><span style={{ fontWeight:700, color:'#e74c3c' }}>{m.avgPlate.toFixed(1)}</span></td>
                      <td><span style={{ fontWeight:700, color:'#f39c12' }}>{m.avgUncooked.toFixed(1)}</span></td>
                      <td><span style={{ fontWeight:700, color:'#6c5ce7' }}>{m.avgCooked.toFixed(1)}</span></td>
                      <td>
                        {vs ? (
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:'4px',
                            padding:'3px 8px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:700,
                            background: above ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
                            color:      above ? 'var(--danger)' : 'var(--primary-green)',
                          }}>
                            {above ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            {Math.abs(vs.pct).toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Global avg footer */}
              {totals.count > 0 && (
                <tfoot>
                  <tr style={{ borderTop:'2px solid var(--border-color)', background:'var(--bg-hover)' }}>
                    <td colSpan={2} style={{ padding:'10px 20px', fontWeight:800, fontSize:'0.82rem', color:'var(--text-muted)' }}>
                      Global avg ({totals.count} reports)
                    </td>
                    <td style={{ padding:'10px 20px', fontWeight:800 }}>
                      {totals.avgPerReport.toFixed(1)} kg
                    </td>
                    <td style={{ padding:'10px 20px', fontWeight:700, color:'#e74c3c' }}>
                      {totals.count > 0 ? (totals.plate/totals.count).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding:'10px 20px', fontWeight:700, color:'#f39c12' }}>
                      {totals.count > 0 ? (totals.unc/totals.count).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding:'10px 20px', fontWeight:700, color:'#6c5ce7' }}>
                      {totals.count > 0 ? (totals.coo/totals.count).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding:'10px 20px', fontSize:'0.75rem', color:'var(--text-muted)' }}>baseline</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ══ TOGGLE: View Individual Reports ══ */}
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
          {showRaw ? 'Hide' : 'View'} Individual Reports
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
                <h3 style={{ margin:0 }}>Individual Reports</h3>
                <p style={{ margin:'4px 0 0', fontSize:'0.74rem', color:'var(--text-muted)' }}>
                  {filtered.length} records · page {rawPageSafe} of {totalRawPages}
                  {' '}· sorted by date desc · click headers to re-sort
                </p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ display:'flex', gap:3, background:'var(--bg-hover)', borderRadius:10, padding:3, border:'1px solid var(--border-color)' }}>
                  {[
                    { key:'pie', label:'Pie' },
                    { key:'bar', label:'Bar' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setBreakdownView(opt.key)}
                      style={{
                        padding:'5px 10px',
                        borderRadius:7,
                        border:'none',
                        cursor:'pointer',
                        fontSize:'0.72rem',
                        fontWeight:700,
                        background: breakdownView === opt.key ? 'var(--bg-card)' : 'transparent',
                        color: breakdownView === opt.key ? 'var(--text-main)' : 'var(--text-muted)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* Pagination controls */}
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <button
                  disabled={rawPageSafe <= 1}
                  onClick={() => setRawPage(p => Math.max(1, p-1))}
                  className="icon-btn"
                  style={{ opacity: rawPageSafe <= 1 ? 0.35 : 1 }}>
                  <ChevronLeft size={14}/>
                </button>
                {Array.from({ length: totalRawPages }, (_, i) => i+1)
                  .filter(p => Math.abs(p - rawPageSafe) <= 2)
                  .map(p => (
                    <button key={p} onClick={() => setRawPage(p)} style={{
                      width:28, height:28, borderRadius:7, border:'1px solid var(--border-color)',
                      background: p === rawPageSafe ? 'var(--primary-green)' : 'transparent',
                      color:      p === rawPageSafe ? '#fff' : 'var(--text-muted)',
                      fontWeight:700, fontSize:'0.75rem', cursor:'pointer',
                    }}>{p}</button>
                  ))
                }
                <button
                  disabled={rawPageSafe >= totalRawPages}
                  onClick={() => setRawPage(p => Math.min(totalRawPages, p+1))}
                  className="icon-btn"
                  style={{ opacity: rawPageSafe >= totalRawPages ? 0.35 : 1 }}>
                  <ChevronRight size={14}/>
                </button>
                </div>
              </div>
            </div>

            {rawSlice.length === 0 ? (
              <div className="admin-empty">
                <FileBarChart2 size={48} className="admin-empty-icon"/>
                <p style={{ margin:0, fontWeight:600 }}>No reports found</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {thBtn('report_date',      'Date',               { key:sortKey, dir:sortDir }, toggleSort)}
                      {thBtn('mess',             'Mess',               { key:sortKey, dir:sortDir }, toggleSort)}
                      <th>Meal</th>
                      {thBtn('plate_waste',      <span style={{ color:'#e74c3c' }}>Plate (kg)</span>,    { key:sortKey, dir:sortDir }, toggleSort)}
                      {thBtn('kitchen_uncooked', <span style={{ color:'#f39c12' }}>Uncooked (kg)</span>, { key:sortKey, dir:sortDir }, toggleSort)}
                      {thBtn('kitchen_cooked',   <span style={{ color:'#6c5ce7' }}>Cooked (kg)</span>,   { key:sortKey, dir:sortDir }, toggleSort)}
                      {thBtn('total',            'Total',              { key:sortKey, dir:sortDir }, toggleSort)}
                      <th>Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawSlice.map((r, i) => {
                      const plate = Number(r.plate_waste)||0;
                      const unc   = Number(r.kitchen_uncooked)||0;
                      const coo   = Number(r.kitchen_cooked)||0;
                      const total = plate + unc + coo;
                      const dayLabel = relativeDayLabel(r.report_date);
                      const isToday  = dayLabel === 'Today';
                      const isYest   = dayLabel === 'Yesterday';
                      const rowNum   = (rawPageSafe-1)*RAW_PAGE_SIZE + i + 1;
                      return (
                        <tr key={r.report_id}>
                          <td className="muted">{rowNum}</td>
                          <td>
                            <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                              <span style={{
                                fontSize:'0.8rem', fontWeight:700,
                                color: isToday ? 'var(--primary-green)' : isYest ? 'var(--primary-blue)' : 'var(--text-main)',
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
                              color: total>20 ? 'var(--danger)' : total>10 ? 'var(--warning)' : 'var(--text-main)',
                            }}>{total.toFixed(1)} kg</span>
                          </td>
                          <td style={{ minWidth:'150px' }}>
                            {breakdownView === 'pie'
                              ? <BreakdownDonut plate={plate} unc={unc} coo={coo} />
                              : <BreakdownBars plate={plate} unc={unc} coo={coo} />
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom pagination */}
            {totalRawPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
                            gap:'6px', padding:'14px', borderTop:'1px solid var(--border-color)' }}>
                <button
                  disabled={rawPageSafe <= 1}
                  onClick={() => setRawPage(p => Math.max(1, p-1))}
                  className="icon-btn" style={{ opacity: rawPageSafe <= 1 ? 0.35 : 1 }}>
                  <ChevronLeft size={14}/>
                </button>
                <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:600 }}>
                  {rawPageSafe} / {totalRawPages}
                  {' '}({filtered.length} records)
                </span>
                <button
                  disabled={rawPageSafe >= totalRawPages}
                  onClick={() => setRawPage(p => Math.min(totalRawPages, p+1))}
                  className="icon-btn" style={{ opacity: rawPageSafe >= totalRawPages ? 0.35 : 1 }}>
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

export default WasteReportsView;
