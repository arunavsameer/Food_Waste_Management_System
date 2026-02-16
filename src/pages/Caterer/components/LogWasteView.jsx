import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

const LogWasteView = ({ profile }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    kitchenWaste: 0,
    plateWaste: 0,
    notes: ''
  });

  return (
    <div className="dashboard-grid">
      <div className="left-column">
        <div className="card">
          <div className="form-header">
            <Trash2 size={24} className="icon-orange" style={{ color: '#e67e22' }} />
            <div>
              <h3>Log Daily Waste</h3>
              <p>Enter segregated waste data accurately.</p>
            </div>
          </div>

          <label>Select Date</label>
          <input
            type="date"
            className="styled-input"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            style={{ marginBottom: '20px' }}
          />

          <div className="waste-row">
            <div className="waste-box green-tint">
              <h4>Kitchen Waste (Kg)</h4>
              <p>Peels, spoiled prep, etc.</p>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.kitchenWaste}
                onChange={(e) => setFormData({ ...formData, kitchenWaste: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="waste-box red-tint">
              <h4>Plate Waste (Kg)</h4>
              <p>Leftovers by students.</p>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.plateWaste}
                onChange={(e) => setFormData({ ...formData, plateWaste: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <label>Notes / Causes</label>
          <textarea
            className="styled-input"
            placeholder="E.g. Overcooked rice, less student turnout..."
            style={{ minHeight: '100px', resize: 'vertical' }}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <button type="button" className="submit-btn-orange">
            Submit Log
          </button>
        </div>
      </div>

      <div className="right-column">
        {/* Segregation Guidelines */}
        <div className="card">
          <div className="bin-visuals">
            <div className="bin green">ORGANIC</div>
            <div className="bin dark">PLATE WASTE</div>
          </div>
          <h4 style={{ marginTop: '12px', marginBottom: '8px' }}>Segregation Guidelines</h4>
          <ul className="guideline-list">
            <li><span className="dot green" /> <strong>Green Bin:</strong> Raw vegetable peels, spoiled uncooked food.</li>
            <li><span className="dot red" /> <strong>Red Bin:</strong> Cooked food left on plates by students.</li>
            <li><span className="dot blue" /> <strong>Blue Bin:</strong> Dry waste (Paper napkins, wrappers).</li>
          </ul>
        </div>

        {/* Admin Messages */}
        <div className="admin-messages-card">
          <h4>
            Admin Messages
            <span className="new-badge">1 New</span>
          </h4>
          <div className="message-item">
            <span className="sender">Admin</span>
            <span className="time">Today, 10:00 AM</span>
            <p className="body">
              Please reduce the quantity of rice prepared for dinner today. Student turnout expected to be low due to fest.
            </p>
          </div>
          <div className="message-item">
            <span className="sender">Admin</span>
            <span className="time">Yesterday</span>
            <p className="body">
              Review scores for lunch were excellent! Keep it up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogWasteView;
