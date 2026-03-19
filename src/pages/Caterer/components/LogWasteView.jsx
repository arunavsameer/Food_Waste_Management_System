import React, { useState } from 'react';
import { Trash2, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase'; 
import SkipCountsCard from './SkipCountsCard';

const LogWasteView = ({ profile }) => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  
  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    meal_type: 'lunch', 
    kitchen_uncooked: 0,
    kitchen_cooked: 0,
    plate_waste: 0,
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    
    const now = new Date();
    const selectedDateStr = formData.report_date;
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;

    if (selectedDateStr > todayStr) {
      showToast("Cannot report waste for future dates!", "error");
      return;
    }

    if (selectedDateStr === todayStr) {
      const constraints = {
        breakfast: { limit: 11 * 60, label: "11:00 AM" },
        lunch:     { limit: 15 * 60, label: "3:00 PM"  },
        dinner:    { limit: 22 * 60 + 30, label: "10:30 PM" }
      };
      const selectedMeal = constraints[formData.meal_type];
      if (currentTimeInMinutes < selectedMeal.limit) {
        showToast(`Today's ${formData.meal_type} can only be submitted after ${selectedMeal.label}.`, "error");
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");

      const { data: existing, error: checkError } = await supabase
        .from('waste_reports')
        .select('report_id')
        .eq('report_date', selectedDateStr)
        .eq('meal_type', formData.meal_type)
        .eq('caterer_id', user.id);

      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        showToast(`A report for ${formData.meal_type} on this date already exists.`, "error");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('waste_reports')
        .insert([{
          report_date:       formData.report_date,
          meal_type:         formData.meal_type,
          kitchen_uncooked:  formData.kitchen_uncooked,
          kitchen_cooked:    formData.kitchen_cooked,
          plate_waste:       formData.plate_waste,
          caterer_id:        user.id,
        }]);

      if (error) throw error;

      showToast("Report submitted successfully!");
      setFormData(prev => ({ ...prev, kitchen_uncooked: 0, kitchen_cooked: 0, plate_waste: 0 }));
      
    } catch (err) {
      showToast(err.message || "Failed to log waste", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-grid">
      {/* ── Left Column: Form ── */}
      <div className="left-column">
        <form onSubmit={handleLogSubmit} className="card">
          <div className="form-header">
            <Trash2 size={24} style={{ color: '#e67e22' }} />
            <div>
              <h3>Log Daily Waste</h3>
              <p>Reporting for <strong>{profile?.mess_name || 'EcoPlate Mess'}</strong></p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label>Report Date</label>
              <input
                type="date"
                className="styled-input"
                max={new Date().toISOString().split('T')[0]}
                value={formData.report_date}
                onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Meal Type</label>
              <select
                className="styled-input"
                value={formData.meal_type}
                onChange={(e) => setFormData({ ...formData, meal_type: e.target.value })}
                required
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>
          </div>

          <div className="waste-row">
            <div className="waste-box green-tint">
              <h4>Uncooked (Kg)</h4>
              <input
                type="number" min="0" step="0.01"
                value={formData.kitchen_uncooked}
                onChange={(e) => setFormData({ ...formData, kitchen_uncooked: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="waste-box orange-tint">
              <h4>Cooked (Kg)</h4>
              <input
                type="number" min="0" step="0.01"
                value={formData.kitchen_cooked}
                onChange={(e) => setFormData({ ...formData, kitchen_cooked: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="waste-box red-tint">
              <h4>Plate Waste (Kg)</h4>
              <input
                type="number" min="0" step="0.01"
                value={formData.plate_waste}
                onChange={(e) => setFormData({ ...formData, plate_waste: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="submit-btn-orange"
            disabled={loading}
            style={{ marginTop: '20px', width: '100%' }}
          >
            {loading
              ? <><Loader2 className="spinner" size={18} /> Saving...</>
              : 'Submit Waste Report'
            }
          </button>
        </form>
      </div>

      {/* ── Right Column ── */}
      <div className="right-column">
        <SkipCountsCard messName={profile?.mess_name} />

        {/* ✅ Submission Window — fully inline styles, no CSS class dependency */}
        <div style={{
          background:   'var(--bg-card)',
          borderRadius: '16px',
          borderLeft:   '5px solid #e67e22',
          border:       '1px solid var(--border-color)',
          borderLeftWidth: '5px',
          borderLeftColor: '#e67e22',
          padding:      '24px',
          boxShadow:    '0 4px 20px rgba(0,0,0,0.05)',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              background:     'rgba(230, 126, 34, 0.1)',
              color:          '#e67e22',
              padding:        '8px',
              borderRadius:   '10px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              <Clock size={20} strokeWidth={2.5} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Submission Window
            </h3>
          </div>

          {/* Time rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Breakfast', time: 'After 11:00 AM' },
              { label: 'Lunch',     time: 'After 3:00 PM'  },
              { label: 'Dinner',    time: 'After 10:30 PM' },
            ].map(({ label, time }) => (
              <div key={label} style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                paddingBottom:  '8px',
                borderBottom:   '1px solid var(--border-color)',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  {label}
                </span>
                <span style={{
                  fontWeight:      700,
                  color:           '#e67e22',
                  fontSize:        '0.85rem',
                  background:      'rgba(230, 126, 34, 0.08)',
                  padding:         '4px 12px',
                  borderRadius:    '20px',
                  textTransform:   'uppercase',
                  letterSpacing:   '0.03em',
                }}>
                  {time}
                </span>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p style={{
            marginTop:   '18px',
            marginBottom: 0,
            fontSize:    '0.75rem',
            color:       'var(--text-muted)',
            fontStyle:   'italic',
          }}>
            Reports cannot be submitted before these times.
          </p>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast.show && (
        <div style={{
          position:        'fixed',
          bottom:          '20px',
          right:           '20px',
          backgroundColor: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
          color:           toast.type === 'error' ? '#991b1b' : '#166534',
          border:          `1px solid ${toast.type === 'error' ? '#f87171' : '#4ade80'}`,
          padding:         '12px 20px',
          borderRadius:    '8px',
          zIndex:          1000,
          display:         'flex',
          alignItems:      'center',
          gap:             '10px',
          boxShadow:       '0 4px 12px rgba(0,0,0,0.1)',
          animation:       'slideIn 0.3s ease-out',
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span style={{ fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LogWasteView;