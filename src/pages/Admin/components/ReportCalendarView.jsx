import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  ChevronLeft, ChevronRight, X, Coffee, Utensils, Moon,
  Loader2, MessageSquare, Send, CheckCircle, AlertCircle
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const toLocalISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const getEntryStatus = (count) => {
  if (!count || count === 0) return 'neutral';
  if (count === 1) return 'bad';
  if (count === 2) return 'mid';
  return 'good';
};

const formatFullDate = (day, month, year) => {
  const d = new Date(year, month, day);
  return `${dayNames[d.getDay()]}, ${day} ${monthNames[month]} ${year}`;
};

const MEAL_ICONS = {
  breakfast: <Coffee size={14} color="#e67e22" />,
  lunch:     <Utensils size={14} color="#3498db" />,
  dinner:    <Moon size={14} color="#9b59b6" />,
};

/* ─────────────────────────────────────────────────────────
   MESSAGE TEMPLATES
───────────────────────────────────────────────────────── */
const getTemplates = ({ mealType, reported, catererName, mealData, dateStr }) => {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const mealCap = cap(mealType);
  const caterer = catererName || 'your team';

  if (!reported) {
    return [
      {
        id: 'unreported_reminder',
        label: 'Reminder — Not Reported',
        body:
`Hi ${caterer},

This is a reminder that the waste report for ${mealCap} on ${dateStr} has not been submitted yet.

Timely reporting helps us track food waste accurately and plan meals better. Please log the waste data as soon as possible — it only takes a few minutes.

Date: ${dateStr}
Meal: ${mealCap}
Status: Not Reported

Kindly ensure this is filled in at the earliest. Thank you for your cooperation.

Regards,
Mess Admin`,
      },
      {
        id: 'unreported_urgent',
        label: 'Urgent — Overdue Report',
        body:
`Dear ${caterer},

We noticed that the waste report for ${mealCap} on ${dateStr} is still pending. This is an urgent follow-up as missing reports affect our monthly waste analytics.

Date: ${dateStr}
Meal: ${mealCap}
Status: Overdue

Please submit the waste data immediately. If there was an issue logging it, feel free to reach out and we'll assist you.

Thank you,
Mess Admin`,
      },
    ];
  }

  const total = mealData?.total?.toFixed(1) ?? '—';
  const plate = Number(mealData?.plate_waste ?? 0).toFixed(1);
  const uncooked = Number(mealData?.kitchen_uncooked ?? 0).toFixed(1);
  const cooked = Number(mealData?.kitchen_cooked ?? 0).toFixed(1);

  const wasteBreakdown = `Date: ${dateStr}
Meal: ${mealCap}
Total Waste: ${total} kg
   • Plate Waste: ${plate} kg
   • Uncooked (Kitchen): ${uncooked} kg
   • Cooked (Kitchen): ${cooked} kg`;

  return [
    {
      id: 'high_waste',
      label: 'High Waste — Needs Attention',
      body:
`Hi ${caterer},

After reviewing the waste report for ${mealCap} on ${dateStr}, we noticed the waste levels are higher than expected. We'd like to work together to bring this down.

${wasteBreakdown}

We encourage you to review portion sizes, preparation quantities, and identify any recurring patterns. Reducing waste benefits both costs and sustainability.

Please share your action plan at your earliest convenience.

Regards,
Mess Admin`,
    },
    {
      id: 'good_job',
      label: 'Great Work — Low Waste',
      body:
`Hi ${caterer},

We reviewed the waste report for ${mealCap} on ${dateStr} and are pleased to see the waste levels are well-managed. Great job!

${wasteBreakdown}

Keep up the excellent work. Consistent low waste reflects efficient planning and preparation. Your efforts are appreciated.

Regards,
Mess Admin`,
    },
    {
      id: 'feedback_positive',
      label: 'Students Feedback — Positive',
      body:
`Dear ${caterer},

We're happy to share that students have given positive feedback for ${mealCap} on ${dateStr}. The meal was well-received and students appreciated the quality and taste.

${wasteBreakdown}

This encouraging response from students reflects the effort your team puts in. Thank you for consistently delivering quality meals.

Keep it up!

Regards,
Mess Admin`,
    },
    {
      id: 'feedback_negative',
      label: 'Students Feedback — Needs Improvement',
      body:
`Hi ${caterer},

We've received feedback from students regarding ${mealCap} on ${dateStr} indicating there is room for improvement. We want to address this proactively.

${wasteBreakdown}

Common concerns raised include quality, taste, or portion adequacy. We'd appreciate it if you could look into this and make the necessary adjustments going forward.

Please connect with us if you'd like to discuss further.

Regards,
Mess Admin`,
    },
  ];
};

/* ─────────────────────────────────────────────────────────
   TOAST COMPONENT
───────────────────────────────────────────────────────── */
const Toast = ({ toasts }) => (
  <div className="toast-wrapper">
    {toasts.map(t => (
      <div 
        key={t.id} 
        className={`feedback-toast feedback-toast-override ${t.type}`} 
      >
        <div className="toast-icon">
          {t.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
        </div>
        {t.message}
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────
   MESSAGE PANEL
───────────────────────────────────────────────────────── */
const MessagePanel = ({
  mealType, reported, mealData, catererName, catererId,
  day, month, year, adminId,
  onClose, onToast,
}) => {
  const dateStr   = formatFullDate(day, month, year);
  
  const templates = useMemo(() => 
    getTemplates({ mealType, reported, catererName, mealData, dateStr }), 
  [mealType, reported, catererName, mealData, dateStr]);

  const [selected,   setSelected]   = useState('');
  const [body,       setBody]       = useState('');
  const [sending,    setSending]    = useState(false);

  useEffect(() => {
    if (templates.length > 0) {
      setSelected(templates[0].id);
      setBody(templates[0].body);
    }
  }, [mealType, reported, mealData, dateStr, templates]); 

  const handleTemplateChange = (e) => {
    const tId = e.target.value;
    setSelected(tId);
    const found = templates.find(t => t.id === tId);
    if (found) setBody(found.body);
  };

  const handleSend = async () => {
    if (!body.trim() || !adminId || !catererId) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id:    adminId,
        reciever_id:  catererId,
        message:      body.trim(),
        message_time: new Date().toISOString(),
      });
      if (error) throw error;
      onToast({ type: 'success', message: 'Message sent successfully!' });
      onClose();
    } catch (err) {
      onToast({ type: 'error', message: err.message || 'Failed to send message.' });
    } finally {
      setSending(false);
    }
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const isReadyToSend = body.trim() && !sending;

  return (
    <div className="rc-msg-panel" onClick={e => e.stopPropagation()}>
      <div className="rc-msg-header">
        <div className="rc-msg-icon">
          <MessageSquare size={15} />
        </div>
        <div className="rc-msg-header-text">
          <div className="rc-msg-caterer-name">Message {catererName}</div>
          <div className="rc-msg-meal-info">
            {MEAL_ICONS[mealType]} {cap(mealType)} · {day} {monthNames[month]} {year}
          </div>
        </div>
        <button onClick={onClose} className="rc-msg-close">
          <X size={18} />
        </button>
      </div>

      <div className="rc-msg-section">
        <div className="rc-msg-label">Choose a template</div>
        <select
          value={selected}
          onChange={handleTemplateChange}
          className="rc-msg-select"
        >
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="rc-msg-section flex-fill">
        <div className="rc-msg-label">Edit message</div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Type a custom message…"
          className="rc-msg-textarea"
        />
      </div>

      <div className="rc-msg-footer">
        <button onClick={onClose} className="rc-btn-cancel">Cancel</button>
        <button
          onClick={handleSend}
          disabled={!isReadyToSend}
          className={`rc-btn-send ${isReadyToSend ? 'ready' : ''}`}
        >
          {sending ? <><Loader2 size={14} className="spin" /> Sending…</> : <><Send size={13} /> Send Message</>}
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
const ReportCalendarView = () => {
  const [currentDate,       setCurrentDate]       = useState(new Date());
  const [caterersList,      setCaterersList]      = useState([]);
  const [selectedCatererId, setSelectedCatererId] = useState('');
  const [wasteData,         setWasteData]         = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [selectedDay,       setSelectedDay]       = useState(null);
  const [adminId,           setAdminId]           = useState(null);
  const [msgPanel,          setMsgPanel]          = useState(null);
  const [toasts,            setToasts]            = useState([]);

  const year        = currentDate.getFullYear();
  const month       = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay    = new Date(year, month, 1).getDay();
  const firstDayOfWeek = (startDay + 6) % 7;

  const pushToast = useCallback(({ type, message }) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAdminId(user.id);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('caterers')
        .select('caterer_id, name')
        .order('name');
      if (!error && data?.length) {
        setCaterersList(data);
        setSelectedCatererId(data[0].caterer_id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedCatererId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const start = toLocalISODate(new Date(year, month, 1));
      const end   = toLocalISODate(new Date(year, month + 1, 0));

      const { data, error } = await supabase
        .from('waste_reports')
        .select('report_date, meal_type, plate_waste, kitchen_uncooked, kitchen_cooked')
        .eq('caterer_id', selectedCatererId)
        .gte('report_date', start)
        .lte('report_date', end)
        .order('report_date', { ascending: true });

      if (!cancelled) {
        if (!error) setWasteData(data || []);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [currentDate, selectedCatererId, month, year]);

  const dayMap = useMemo(() => {
    const map = new Map();
    wasteData.forEach(row => {
      const day = parseInt(row.report_date.split('-')[2], 10);
      if (!map.has(day)) map.set(day, { totalWaste: 0, mealCount: 0, meals: [] });
      const d     = map.get(day);
      const waste = Number(row.plate_waste      || 0)
                  + Number(row.kitchen_uncooked || 0)
                  + Number(row.kitchen_cooked   || 0);
      d.totalWaste += waste;
      d.mealCount  += 1;
      d.meals.push({ ...row, total: waste });
    });
    map.forEach(d => {
      d.avgWaste = d.mealCount > 0 ? Number((d.totalWaste / d.mealCount).toFixed(1)) : 0;
    });
    return map;
  }, [wasteData]);

  const stats = useMemo(() => {
    if (wasteData.length === 0)
      return { totalReports: 0, totalWaste: '0.0', avgPerMeal: '0.0', fullDays: 0 };

    const total = wasteData.reduce(
      (s, r) => s + Number(r.plate_waste||0) + Number(r.kitchen_uncooked||0) + Number(r.kitchen_cooked||0), 0,
    );
    let fullDays = 0;
    dayMap.forEach(d => { if (d.mealCount >= 3) fullDays++; });

    return {
      totalReports: wasteData.length,
      totalWaste:   total.toFixed(1),
      avgPerMeal:   (total / wasteData.length).toFixed(1),
      fullDays,
    };
  }, [wasteData, dayMap]);

  const selectedCatererName = caterersList.find(c => c.caterer_id === selectedCatererId)?.name ?? '';

  const openDayModal = (dayNum) => {
    const data = dayMap.get(dayNum);
    setSelectedDay({
      day:        dayNum,
      totalWaste: data?.totalWaste ?? 0,
      mealCount:  data?.mealCount  ?? 0,
      meals:      data?.meals      ?? [],
      avgWaste:   data?.avgWaste   ?? 0,
    });
    setMsgPanel(null);
  };

  return (
    <div className="calendar-layout rc-container">

      <Toast toasts={toasts} />

      {selectedDay && (
        <div className="rc-modal-backdrop" onClick={() => { setSelectedDay(null); setMsgPanel(null); }}>
          <div className={`rc-modal-wrapper ${msgPanel ? 'expanded' : 'collapsed'}`} onClick={e => e.stopPropagation()}>
            
            <div className={`rc-day-card ${msgPanel ? 'partial-width' : 'full-width'}`}>
              <button onClick={() => { setSelectedDay(null); setMsgPanel(null); }} className="rc-close-btn">
                <X size={20} />
              </button>

              <h3 className="rc-day-title">
                {monthNames[month]} {selectedDay.day}, {year}
              </h3>
              <p className="rc-day-subtitle">
                {formatFullDate(selectedDay.day, month, year).split(', ')[0]}
                &nbsp;·&nbsp;
                {selectedDay.mealCount} of 3 meals reported
                {selectedDay.mealCount > 0 && (
                  <>&nbsp;·&nbsp;Total: <strong>{selectedDay.totalWaste.toFixed(1)} kg</strong></>
                )}
              </p>

              {['breakfast', 'lunch', 'dinner'].map((type, idx) => {
                const meal     = selectedDay.meals.find(m => m.meal_type?.toLowerCase().trim() === type);
                const reported = !!meal;
                const isPanelOpen = msgPanel?.mealType === type;

                return (
                  <div key={type} className={`rc-meal-row ${idx < 2 ? 'bordered' : ''}`}>
                    <div className="rc-meal-header">
                      <div className="rc-meal-left">
                        {MEAL_ICONS[type]}
                        <span className="rc-meal-name">{type}</span>
                      </div>

                      <div className="rc-meal-right">
                        {reported ? (
                          <div className="rc-meal-stats">
                            <strong>{meal.total.toFixed(1)} kg</strong>
                            <div className="rc-meal-stats-sub">
                              P {Number(meal.plate_waste).toFixed(1)} · U {Number(meal.kitchen_uncooked).toFixed(1)} · C {Number(meal.kitchen_cooked).toFixed(1)}
                            </div>
                          </div>
                        ) : (
                          <span className="rc-not-reported">Not reported</span>
                        )}

                        <button
                          onClick={() => setMsgPanel(isPanelOpen ? null : { mealType: type, reported, mealData: meal || null })}
                          title={`Message caterer about ${type}`}
                          className={`rc-msg-btn ${isPanelOpen ? 'active' : ''}`}
                        >
                          <MessageSquare size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <p className="rc-footer-hint">
                Click <MessageSquare size={11} /> next to a meal to message the caterer.
              </p>
            </div>

            {msgPanel && (
              <div className="rc-msg-panel-wrapper">
                <MessagePanel
                  mealType={msgPanel.mealType}
                  reported={msgPanel.reported}
                  mealData={msgPanel.mealData}
                  catererName={selectedCatererName}
                  catererId={selectedCatererId}
                  day={selectedDay.day}
                  month={month}
                  year={year}
                  adminId={adminId}
                  onClose={() => setMsgPanel(null)}
                  onToast={(t) => {
                    pushToast(t);
                    setMsgPanel(null);
                    setSelectedDay(null);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="calendar-section">
        <div className="rc-header-controls">
          <div className="nav-header">
            <button className="nav-arrow-btn" onClick={() => { setLoading(true); setCurrentDate(new Date(year, month - 1, 1)); }}>
              <ChevronLeft size={20} />
            </button>
            <span className="month-label">
              {monthNames[month]} {year}
              {loading && <Loader2 size={13} className="spin" style={{ marginLeft: 7, opacity: 0.5 }} />}
            </span>
            <button className="nav-arrow-btn" onClick={() => { setLoading(true); setCurrentDate(new Date(year, month + 1, 1)); }}>
              <ChevronRight size={20} />
            </button>
          </div>

          <select
            value={selectedCatererId}
            onChange={e => setSelectedCatererId(e.target.value)}
            className="header-select"
          >
            {caterersList.length === 0 && <option value="">Loading...</option>}
            {caterersList.map(c => (
              <option key={c.caterer_id} value={c.caterer_id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="legend">
          <span className="dot red" style={{ marginRight: 4 }}></span> 1 entry &nbsp;
          <span className="dot yellow" style={{ marginRight: 4 }}></span> 2 entries &nbsp;
          <span className="dot green" style={{ marginRight: 4 }}></span> All 3 entries
        </div>

        <div className={`calendar-grid ${loading ? 'grid-loading' : ''}`}>
          {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
            <div key={d} className="grid-header">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e-${i}`} className="calendar-cell empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const data   = dayMap.get(dayNum);
            const status = getEntryStatus(data?.mealCount);

            return (
              <div
                key={dayNum}
                className={`calendar-cell clickable ${status}`}
                onClick={() => openDayModal(dayNum)}
              >
                <div className="date-num">{dayNum}</div>
                {data ? (
                  <>
                    <div className="rating-score">{data.avgWaste}</div>
                    <div className="dish-name">kg/meal</div>
                  </>
                ) : (
                  <div></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-widgets">
        <div className="rc-widget-avg">
          <div className="rc-widget-avg-label">Monthly Average Waste</div>
          <div className="rc-widget-avg-val">{stats.avgPerMeal}</div>
          <div className="rc-widget-avg-sub">KG PER MEAL</div>
        </div>

        <div className="rc-widget-stats">
          <h4>Month Stats</h4>
          {[
            { label: 'Total Reports',       value: stats.totalReports },
            { label: 'Total Waste (kg)',     value: stats.totalWaste   },
            { label: 'Avg per Meal (kg)',    value: stats.avgPerMeal   },
            { label: 'Fully Reported Days',  value: stats.fullDays     },
          ].map(({ label, value }) => (
            <div key={label} className="rc-stat-row">
              <span className="rc-stat-label">{label}</span>
              <span className="rc-stat-val">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportCalendarView;