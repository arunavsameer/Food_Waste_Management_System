import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const seedFromString = (str = '') => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Deterministic PRNG (stable dummy data per mess + month).
// Replace this with real DB queries later.
const mulberry32 = (a) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const WasteHistoryView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const key = `${messName || 'default'}-${year}-${month}`;

  const wasteByDay = useMemo(() => {
    const rnd = mulberry32(seedFromString(key));
    const map = new Map();

    for (let day = 1; day <= daysInMonth; day++) {
      // 70% chance a day has a logged entry in the dummy history
      if (rnd() < 0.3) continue;

      const kitchen = clamp(Math.round(rnd() * 12 * 10) / 10, 0, 12); // 0.0..12.0
      const plate = clamp(Math.round(rnd() * 10 * 10) / 10, 0, 10);  // 0.0..10.0
      const total = Math.round((kitchen + plate) * 10) / 10;

      map.set(day, { kitchen, plate, total });
    }

    return map;
  }, [key, daysInMonth]);

  const thresholds = { lowMax: 6, medMax: 12 }; // kg (total)
  const statusForTotal = (total) => {
    if (total <= thresholds.lowMax) return 'low';
    if (total <= thresholds.medMax) return 'med';
    return 'high';
  };

  const stats = useMemo(() => {
    const entries = Array.from(wasteByDay.entries()).map(([day, v]) => ({ day, ...v }));
    if (entries.length === 0) return { avg: '0.0', max: null, loggedDays: 0 };

    const avg = entries.reduce((s, e) => s + e.total, 0) / entries.length;
    const max = entries.reduce((best, e) => (best == null || e.total > best.total ? e : best), null);
    return { avg: avg.toFixed(1), max, loggedDays: entries.length };
  }, [wasteByDay]);

  return (
    <div className="caterer-feedback-layout">
      <div className="caterer-feedback-main">
        <div className="caterer-feedback-header">
          <div className="caterer-nav-header">
            <button onClick={prevMonth} className="caterer-nav-arrow-btn" aria-label="Previous month">
              <ChevronLeft size={20} />
            </button>
            <span className="caterer-month-label">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="caterer-nav-arrow-btn" aria-label="Next month">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="caterer-waste-legend">
          <span className="w-dot low" /> Low
          <span className="w-dot med" style={{ marginLeft: 10 }} /> Medium
          <span className="w-dot high" style={{ marginLeft: 10 }} /> High
        </div>

        <div className="caterer-waste-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
            <div key={d} className="caterer-grid-header">
              {d}
            </div>
          ))}

          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="caterer-waste-cell empty" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const entry = wasteByDay.get(dayNum) || null;
            const statusClass = entry ? statusForTotal(entry.total) : 'neutral';

            return (
              <div key={dayNum} className={`caterer-waste-cell ${statusClass}`}>
                <div className="caterer-date-num">{dayNum}</div>
                {entry ? (
                  <>
                    <div className="caterer-waste-total">{entry.total} kg</div>
                    <div className="caterer-waste-split">
                      K {entry.kitchen} • P {entry.plate}
                    </div>
                  </>
                ) : (
                  <div className="caterer-waste-split" style={{ marginTop: 'auto', opacity: 0.35 }}>
                    -
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="caterer-feedback-side">
        <div className="card" style={{ textAlign: 'center' }}>
          <TrendingUp size={44} style={{ marginBottom: 10, color: 'var(--primary-green)' }} />
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.avg}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Avg waste (logged days)</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
            Logged days: <strong style={{ color: 'var(--text-main)' }}>{stats.loggedDays}</strong>
          </p>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Highest waste day</h4>
          {stats.max ? (
            <div className="caterer-max-waste">
              <div className="caterer-max-row">
                <span className="caterer-max-label">Day</span>
                <strong>{stats.max.day}</strong>
              </div>
              <div className="caterer-max-row">
                <span className="caterer-max-label">Total</span>
                <strong>{stats.max.total} kg</strong>
              </div>
              <div className="caterer-max-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <span className="caterer-max-label">Split</span>
                <strong>K {stats.max.kitchen} • P {stats.max.plate}</strong>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No history yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WasteHistoryView;
