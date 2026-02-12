import React, { useState } from 'react';

const LogWasteView = ({ profile }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    kitchenWaste: 0,
    plateWaste: 0,
    notes: ""
  });

  return (
    <div className="dashboard-grid">
      <div className="left-column">
        <div className="card">
          <div className="form-header">
            <span className="icon-orange">🗑️</span>
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
            onChange={(e) => setFormData({...formData, date: e.target.value})}
          />

          <div className="waste-row">
            <div className="waste-box green-tint">
              <h4>Kitchen Waste (Kg)</h4>
              <p>Peels, spoiled prep, etc.</p>
              <input type="number" value={formData.kitchenWaste} />
            </div>
            <div className="waste-box red-tint">
              <h4>Plate Waste (Kg)</h4>
              <p>Leftovers by students.</p>
              <input type="number" value={formData.plateWaste} />
            </div>
          </div>

          <label>Notes / Causes</label>
          <textarea 
            className="styled-input" 
            placeholder="E.g. Overcooked rice..." 
            style={{height: '100px'}}
          />

          <button className="submit-btn-orange">Submit Log</button>
        </div>
      </div>

      <div className="right-column">
        {/* Visual Guidelines Card */}
        <div className="card">
          <div className="bin-visuals">
             {/* Placeholder for bin icons */}
             <div className="bin green">Organic</div>
             <div className="bin dark">Plate Waste</div>
          </div>
          <h4 style={{marginTop: '20px'}}>Segregation Guidelines</h4>
          <ul className="guideline-list">
            <li><span className="dot green"></span> <strong>Green Bin:</strong> Raw peels, uncooked food.</li>
            <li><span className="dot red"></span> <strong>Red Bin:</strong> Cooked food left on plates.</li>
            <li><span className="dot blue"></span> <strong>Blue Bin:</strong> Dry waste (Paper napkins).</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LogWasteView;