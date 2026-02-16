import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Smile, Meh, Frown } from 'lucide-react';

const MessFeedbackView = ({ messName }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getRealTimeMeal = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 16) return 'Lunch';
    return 'Dinner';
  };

  const [mealType, setMealType] = useState(getRealTimeMeal());

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Dummy feedback (future-ready): swap this with a DB query filtered by messName + date + mealType.
  const allFeedback = useMemo(
    () => [
      { mess: 'Mess A', day: 2, type: 'Lunch', rating: 7.5, comment: 'Paneer was good, rice a bit dry.' },
      { mess: 'Mess A', day: 5, type: 'Lunch', rating: 4.0, comment: 'Too oily today.' },
      { mess: 'Mess A', day: 12, type: 'Lunch', rating: 9.0, comment: 'Great taste and quantity.' },
      { mess: 'Mess A', day: 14, type: 'Dinner', rating: 8.0, comment: 'Egg curry was nice.' },
      { mess: 'Mess A', day: 15, type: 'Lunch', rating: 4.5, comment: 'Khichdi was bland.' },
      { mess: 'Mess B', day: 8, type: 'Lunch', rating: 8.0, comment: 'Loved dal makhani.' },
      { mess: 'Mess B', day: 20, type: 'Dinner', rating: 3.5, comment: 'Roti was hard.' },
      { mess: 'Mess C', day: 25, type: 'Lunch', rating: 8.5, comment: 'Chicken curry was great.' }
    ],
    []
  );

  const normalizedMess = messName || 'Mess A';
  const visibleFeedback = useMemo(() => {
    return allFeedback.filter((f) => f.mess === normalizedMess && f.type === mealType);
  }, [allFeedback, normalizedMess, mealType]);

  const getForDay = (dayNum) => visibleFeedback.find((f) => f.day === dayNum) || null;

  const getStatusClass = (rating) => {
    if (rating >= 7) return 'good';
    if (rating >= 5) return 'mid';
    return 'bad';
  };

  const averageRating = useMemo(() => {
    if (visibleFeedback.length === 0) return '0.0';
    const avg = visibleFeedback.reduce((s, x) => s + x.rating, 0) / visibleFeedback.length;
    return avg.toFixed(1);
  }, [visibleFeedback]);

  const moodConfig = useMemo(() => {
    const num = parseFloat(averageRating);
    if (num === 0) return { Icon: MessageSquare, color: 'var(--text-muted)' };
    if (num >= 7.5) return { Icon: Smile, color: 'var(--primary-green)' };
    if (num >= 5) return { Icon: Meh, color: 'var(--warning)' };
    return { Icon: Frown, color: 'var(--danger)' };
  }, [averageRating]);

  const recentComments = useMemo(() => {
    // Dummy: sort by day desc
    return [...visibleFeedback].sort((a, b) => b.day - a.day).slice(0, 4);
  }, [visibleFeedback]);

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

          <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="caterer-header-select">
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
          </select>
        </div>

        <div className="caterer-feedback-legend">
          <span className="c-dot good" /> Good
          <span className="c-dot mid" style={{ marginLeft: 10 }} /> Avg
          <span className="c-dot bad" style={{ marginLeft: 10 }} /> Bad
        </div>

        <div className="caterer-feedback-grid">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
            <div key={d} className="caterer-grid-header">
              {d}
            </div>
          ))}

          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="caterer-feedback-cell empty" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const item = getForDay(dayNum);
            const statusClass = item ? getStatusClass(item.rating) : 'neutral';

            return (
              <div key={dayNum} className={`caterer-feedback-cell ${statusClass}`}>
                <div className="caterer-date-num">{dayNum}</div>
                {item ? (
                  <>
                    <div className="caterer-rating-score">{item.rating}</div>
                    <div className="caterer-dish-name">{item.comment}</div>
                  </>
                ) : (
                  <div className="caterer-dish-name" style={{ marginTop: 'auto', opacity: 0.35 }}>
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
          <moodConfig.Icon size={44} style={{ marginBottom: 10, color: moodConfig.color, transition: 'color 0.3s' }} />
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{averageRating}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Avg {mealType} Rating
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
            Mess: <strong style={{ color: 'var(--text-main)' }}>{normalizedMess}</strong>
          </p>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Recent comments</h4>
          {recentComments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No feedback yet for this meal type.</div>
          ) : (
            <div className="caterer-comments">
              {recentComments.map((c) => (
                <div key={`${c.day}-${c.type}-${c.rating}`} className="caterer-comment-item">
                  <div className="caterer-comment-top">
                    <span className="caterer-comment-day">Day {c.day}</span>
                    <span className={`caterer-comment-pill ${getStatusClass(c.rating)}`}>{c.rating}/10</span>
                  </div>
                  <div className="caterer-comment-body">{c.comment}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessFeedbackView;
