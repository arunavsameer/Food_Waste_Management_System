import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';

const min_bad_fb_len = 30;

const AUTO_COMMENTS = {
  breakfast: {
    bad:  ["Bread was stale and hard", "Milk was cold and tasteless", "No fruits served today", "Main course was disappointing"],
    avg:  ["Bread was okay, not fresh", "Milk was average today", "Fruits were limited today", "Main course was just decent"],
    good: ["Bread was soft and fresh", "Milk was hot and creamy", "Loved the fruits today!", "Main course was delicious!"],
  },
  lunch: {
    bad:  ["Roti was hard and dry", "Sabzi was bland and oily", "Rice was undercooked", "Dal was watery and tasteless"],
    avg:  ["Roti was okay, not soft", "Sabzi was average today", "Rice was decent but plain", "Dal could be better spiced"],
    good: ["Roti was soft and fresh", "Sabzi was well-cooked!", "Rice was perfectly cooked", "Dal was perfectly spiced"],
  },
  dinner: {
    bad:  ["Roti was hard and dry", "Sabzi was bland and oily", "Rice was undercooked", "Dal was watery and tasteless"],
    avg:  ["Roti was okay, not soft", "Sabzi was average today", "Rice was decent but plain", "Dal could be better spiced"],
    good: ["Roti was soft and fresh", "Sabzi was well-cooked!", "Rice was perfectly cooked", "Dal was perfectly spiced"],
  },
};

const getRatingCategory = (score) => {
  if (score <= 4) return 'bad';
  if (score <= 6) return 'avg';
  return 'good';
};

const chipColors = {
  bad:  { border: '#e74c3c', text: '#c0392b', bg: '#fdecea', selectedBg: '#e74c3c' },
  avg:  { border: '#edbd00', text: '#9a7d0a', bg: '#fef9e7', selectedBg: '#edbd00' },
  good: { border: '#2ecc71', text: '#1a7a45', bg: '#eafaf1', selectedBg: '#2ecc71' },
};

const FeedbackView = ({ onSuccessfulSubmit, onError }) => {
  const [rating, setRating] = useState(7);
  const [manualComment, setManualComment] = useState('');   // free-text only
  const [selectedChips, setSelectedChips] = useState([]);   // chip tags
  const [mealType, setMealType] = useState('lunch');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showShower, setShowShower] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const getRecentDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (i === 0) label = `Today (${label})`;
      else if (i === 1) label = `Yesterday (${label})`;
      dates.push({ value: d.toISOString().split('T')[0], label });
    }
    return dates;
  };
  const recentDates = getRecentDates();
  const [selectedDate, setSelectedDate] = useState(recentDates[0].value);

  const getEmoji = (score) => {
    if (score >= 9) return '🤩';
    if (score >= 7) return '😋';
    if (score >= 5) return '😐';
    if (score >= 3) return '☹️';
    return '🤬';
  };

  const getRatingColor = (score) => {
    if (score >= 7) return '#2ecc71';
    if (score >= 5) return '#edbd00';
    return '#e74c3c';
  };

  // Full comment = chips joined + manual text
  const buildFullComment = (chips, manual) => {
    const parts = [...chips, manual.trim()].filter(Boolean);
    return parts.join(', ').slice(0, 150);
  };

  const handleRatingChange = (val) => {
    setRating(val);
    setSelectedChips([]);
  };

  const handleMealTypeChange = (val) => {
    setMealType(val);
    setSelectedChips([]);
    setManualComment('');
  };

  const handleAddChip = (chip) => {
    const updated = [...selectedChips, chip];
    setSelectedChips(updated);
  };

  const handleRemoveChip = (chip) => {
    const updated = selectedChips.filter(c => c !== chip);
    setSelectedChips(updated);
  };

  const ratingCategory = getRatingCategory(Number(rating));
  const allChipsForCategory = AUTO_COMMENTS[mealType][ratingCategory];
  // Only show chips not yet selected
  const availableChips = allChipsForCategory.filter(c => !selectedChips.includes(c));
  const color = chipColors[ratingCategory];

  const fullComment = buildFullComment(selectedChips, manualComment);
  const charCount = fullComment.length;

  const handleSubmit = async () => {
    if (fullComment.trim().length < min_bad_fb_len && rating < 5) {
      if (onError) onError("Please explain why the food was bad (Min 30 chars).");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Authentication error. Please log in again.");
      const studentId = session.user.id;

      const { data: studentData, error: studentError } = await supabase
        .from('students').select('caterer_id').eq('id', studentId).single();
      if (studentError || !studentData?.caterer_id)
        throw new Error("Could not find your mess subscription.");

      const { data: existingFeedback, error: checkError } = await supabase
        .from('feedback').select('id')
        .eq('student_id', studentId).eq('date', selectedDate).eq('meal_type', mealType)
        .maybeSingle();
      if (checkError) throw new Error("Failed to verify existing feedback. Please try again.");
      if (existingFeedback) throw new Error(`You have already submitted feedback for ${mealType} on this date.`);

      const { error: insertError } = await supabase.from('feedback').insert([{
        student_id: studentId,
        caterer_id: studentData.caterer_id,
        meal_type: mealType,
        rating: Number(rating),
        comment: fullComment.trim() === '' ? null : fullComment.trim(),
        date: selectedDate,
      }]);
      if (insertError) throw insertError;

      const { data: scoreData } = await supabase
        .from('player_score').select('game_points').eq('student_id', studentId).maybeSingle();
      if (scoreData) {
        await supabase.from('player_score')
          .update({ game_points: scoreData.game_points + 1 }).eq('student_id', studentId);
      } else {
        await supabase.from('player_score')
          .insert([{ student_id: studentId, game_points: 1, high_score: 0, attempts_count: 0 }]);
      }

      setShowShower(true);
      setTimeout(() => setIsExiting(true), 1000);
      setTimeout(() => onSuccessfulSubmit(), 1500);

    } catch (err) {
      console.error(err);
      if (onError) onError(err.message || "Failed to submit feedback. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentEmoji = getEmoji(Number(rating));
  const particles = Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100 + '%',
    delay: Math.random() * 0.5 + 's',
    duration: 1 + Math.random() + 's',
    size: 1.5 + Math.random() + 'rem',
  }));

  return (
    <div className="feedback-container">
      {showShower && (
        <div className="emoji-shower-overlay">
          {particles.map((p) => (
            <div key={p.id} className="falling-emoji"
              style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, fontSize: p.size }}>
              {currentEmoji}
            </div>
          ))}
        </div>
      )}

      <div className={`feedback-card ${isExiting ? 'fading-out' : ''}`} style={{ maxWidth: '500px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>How was your meal?</h3>

        {/* Date + Meal Type */}
        <div className="form-row">
          <div className="form-group">
            <label>DATE</label>
            <select className="styled-select" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
              {recentDates.map((date) => (
                <option key={date.value} value={date.value}>{date.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>MEAL TYPE</label>
            <select className="styled-select" value={mealType} onChange={(e) => handleMealTypeChange(e.target.value)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>
        </div>

        {/* Rating */}
        <div className="rating-section" style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '4rem', lineHeight: '1' }}>{currentEmoji}</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: getRatingColor(rating), marginTop: '10px' }}>
              {rating}/10
            </div>
          </div>
          <input type="range" min="1" max="10"
            value={rating} onChange={(e) => handleRatingChange(e.target.value)}
            className="slider" style={{ accentColor: getRatingColor(rating) }}
          />
          <div className="slider-labels">
            <span>Terrible</span><span>Okay</span><span>Delicious</span>
          </div>
        </div>

        {/* Comments box */}
        <div className="comment-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label>COMMENTS</label>
            <span style={{ fontSize: '0.75rem', color: charCount > 130 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {charCount}/150
            </span>
          </div>

          {/* The combined box */}
          <div style={{
            border: '1.5px solid var(--border, #ddd)',
            borderRadius: '8px',
            padding: '10px',
            minHeight: '90px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'var(--input-bg, #fff)',
          }}>
            {/* Selected chip tags inside the box */}
            {selectedChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleRemoveChip(chip)}
                    title="Click to remove"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: color.selectedBg,
                      color: 'white',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {chip}
                    <span style={{ fontSize: '1rem', lineHeight: '1', opacity: 0.85 }}>×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Free-text input */}
            <textarea
              rows="2"
              maxLength={150 - selectedChips.join(', ').length - (selectedChips.length > 0 ? 2 : 0)}
              placeholder={selectedChips.length > 0 ? "Add more..." : "What did you like or dislike?"}
              value={manualComment}
              onChange={(e) => setManualComment(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                resize: 'none',
                width: '100%',
                fontSize: '0.9rem',
                backgroundColor: 'transparent',
                color: 'var(--text, #333)',
                fontFamily: 'inherit',
                padding: 0,
              }}
            />
          </div>

          {/* Quick Add chips (only unselected ones) */}
          {availableChips.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label>QUICK ADD ✨</label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {availableChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddChip(chip)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      border: `1.5px solid ${color.border}`,
                      backgroundColor: 'transparent',
                      color: color.text,
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      lineHeight: '1.3',
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="submit-btn-dark" onClick={handleSubmit} disabled={isSubmitting}
          style={{ marginTop: '25px', backgroundColor: getRatingColor(rating), color: 'white' }}>
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
};

export default FeedbackView;