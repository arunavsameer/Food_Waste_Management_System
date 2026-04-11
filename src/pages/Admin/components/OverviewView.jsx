import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, RefreshCw, Trash2, FileText, Star, Leaf,
  TrendingDown, TrendingUp, ChevronLeft, ChevronRight,
  UtensilsCrossed, BarChart3
} from 'lucide-react';

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const CO2_PER_KG_WASTE = 2.5;
const TIME_PRESETS = [
  { key: 'today',      label: 'Today'      },
  { key: 'week',       label: 'This Week'  },
  { key: 'month',      label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all',        label: 'All Time'   },
];

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtShort = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

function getDateRange(preset) {
  const now  = new Date();
  const sd   = new Date(now); sd.setHours(0, 0, 0, 0);
  let from, to, prevFrom, prevTo, label;

  switch (preset) {
    case 'today':
      from = sd; to = now; label = `Today, ${fmtDate(now)}`;
      prevFrom = new Date(sd); prevFrom.setDate(sd.getDate() - 1);
      prevTo   = new Date(sd); prevTo.setMilliseconds(-1);
      break;
    case 'week': {
      const mon = new Date(sd);
      mon.setDate(sd.getDate() - sd.getDay() + (sd.getDay() === 0 ? -6 : 1));
      from = mon; to = now;
      label = `${fmtShort(mon)} – ${fmtShort(now)}`;
      prevFrom = new Date(mon); prevFrom.setDate(mon.getDate() - 7);
      prevTo   = new Date(mon); prevTo.setMilliseconds(-1);
      break;
    }
    case 'month': {
      from = new Date(now.getFullYear(), now.getMonth(), 1); to = now;
      label = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevTo   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    }
    case 'last_month': {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      label = from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevTo   = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
      break;
    }
    default:
      from = null; to = null; label = 'All Time';
      prevFrom = null; prevTo = null;
  }
  return { from, to, prevFrom, prevTo, label };
}

/* ─────────────────────────────────────────────
   SMALL HELPERS
───────────────────────────────────────────── */
const Trend = ({ pct, inverse = false }) => {
  if (pct === null || isNaN(pct) || Math.abs(pct) < 0.5) {
    return <span style={trendStyle('#8899aa')}>— same</span>;
  }
  const good  = inverse ? pct < 0 : pct > 0;
  const color = good ? '#2ecc71' : '#e74c3c';
  const Icon  = pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span style={trendStyle(color)}>
      <Icon size={11} strokeWidth={3} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
};

const trendStyle = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 3,
  fontSize: '0.71rem', fontWeight: 700, color,
  background: color + '18', padding: '2px 7px', borderRadius: 99,
});

const MiniDivider = () => (
  <div style={{ height: 1, background: 'var(--border-color)', margin: '10px 0' }} />
);

/* ─────────────────────────────────────────────
   METRIC CARD
───────────────────────────────────────────── */
const MetricCard = ({ icon: Icon, accent, label, value, unit, trend, inverseTrend, sub1, sub2 }) => (
  <div style={cardStyle}>
    {/* Top row */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: accent + '18', color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <Trend pct={trend} inverse={inverseTrend} />
    </div>

    {/* Value */}
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>

    {/* Sub-stats */}
    {(sub1 || sub2) && (
      <>
        <MiniDivider />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {[sub1, sub2].filter(Boolean).map((s, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {s.label}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: s.color || 'var(--text-main)', marginTop: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
);

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 16,
  padding: '18px 20px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
  cursor: 'default',
  minWidth: 0,
};

/* ─────────────────────────────────────────────
   CARBON INSIGHT CARD (wider)
───────────────────────────────────────────── */
const CarbonCard = ({ co2kg, creditsTonnes, baseline, avgWaste, reportsCount }) => {
  const trees = Math.round(co2kg / 21);
  const hasCredits = creditsTonnes > 0;
  const aboveBaseline = baseline > 0 && avgWaste > baseline;
  const barPct = baseline > 0 ? Math.min((avgWaste / (baseline * 1.5)) * 100, 100) : 0;
  const barColor = avgWaste <= baseline ? '#2ecc71' : '#e74c3c';

  return (
    <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#2ecc7118', color: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Leaf size={18} strokeWidth={2.2} />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Carbon Insights
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
            Based on {reportsCount} waste {reportsCount === 1 ? 'entry' : 'entries'} this period
          </div>
        </div>
        {hasCredits && (
          <div style={{ marginLeft: 'auto', background: '#2ecc7118', border: '1px solid #2ecc7140', borderRadius: 99, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 800, color: '#2ecc71' }}>
            🌿 {creditsTonnes.toFixed(3)} credits earned
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* CO2 block */}
        <div style={{ flex: '1 1 120px', background: 'var(--bg-hover)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>CO₂ Generated</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e67e22', lineHeight: 1, marginTop: 4 }}>
            {co2kg.toFixed(1)} <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>kg</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🌳 {trees} trees/yr to offset</span>
          </div>
        </div>

        {/* Baseline bar block */}
        {baseline > 0 && (
          <div style={{ flex: '2 1 180px', background: 'var(--bg-hover)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Waste / Meal vs Baseline
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: barColor }}>
                {avgWaste.toFixed(2)} kg
              </span>
            </div>
            <div style={{ background: 'var(--border-color)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
              <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 99, background: barColor, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ fontSize: '0.71rem', marginTop: 5, fontWeight: 600, color: barColor }}>
              {avgWaste <= baseline
                ? `✓ ${(baseline - avgWaste).toFixed(2)} kg/meal below baseline`
                : `✗ ${(avgWaste - baseline).toFixed(2)} kg/meal above baseline`}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
              System baseline: {baseline.toFixed(2)} kg/meal (avg of all caterers)
            </div>
          </div>
        )}

        {/* Credits block */}
        <div style={{
          flex: '1 1 120px', borderRadius: 12, padding: '12px 14px',
          background: hasCredits ? '#2ecc7110' : 'var(--bg-hover)',
          border: hasCredits ? '1px solid #2ecc7130' : '1px solid transparent',
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Credits</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1, marginTop: 4, color: hasCredits ? '#2ecc71' : 'var(--text-muted)' }}>
            {creditsTonnes.toFixed(3)}
          </div>
          <div style={{ fontSize: '0.72rem', marginTop: 6, color: hasCredits ? '#2ecc71' : 'var(--text-muted)', fontWeight: 600 }}>
            {hasCredits ? 'tonnes CO₂ saved' : aboveBaseline ? 'reduce waste to earn' : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MESS SUMMARY ROW
───────────────────────────────────────────── */
const MessRow = ({ name, count, total, avgRating, isLast }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
    borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 9, background: 'var(--bg-hover)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <UtensilsCrossed size={14} color="var(--text-muted)" />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
        {count} {count === 1 ? 'entry' : 'entries'}
      </div>
    </div>
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#e74c3c' }}>{total.toFixed(1)} kg</div>
      {avgRating > 0 && (
        <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: 1 }}>
          ★ {avgRating.toFixed(1)}
        </div>
      )}
    </div>
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const OverviewView = () => {
  const [loading, setLoading]       = useState(true);
  const [allReports, setAllReports] = useState([]);
  const [allFeedback, setAllFeedback] = useState([]);
  const [caterers, setCaterers]     = useState([]);
  const [filterMess, setFilterMess] = useState('all');
  const [timePreset, setTimePreset] = useState('month');

  const dateRange = useMemo(() => getDateRange(timePreset), [timePreset]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: reports }, { data: feedbacks }, { data: cats }] = await Promise.all([
        supabase.from('waste_reports').select('report_date, meal_type, plate_waste, kitchen_uncooked, kitchen_cooked, caterers(name)'),
        supabase.from('feedback').select('date, rating, meal_type, caterers(name)'),
        supabase.from('caterers').select('caterer_id, name').order('name'),
      ]);
      setAllReports(reports || []);
      setAllFeedback(feedbacks || []);
      setCaterers(cats || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const inRange = (dateStr, from, to) => {
    if (!from) return true;
    const d = new Date(dateStr);
    return d >= from && d <= (to || new Date());
  };

  const filterItem = (item, dateField, from, to) =>
    inRange(item[dateField], from, to) &&
    (filterMess === 'all' || item.caterers?.name === filterMess);

  const { cur, prev, globalBaselineAvg, messSummary } = useMemo(() => {
    const curReps = allReports.filter(r => filterItem(r, 'report_date', dateRange.from, dateRange.to));
    const curFbs  = allFeedback.filter(f => filterItem(f, 'date', dateRange.from, dateRange.to));
    const prvReps = allReports.filter(r => filterItem(r, 'report_date', dateRange.prevFrom, dateRange.prevTo));
    const prvFbs  = allFeedback.filter(f => filterItem(f, 'date', dateRange.prevFrom, dateRange.prevTo));

    // Global baseline (all messes, current period) for carbon
    const globalReps = allReports.filter(r => inRange(r.report_date, dateRange.from, dateRange.to));
    const globalWaste = globalReps.reduce((s, r) => s + Number(r.plate_waste || 0) + Number(r.kitchen_uncooked || 0) + Number(r.kitchen_cooked || 0), 0);
    const globalBaselineAvg = globalReps.length > 0 ? globalWaste / globalReps.length : 0;

    const calc = (reps, fbs) => {
      const plate   = reps.reduce((s, r) => s + (Number(r.plate_waste) || 0), 0);
      const kitchen = reps.reduce((s, r) => s + (Number(r.kitchen_uncooked) || 0) + (Number(r.kitchen_cooked) || 0), 0);
      const total   = plate + kitchen;
      const avg     = reps.length > 0 ? total / reps.length : 0;
      const rating  = fbs.length > 0 ? fbs.reduce((s, f) => s + (Number(f.rating) || 0), 0) / fbs.length : 0;
      const co2     = total * CO2_PER_KG_WASTE;
      const savings = globalBaselineAvg - avg;
      const credits = savings > 0 ? (savings * reps.length * CO2_PER_KG_WASTE) / 1000 : 0;
      return { plate, kitchen, total, avg, reportsCount: reps.length, fbsCount: fbs.length, rating, co2, credits };
    };

    // Per-mess summary
    const messMap = {};
    curReps.forEach(r => {
      const n = r.caterers?.name || 'Unknown';
      if (!messMap[n]) messMap[n] = { name: n, count: 0, total: 0, ratings: [] };
      messMap[n].count++;
      messMap[n].total += (Number(r.plate_waste) || 0) + (Number(r.kitchen_uncooked) || 0) + (Number(r.kitchen_cooked) || 0);
    });
    curFbs.forEach(f => {
      const n = f.caterers?.name || 'Unknown';
      if (messMap[n]) messMap[n].ratings.push(Number(f.rating) || 0);
    });
    const messSummary = Object.values(messMap)
      .map(m => ({ ...m, avgRating: m.ratings.length ? m.ratings.reduce((s, v) => s + v, 0) / m.ratings.length : 0 }))
      .sort((a, b) => b.total - a.total);

    return { cur: calc(curReps, curFbs), prev: calc(prvReps, prvFbs), globalBaselineAvg, messSummary };
  }, [allReports, allFeedback, filterMess, dateRange]);

  const getTrend = (c, p) => p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;

  if (loading) return (
    <div className="admin-loading" style={{ height: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
      <Loader2 size={22} className="spin" /> Loading overview…
    </div>
  );

  const noData = cur.reportsCount === 0 && cur.fbsCount === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Overview
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {dateRange.label}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Time pill group */}
          <div style={{
            display: 'flex', gap: 3, background: 'var(--bg-hover)',
            borderRadius: 10, padding: 3, border: '1px solid var(--border-color)',
          }}>
            {TIME_PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setTimePreset(p.key)}
                style={{
                  padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
                  background: timePreset === p.key ? 'var(--bg-card)' : 'transparent',
                  color: timePreset === p.key ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: timePreset === p.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Mess select */}
          <select
            value={filterMess}
            onChange={e => setFilterMess(e.target.value)}
            className="admin-filter-select"
            style={{ fontSize: '0.78rem', fontWeight: 600, padding: '6px 32px 6px 10px' }}
          >
            <option value="all">All Messes</option>
            {caterers.map(c => <option key={c.caterer_id} value={c.name}>{c.name}</option>)}
          </select>

          <button className="icon-btn" onClick={fetchAll} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Metric Cards (2-col auto grid) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
      }}>

        {/* 1. Waste Reports */}
        <MetricCard
          icon={FileText}
          accent="#6c5ce7"
          label="Reports Filed"
          value={cur.reportsCount}
          unit="entries"
          trend={getTrend(cur.reportsCount, prev.reportsCount)}
          sub1={{ label: 'Avg waste/report', value: `${cur.avg.toFixed(1)} kg`, color: 'var(--text-main)' }}
          sub2={{ label: 'vs prev period', value: `${prev.reportsCount} entries`, color: 'var(--text-muted)' }}
        />

        {/* 2. Waste Breakdown */}
        <MetricCard
          icon={Trash2}
          accent="#e74c3c"
          label="Total Waste"
          value={cur.total.toFixed(1)}
          unit="kg"
          trend={getTrend(cur.total, prev.total)}
          inverseTrend
          sub1={{ label: 'Plate', value: `${cur.plate.toFixed(1)} kg`, color: '#e74c3c' }}
          sub2={{ label: 'Kitchen', value: `${cur.kitchen.toFixed(1)} kg`, color: '#f39c12' }}
        />

        {/* 3. Student Feedback */}
        <MetricCard
          icon={Star}
          accent="#f1c40f"
          label="Avg Rating"
          value={cur.fbsCount > 0 ? cur.rating.toFixed(1) : '—'}
          unit={cur.fbsCount > 0 ? '/ 10' : ''}
          trend={getTrend(cur.rating, prev.rating)}
          sub1={{ label: 'Reviews', value: `${cur.fbsCount}`, color: 'var(--text-main)' }}
          sub2={{
            label: 'Sentiment',
            value: cur.fbsCount === 0 ? 'No data' : cur.rating >= 7 ? '😊 Good' : cur.rating >= 5 ? '😐 Okay' : '😞 Poor',
            color: cur.rating >= 7 ? '#2ecc71' : cur.rating >= 5 ? '#f39c12' : '#e74c3c',
          }}
        />

        {/* 4. Carbon Summary */}
        <MetricCard
          icon={Leaf}
          accent="#2ecc71"
          label="CO₂ Generated"
          value={cur.co2.toFixed(1)}
          unit="kg"
          trend={getTrend(cur.co2, prev.co2)}
          inverseTrend
          sub1={{ label: 'Credits earned', value: cur.credits > 0 ? `${cur.credits.toFixed(3)} t` : '—', color: '#2ecc71' }}
          sub2={{ label: 'vs baseline', value: globalBaselineAvg > 0 ? (cur.avg <= globalBaselineAvg ? '✓ Below' : '✗ Above') : '—', color: globalBaselineAvg > 0 ? (cur.avg <= globalBaselineAvg ? '#2ecc71' : '#e74c3c') : 'var(--text-muted)' }}
        />
      </div>

      {/* ── Carbon Detail Card (spans 2 cols if space) ── */}
      {cur.reportsCount > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <CarbonCard
            co2kg={cur.co2}
            creditsTonnes={cur.credits}
            baseline={globalBaselineAvg}
            avgWaste={cur.avg}
            reportsCount={cur.reportsCount}
          />
        </div>
      )}

      {/* ── Bottom row: Mess summary + Feedback breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>

        {/* Mess-wise summary */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={15} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Mess Summary</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {messSummary.length} {messSummary.length === 1 ? 'mess' : 'messes'}
            </span>
          </div>
          <div style={{ padding: '4px 18px 10px' }}>
            {messSummary.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No data for this period
              </div>
            ) : (
              messSummary.slice(0, 6).map((m, i) => (
                <MessRow
                  key={m.name}
                  {...m}
                  isLast={i === Math.min(messSummary.length, 6) - 1}
                />
              ))
            )}
          </div>
        </div>

        {/* Feedback snapshot */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={15} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>Feedback Snapshot</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cur.fbsCount === 0 ? (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '16px 0' }}>
                No feedback for this period
              </div>
            ) : (
              <>
                {/* Rating gauge */}
                <div style={{ display: 'flex', align: 'center', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: `conic-gradient(${cur.rating >= 7 ? '#2ecc71' : cur.rating >= 5 ? '#f39c12' : '#e74c3c'} ${cur.rating * 36}deg, var(--border-color) 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 0 0 5px var(--bg-card)',
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {cur.rating.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {cur.rating >= 7 ? 'Students are satisfied' : cur.rating >= 5 ? 'Room for improvement' : 'Needs attention'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Based on {cur.fbsCount} reviews
                    </div>
                  </div>
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 5, borderRadius: 3,
                      background: i < Math.round(cur.rating) ? (cur.rating >= 7 ? '#2ecc71' : cur.rating >= 5 ? '#f39c12' : '#e74c3c') : 'var(--border-color)',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>

                {/* vs prev */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontWeight: 600 }}>vs previous period</span>
                  <Trend pct={getTrend(cur.rating, prev.rating)} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default OverviewView;