import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, RotateCw } from 'lucide-react';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// --- VERTICAL ROLLING COMPONENT ---
const VerticalRollNumber = ({ value, max = 500, ariaLabel }) => {
  const safe = clamp(Number(value) || 0, 0, max);
  const numbers = useMemo(() => Array.from({ length: Math.max(safe + 1, 10) }, (_, i) => i), [safe]);

  return (
    <div className="caterer-vrn-window" role="img" aria-label={ariaLabel || `Count: ${safe}`}>
      <div
        className="caterer-vrn-column"
        style={{ transform: `translateY(calc(-1 * 32px * ${safe}))` }} 
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

// --- MAIN CARD COMPONENT ---
const SkipCountsCard = ({ messName }) => {
  const [skipCounts, setSkipCounts] = useState({
    today: { breakfast: 0, lunch: 0, dinner: 0 },
    tomorrow: { breakfast: 0, lunch: 0, dinner: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRealSkipCounts = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('caterer_id', user.id);

      const studentIds = students?.map(s => s.id) || [];

      if (studentIds.length > 0) {
        const { data: skips, error } = await supabase
          .from('skip_table')
          .select('date, menu_type')
          .in('student_id', studentIds)
          .gte('date', todayStr)
          .lte('date', tomorrowStr);

        if (error) throw error;

        const newCounts = {
          today: { breakfast: 0, lunch: 0, dinner: 0 },
          tomorrow: { breakfast: 0, lunch: 0, dinner: 0 }
        };

        skips.forEach(skip => {
          const dayKey = skip.date === todayStr ? 'today' : 'tomorrow';
          const mealKey = skip.menu_type.toLowerCase();
          if (newCounts[dayKey][mealKey] !== undefined) {
            newCounts[dayKey][mealKey]++;
          }
        });

        setSkipCounts(newCounts);
      }
    } catch (err) {
      console.error("Error fetching skips:", err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRealSkipCounts();

    const channel = supabase
      .channel('skip_realtime_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skip_table' }, () => fetchRealSkipCounts())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchRealSkipCounts]);

  return (
    <div className={`caterer-skip-card ${loading ? 'widget-loading' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em' }}>
          Students willing to skip
        </h3>
        
        <button 
          onClick={() => fetchRealSkipCounts(true)} 
          className="card-refresh-btn"
          disabled={loading || isRefreshing}
        >
          <RotateCw size={20} className={isRefreshing ? 'spinning-icon' : ''} />
        </button>
      </div>

      <div className="caterer-skip-grid">
        <div className="caterer-skip-col">
          <div className="caterer-skip-col-title">Today</div>
          {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
            <div key={`today-${meal}`} className="caterer-skip-row">
              <span className="caterer-skip-meal">{meal}</span>
              <VerticalRollNumber 
                value={skipCounts.today[meal.toLowerCase()]} 
              />
            </div>
          ))}
        </div>

        <div className="caterer-skip-col">
          <div className="caterer-skip-col-title">Tomorrow</div>
          {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
            <div key={`tomorrow-${meal}`} className="caterer-skip-row">
              <span className="caterer-skip-meal">{meal}</span>
              <VerticalRollNumber 
                value={skipCounts.tomorrow[meal.toLowerCase()]} 
              />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .caterer-skip-card {
          background: linear-gradient(135deg, #8e94f2 0%, #6e75e8 100%);
          color: white;
          padding: 26px;
          border-radius: 20px;
          box-shadow: 0 10px 35px rgba(110, 117, 232, 0.35);
        }

        .card-refresh-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-refresh-btn:hover { background: rgba(255, 255, 255, 0.35); transform: translateY(-1px); }
        .card-refresh-btn:active { transform: scale(0.95); }

        .spinning-icon { animation: rotate 0.8s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .caterer-skip-col { background: rgba(255, 255, 255, 0.12); padding: 18px; border-radius: 15px; flex: 1; }
        .caterer-skip-col-title { font-weight: 800; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.08em; margin-bottom: 15px; opacity: 0.85; }
        .caterer-skip-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .caterer-skip-meal { font-weight: 600; font-size: 1rem; }

        .caterer-vrn-window { height: 32px; overflow: hidden; background: rgba(255, 255, 255, 0.25); border-radius: 8px; min-width: 44px; text-align: center; }
        .caterer-vrn-column { transition: transform 1.2s cubic-bezier(0.19, 1, 0.22, 1); display: flex; flex-direction: column; }
        .caterer-vrn-num { height: 32px; line-height: 32px; font-weight: 900; font-size: 1.15rem; color: white; }

        .caterer-skip-footnote { font-size: 0.75rem; margin-top: 20px; opacity: 0.7; text-align: center; letter-spacing: 0.02em; }
        .widget-loading { opacity: 0.9; filter: grayscale(0.1); }
      `}</style>
    </div>
  );
};

export default SkipCountsCard;