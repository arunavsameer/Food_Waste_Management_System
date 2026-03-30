import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';

const min_bad_fb_len = 30;

const FeedbackView = ({ onSuccessfulSubmit, onError }) => {
  const [rating, setRating] = useState(7);
  const [comment, setComment] = useState('');
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
      dates.push({ value: d.toISOString().split('T')[0], label: label });
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

  const handleSubmit = async () => {
    if (((comment.trim().length) < min_bad_fb_len) && rating < 5) {
      if (onError) onError("Please explain why the food was bad (Min 30 chars).");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Authentication error. Please log in again.");
      
      const studentId = session.user.id;

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('caterer_id')
        .eq('id', studentId)
        .single();

      if (studentError || !studentData?.caterer_id) {
         throw new Error("Could not find your mess subscription.");
      }

      const { data: existingFeedback, error: checkError } = await supabase
        .from('feedback')
        .select('id')
        .eq('student_id', studentId)
        .eq('date', selectedDate)
        .eq('meal_type', mealType)
        .maybeSingle();

      if (checkError) throw new Error("Failed to verify existing feedback. Please try again.");
      if (existingFeedback) throw new Error(`You have already submitted feedback for ${mealType} on this date.`);

      const { error: insertError } = await supabase
        .from('feedback')
        .insert([{
          student_id: studentId,
          caterer_id: studentData.caterer_id,
          meal_type: mealType, 
          rating: Number(rating),
          comment: comment.trim() === '' ? null : comment.trim(),
          date: selectedDate
        }]);

      if (insertError) throw insertError;

      // ==========================================
      // EARN TOKEN LOGIC (Update Database)
      // ==========================================
      const { data: scoreData } = await supabase
        .from('player_score')
        .select('game_points')
        .eq('student_id', studentId)
        .maybeSingle();

      if (scoreData) {
         await supabase.from('player_score').update({ game_points: scoreData.game_points + 1 }).eq('student_id', studentId);
      } else {
         await supabase.from('player_score').insert([{ student_id: studentId, game_points: 1, high_score: 0, attempts_count: 0 }]);
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
    size: 1.5 + Math.random() + 'rem'
  }));

  return (
    <div className="feedback-container">
      {showShower && (
        <div className="emoji-shower-overlay">
          {particles.map((p) => (
            <div 
              key={p.id} 
              className="falling-emoji"
              style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, fontSize: p.size }}
            >
              {currentEmoji}
            </div>
          ))}
        </div>
      )}

      <div className={`feedback-card ${isExiting ? 'fading-out' : ''}`} style={{ maxWidth: '500px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>How was your meal?</h3>
        
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
            <select className="styled-select" value={mealType} onChange={(e) => setMealType(e.target.value)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </div>
        </div>

        <div className="rating-section" style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '4rem', lineHeight: '1' }}>{currentEmoji}</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: getRatingColor(rating), marginTop: '10px' }}>
              {rating}/10
            </div>
          </div>
          <input 
            type="range" min="1" max="10" 
            value={rating} onChange={(e) => setRating(e.target.value)} 
            className="slider" style={{ accentColor: getRatingColor(rating) }}
          />
          <div className="slider-labels">
            <span>Terrible</span><span>Okay</span><span>Delicious</span>
          </div>
        </div>

        <div className="comment-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label>COMMENTS</label>
                <span style={{ fontSize: '0.75rem', color: comment.length > 130 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {comment.length}/150
                </span>
            </div>
            <textarea 
                className="styled-textarea" rows="4" maxLength="150"
                placeholder="What did you like or dislike?"
                value={comment} onChange={(e) => setComment(e.target.value)}
            />
        </div>

        <button 
          className="submit-btn-dark" 
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ marginTop: '25px', backgroundColor: getRatingColor(rating), color: 'white' }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
};

export default FeedbackView;