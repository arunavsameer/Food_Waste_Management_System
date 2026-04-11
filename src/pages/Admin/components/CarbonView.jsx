import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Leaf, TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────
const CO2_PER_KG_WASTE  = 2.5;   // kg CO2 per kg food waste (FAO/WRAP standard)
const KG_PER_TONNE      = 1000;
const CO2_PER_TREE_YR   = 21;    // kg CO2 absorbed per tree per year
const CO2_PER_CAR_YR    = 4600;  // kg CO2 emitted per car per year

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

// Summarise an array of waste_report rows → { totalWaste, mealCount, wastePerMeal }
const summarise = (rows) => {
  if (!rows.length) return { totalWaste: 0, mealCount: 0, wastePerMeal: 0 };
  const totalWaste = rows.reduce(
    (s, r) => s + Number(r.plate_waste||0) + Number(r.kitchen_uncooked||0) + Number(r.kitchen_cooked||0), 0
  );
  const mealCount = rows.length;
  return { totalWaste, mealCount, wastePerMeal: totalWaste / mealCount };
};

// ── Component ──────────────────────────────────────────────────────────────
const CarbonView = () => {
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [caterersList, setCaterersList] = useState([]);
  const [selectedId, setSelectedId]     = useState('all');
  const [thisMonthRows, setThisMonthRows] = useState([]);
  const [prevMonthRows, setPrevMonthRows] = useState([]);
  const [allCatRows, setAllCatRows]     = useState([]); // all caterers this month for baseline
  const [loading, setLoading]           = useState(false);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Fetch caterers once ────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('caterers').select('caterer_id, name').order('name')
      .then(({ data }) => { if (data) setCaterersList(data); });
  }, []);

  // ── Fetch waste data ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      const thisStart = toLocalISODate(new Date(year, month, 1));
      const thisEnd   = toLocalISODate(new Date(year, month + 1, 0));
      const prevStart = toLocalISODate(new Date(year, month - 1, 1));
      const prevEnd   = toLocalISODate(new Date(year, month, 0));

      const cols = 'plate_waste,kitchen_uncooked,kitchen_cooked,caterer_id';

      // This month — selected caterer (or all)
      let q = supabase.from('waste_reports').select(cols)
        .gte('report_date', thisStart).lte('report_date', thisEnd);
      if (selectedId !== 'all') q = q.eq('caterer_id', selectedId);
      const { data: t } = await q;

      // Prev month — same caterer
      let q2 = supabase.from('waste_reports').select(cols)
        .gte('report_date', prevStart).lte('report_date', prevEnd);
      if (selectedId !== 'all') q2 = q2.eq('caterer_id', selectedId);
      const { data: p } = await q2;

      // All caterers this month (for dynamic baseline)
      const { data: a } = await supabase.from('waste_reports').select(cols)
        .gte('report_date', thisStart).lte('report_date', thisEnd);

      if (!cancelled) {
        setThisMonthRows(t || []);
        setPrevMonthRows(p || []);
        setAllCatRows(a || []);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentDate, selectedId]);

  // ── Derived metrics ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const cur  = summarise(thisMonthRows);
    const prev = summarise(prevMonthRows);
    const base = summarise(allCatRows);   // dynamic baseline across all caterers

    // Month-over-month change in waste per meal (the honest metric)
    const momChange = prev.wastePerMeal > 0
      ? ((cur.wastePerMeal - prev.wastePerMeal) / prev.wastePerMeal) * 100
      : null;

    // Carbon generated this month
    const co2kg      = cur.totalWaste * CO2_PER_KG_WASTE;
    const co2tonnes  = co2kg / KG_PER_TONNE;
    const trees      = Math.round(co2kg / CO2_PER_TREE_YR);
    const cars       = (co2kg / CO2_PER_CAR_YR).toFixed(2);

    // Carbon credits: saving vs dynamic baseline (waste per meal)
    // Only award if performing BETTER than baseline
    const savedKgPerMeal = base.wastePerMeal - cur.wastePerMeal;
    const creditsTonnes  = savedKgPerMeal > 0
      ? Number(((savedKgPerMeal * cur.mealCount * CO2_PER_KG_WASTE) / KG_PER_TONNE).toFixed(3))
      : 0;

    return { cur, prev, momChange, co2kg, co2tonnes, trees, cars, creditsTonnes, baseline: base.wastePerMeal };
  }, [thisMonthRows, prevMonthRows, allCatRows]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const fmt1 = (n) => Number(n).toFixed(1);
  const fmt3 = (n) => Number(n).toFixed(3);

  const MomBadge = ({ pct }) => {
    if (pct === null) return <span style={styles.badge('#888')}>No prev data</span>;
    const improved = pct < 0;
    const same     = Math.abs(pct) < 0.5;
    if (same) return <span style={styles.badge('#888')}><Minus size={11}/> No change</span>;
    return (
      <span style={styles.badge(improved ? '#2ecc71' : '#e74c3c')}>
        {improved ? <TrendingDown size={11}/> : <TrendingUp size={11}/>}
        {' '}{Math.abs(pct).toFixed(1)}% {improved ? 'better' : 'worse'} vs last month
      </span>
    );
  };

  const { cur, momChange, co2kg, co2tonnes, trees, cars, creditsTonnes, baseline } = metrics;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '4px 0' }}>

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: 800 }}>
            Carbon Insights
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Based on waste-per-meal — comparisons are meaningful even with few entries
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Month picker */}
          <div style={styles.navRow}>
            <button style={styles.navBtn} onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</button>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', minWidth: 110, textAlign: 'center' }}>
              {monthNames[month]} {year}
            </span>
            <button style={styles.navBtn} onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</button>
          </div>

          {/* Caterer picker */}
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="header-select"
          >
            <option value="all">All Caterers</option>
            {caterersList.map(c => (
              <option key={c.caterer_id} value={c.caterer_id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} color="var(--primary-green)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : cur.mealCount === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No waste reports found for this period.
        </div>
      ) : (
        <>
          {/* ── Row 1: Core waste metric ─────────────────────────────── */}
          <div style={styles.card('var(--bg-card)')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={styles.label}>Waste per Meal</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>
                    {fmt1(cur.wastePerMeal)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>kg / meal</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <MomBadge pct={momChange} />
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={styles.label}>Reports this month</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{cur.mealCount}</div>
                <div style={styles.label}>Total waste</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmt1(cur.totalWaste)} kg</div>
              </div>
            </div>

            {/* Baseline bar */}
            {baseline > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Your avg vs all caterers baseline</span>
                  <span>Baseline: {fmt1(baseline)} kg/meal</span>
                </div>
                <div style={{ background: 'var(--border-color)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min((cur.wastePerMeal / (baseline * 1.5)) * 100, 100)}%`,
                    background: cur.wastePerMeal <= baseline ? '#2ecc71' : '#e74c3c',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: cur.wastePerMeal <= baseline ? '#2ecc71' : '#e74c3c', marginTop: 5, fontWeight: 600 }}>
                  {cur.wastePerMeal <= baseline
                    ? `✓ ${fmt1(baseline - cur.wastePerMeal)} kg/meal below baseline`
                    : `✗ ${fmt1(cur.wastePerMeal - baseline)} kg/meal above baseline`}
                </div>
              </div>
            )}
          </div>

          {/* ── Row 2: Carbon + Credits side by side ─────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>

            {/* CO2 generated */}
            <div style={styles.card('var(--bg-card)')}>
              <div style={styles.label}>CO₂ Generated</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#e67e22', lineHeight: 1, margin: '6px 0 2px' }}>
                {fmt1(co2kg)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>kg</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                = {fmt3(co2tonnes)} tonnes CO₂
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>🌳 {trees}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>trees needed<br/>to absorb</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>🚗 {cars}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>car-years<br/>equivalent</div>
                </div>
              </div>
            </div>

            {/* Carbon credits */}
            <div style={styles.card(creditsTonnes > 0 ? 'rgba(46,204,113,0.07)' : 'var(--bg-card)', creditsTonnes > 0 ? '1px solid rgba(46,204,113,0.3)' : '1px solid var(--border-color)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Leaf size={14} color={creditsTonnes > 0 ? '#2ecc71' : '#888'} />
                <span style={styles.label}>Carbon Credits Earned</span>
              </div>

              {creditsTonnes > 0 ? (
                <>
                  <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#2ecc71', lineHeight: 1, margin: '4px 0 2px' }}>
                    {fmt3(creditsTonnes)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                    tonnes CO₂ saved vs baseline
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#2ecc71', fontWeight: 600, lineHeight: 1.5 }}>
                    ✓ Performing better than the<br/>avg of all caterers this month
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--text-muted)', lineHeight: 1, margin: '4px 0 2px' }}>
                    0.000
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                    No credits — above the avg baseline.<br/>
                    Reduce by {fmt1(cur.wastePerMeal - baseline)} kg/meal to start earning.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Footer note ──────────────────────────────────────────── */}
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-input, rgba(0,0,0,0.03))', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong>Methodology:</strong> CO₂ = total waste × 2.5 (FAO/WRAP standard) &nbsp;·&nbsp;
            Credits earned only when waste/meal is below the dynamic average of all caterers this month &nbsp;·&nbsp;
            1 credit = 1 tonne CO₂ saved
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Style helpers ──────────────────────────────────────────────────────────
const styles = {
  card: (bg, border) => ({
    background: bg,
    border: border || '1px solid var(--border-color)',
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: 'var(--shadow)',
  }),
  label: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  badge: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 9px',
    borderRadius: 99,
    fontSize: '0.75rem',
    fontWeight: 700,
    background: color + '22',
    color: color,
  }),
  navRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '4px 8px',
  },
  navBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    color: 'var(--text-main)',
    padding: '0 4px',
    lineHeight: 1,
  },
};

export default CarbonView;