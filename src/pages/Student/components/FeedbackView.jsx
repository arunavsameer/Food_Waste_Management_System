import React, { useState } from 'react';

const FeedbackView = ({ messName }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const getEmoji = (score) => {
    if (score >= 9) return '🤩';
    if (score >= 7) return '😋';
    if (score >= 5) return '😐';
    if (score >= 3) return '☹️';
    return '🤬';
  };

  const getRatingColor = (score) => {
    // Using CSS variables would be better, but for dynamic slider colors we keep this logic
    // Just ensuring the text color pops against the dark bg
    if (score >= 7) return '#2ecc71';
    if (score >= 5) return '#f1c40f';
    return '#e74c3c';
  };

  return (
    <div className="feedback-container">
      <div className="feedback-card" style={{ maxWidth: '500px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>How was your meal?</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label>MESS (Assigned)</label>
            <input type="text" value={messName || '...'} disabled className="read-only-input" />
          </div>
          <div className="form-group">
            <label>MEAL TYPE</label>
            <select className="styled-select">
              <option>Lunch</option>
              <option>Dinner</option>
              <option>Breakfast</option>
            </select>
          </div>
        </div>

        <div className="rating-section" style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '4rem', lineHeight: '1' }}>{getEmoji(Number(rating))}</div>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: '800', 
              color: getRatingColor(rating),
              marginTop: '10px'
            }}>
              {rating}/10
            </div>
          </div>

          <input 
            type="range" min="1" max="10" 
            value={rating} onChange={(e) => setRating(e.target.value)} 
            className="slider"
            style={{ accentColor: getRatingColor(rating) }}
          />
          
          <div className="slider-labels">
            <span>Terrible</span>
            <span>Okay</span>
            <span>Delicious</span>
          </div>
        </div>

        <div className="comment-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label>Comments</label>
                <span style={{ fontSize: '0.75rem', color: comment.length > 130 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {comment.length}/150
                </span>
            </div>
            
            {/* REMOVED INLINE STYLES HERE. Relies on CSS class now. */}
            <textarea 
                className="styled-textarea"
                rows="4"
                maxLength="150"
                placeholder="What did you like or dislike?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
            />
        </div>

        <button className="submit-btn-dark" style={{ marginTop: '25px', backgroundColor: getRatingColor(rating), color: 'white' }}>
          Submit Feedback
        </button>
      </div>
    </div>
  );
};

export default FeedbackView;