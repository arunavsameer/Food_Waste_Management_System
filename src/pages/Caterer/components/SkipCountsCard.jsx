import React, { useEffect, useMemo, useState } from 'react';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const seedFromString = (str = '') => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Deterministic PRNG so dummy data stays stable per mess.
// Replace this with a real API/Supabase query later.
const mulberry32 = (a) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeDummySkipCounts = (messName) => {
  const rnd = mulberry32(seedFromString(messName || 'default-mess'));
  const pick = () => clamp(Math.round(rnd() * 20), 0, 20);

  return {
    today: { Breakfast: pick(), Lunch: pick(), Dinner: pick() },
    tomorrow: { Breakfast: pick(), Lunch: pick(), Dinner: pick() }
  };
};

const VerticalRollNumber = ({ value, max = 20, ariaLabel }) => {
  const safe = clamp(Number(value) || 0, 0, max);
  const numbers = useMemo(() => Array.from({ length: max + 1 }, (_, i) => i), [max]);

  return (
    <div className="caterer-vrn-window" role="img" aria-label={ariaLabel || `Count: ${safe}`}>
      <div
        className="caterer-vrn-column"
        style={{ transform: `translateY(calc(-1 * var(--c-vrn-row-h) * ${safe}))` }}
      >
        {numbers.map((n) => (
          <div key={n} className="caterer-vrn-num">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

const SkipCountsCard = ({ messName }) => {
  const [skipCounts, setSkipCounts] = useState({
    today: { Breakfast: 0, Lunch: 0, Dinner: 0 },
    tomorrow: { Breakfast: 0, Lunch: 0, Dinner: 0 }
  });

  useEffect(() => {
    // Small delay so rollers animate from 0 -> value on mount.
    const id = setTimeout(() => setSkipCounts(makeDummySkipCounts(messName)), 150);
    return () => clearTimeout(id);
  }, [messName]);

  return (
    <div className="caterer-skip-card">
      <h4 style={{ margin: 0 }}>Students willing to skip</h4>
      <p className="caterer-skip-subtitle">Dummy counts (Today &amp; Tomorrow)</p>

      <div className="caterer-skip-grid">
        <div className="caterer-skip-col">
          <div className="caterer-skip-col-title">Today</div>
          {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
            <div key={`today-${meal}`} className="caterer-skip-row">
              <span className="caterer-skip-meal">{meal}</span>
              <VerticalRollNumber value={skipCounts.today[meal]} ariaLabel={`Today ${meal} skips`} />
            </div>
          ))}
        </div>

        <div className="caterer-skip-col">
          <div className="caterer-skip-col-title">Tomorrow</div>
          {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
            <div key={`tomorrow-${meal}`} className="caterer-skip-row">
              <span className="caterer-skip-meal">{meal}</span>
              <VerticalRollNumber value={skipCounts.tomorrow[meal]} ariaLabel={`Tomorrow ${meal} skips`} />
            </div>
          ))}
        </div>
      </div>

      <div className="caterer-skip-footnote">0–20 rolling counters</div>
    </div>
  );
};

export default SkipCountsCard;
