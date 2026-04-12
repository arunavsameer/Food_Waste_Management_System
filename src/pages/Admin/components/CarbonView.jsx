import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Leaf, Factory, Trash2, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Wind, Settings, Plus, Loader2, ShieldAlert } from 'lucide-react';

const KG_PER_TONNE = 1000;
const BWG_THRESHOLD_KG = 100; // SWM 2026 Bulk Waste Generator threshold

// SWM 2026 Compliant Default Hyperparameters
const DEFAULT_FACTORS = {
  baseline: {
    unmanaged: { id: 'unmanaged', label: 'Municipal Landfill (Baseline)', value: 0.8, isDefault: true },
  },
  project: {
    onsite_biogas: { id: 'onsite_biogas', label: 'On-Site Bio-Methanation', value: -0.1, isDefault: true },
    onsite_compost: { id: 'onsite_compost', label: 'On-Site Composting', value: 0.15, isDefault: true },
    offsite_ebwgr: { id: 'offsite_ebwgr', label: 'Off-Site EBWGR Processing', value: 0.25, isDefault: true },
  }
};

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const toLocalISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

const CarbonView = () => {
  // ── States ───────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate]   = useState(new Date());
  const [caterersList, setCaterersList] = useState([]);
  const [selectedCaterer, setSelectedCaterer] = useState('all');
  const [reportRows, setReportRows]     = useState([]);
  const [loading, setLoading]           = useState(false);

  // Dynamic Factors State
  const [customFactors, setCustomFactors] = useState([]);
  const [baselineMethod, setBaselineMethod] = useState('unmanaged');
  const [projectMethod, setProjectMethod]   = useState('onsite_biogas');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('calculator');
  const [savingEF, setSavingEF] = useState(false);
  
  // ── Toast State ──────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  
  // Calculator Form State
  const [calcForm, setCalcForm] = useState({
    category: 'project',
    name: '',
    process_ef: -0.1,
    transport_km: 0, 
    transport_ef: 0.00015 
  });

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Fetch Initial Data ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('caterers').select('caterer_id, name').order('name')
      .then(({ data }) => { if (data) setCaterersList(data); });
      
    fetchCustomFactors();
  }, []);

  const fetchCustomFactors = async () => {
    const { data, error } = await supabase.from('custom_emission_factors').select('*').order('created_at', { ascending: false });
    if (error) console.error("Error fetching factors:", error);
    if (data) setCustomFactors(data);
  };

  // ── Fetch Waste Data ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      const startDate = toLocalISODate(new Date(year, month, 1));
      const endDate   = toLocalISODate(new Date(year, month + 1, 0));

      let query = supabase.from('waste_reports')
        .select('report_date, meal_type, plate_waste, kitchen_uncooked, kitchen_cooked, caterer_id')
        .gte('report_date', startDate)
        .lte('report_date', endDate);

      if (selectedCaterer !== 'all') query = query.eq('caterer_id', selectedCaterer);

      const { data, error } = await query;
      if (error) console.error("Error fetching reports:", error);
      
      if (!cancelled) {
        setReportRows(data || []);
        setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [currentDate, selectedCaterer, year, month]);

  // ── Merge Factors & Calculate ────────────────────────────────────────────
  const allFactors = useMemo(() => {
    const merged = { baseline: { ...DEFAULT_FACTORS.baseline }, project: { ...DEFAULT_FACTORS.project } };
    customFactors.forEach(f => {
      merged[f.category][f.id] = { id: f.id, label: `${f.name} (Custom)`, value: Number(f.calculated_ef), isDefault: false };
    });
    return merged;
  }, [customFactors]);

  const metrics = useMemo(() => {
    let uncooked = 0, cooked = 0, plate = 0;

    reportRows.forEach(r => {
      uncooked += Number(r.kitchen_uncooked || 0);
      cooked   += Number(r.kitchen_cooked || 0);
      plate    += Number(r.plate_waste || 0);
    });

    const totalWaste = uncooked + cooked + plate; 
    const uniqueDays = new Set(reportRows.map(r => r.report_date)).size || 1; 
    const dailyAverage = totalWaste / uniqueDays;
    const isBWG = dailyAverage >= BWG_THRESHOLD_KG;

    const baseEF = allFactors.baseline[baselineMethod]?.value ?? DEFAULT_FACTORS.baseline.unmanaged.value;
    const projEF = allFactors.project[projectMethod]?.value ?? DEFAULT_FACTORS.project.onsite_biogas.value;

    const baselineEmissions = (uncooked * (baseEF * 0.9)) + (cooked * (baseEF * 1.1)) + (plate * (baseEF * 1.1));
    const projectEmissions = (uncooked * (projEF * 0.9)) + (cooked * (projEF * 1.1)) + (plate * (projEF * 1.1));

    const emissionsAvoided = baselineEmissions - projectEmissions;
    const credits = emissionsAvoided > 0 ? emissionsAvoided / KG_PER_TONNE : 0;

    return { 
      totalWaste, dailyAverage, uniqueDays, isBWG, uncooked, cooked, plate,
      baselineEmissions, projectEmissions, emissionsAvoided, credits,
      uPct: totalWaste ? (uncooked / totalWaste) * 100 : 0,
      cPct: totalWaste ? (cooked / totalWaste) * 100 : 0,
      pPct: totalWaste ? (plate / totalWaste) * 100 : 0
    };
  }, [reportRows, baselineMethod, projectMethod, allFactors]);

  const fmt = (n, decimals = 1) => Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  
  const currentCalculatedEF = useMemo(() => {
    return Number(calcForm.process_ef) + (Number(calcForm.transport_km) * Number(calcForm.transport_ef));
  }, [calcForm]);

  // ── Toast Trigger ────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveFactor = async () => {
    if (!calcForm.name.trim()) return;
    setSavingEF(true);
    
    const { data, error } = await supabase.from('custom_emission_factors').insert([{
      name: calcForm.name,
      category: calcForm.category,
      process_ef: calcForm.process_ef,
      transport_km: calcForm.transport_km,
      transport_ef: calcForm.transport_ef,
      calculated_ef: currentCalculatedEF
    }]).select().single();

    if (error) {
      console.error("Supabase Save Error:", error);
      showToast(`Database Error: ${error.message}`, 'error');
    } else if (data) {
      setCustomFactors([data, ...customFactors]);
      if (data.category === 'baseline') setBaselineMethod(data.id);
      else setProjectMethod(data.id);
      
      setCalcForm({ category: 'project', name: '', process_ef: -0.1, transport_km: 0, transport_ef: 0.00015 });
      setIsModalOpen(false);
      showToast('Configuration preset saved successfully!', 'success');
    }
    
    setSavingEF(false);
  };

  const handleDeleteFactor = async (id, category) => {
    const { error } = await supabase.from('custom_emission_factors').delete().eq('id', id);
    
    if (error) {
      console.error("Delete Error:", error);
      showToast(`Failed to remove parameter: ${error.message}`, 'error');
    } else {
      setCustomFactors(customFactors.filter(f => f.id !== id));
      if (baselineMethod === id) setBaselineMethod('unmanaged');
      if (projectMethod === id) setProjectMethod('onsite_biogas');
      showToast('Configuration preset removed.', 'success');
    }
  };

  return (
    <div className="carbon-view-wrapper">
      
      {/* Header */}
      <div className="carbon-header">
        <div>
          <h2>SWM 2026 Compliance & Carbon Insights</h2>
          <p className="carbon-subtitle">Track mess waste limits and potential carbon credits</p>
        </div>
        <div className="carbon-controls">
          <div className="pill-nav">
            <button className="icon-btn" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
            <span className="pill-label">{monthNames[month]} {year}</span>
            <button className="icon-btn" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* SWM 2026 Alert */}
      {metrics.isBWG && (
        <div className="credits-banner" style={{ background: 'rgba(231, 76, 60, 0.05)', borderColor: 'rgba(231, 76, 60, 0.3)', padding: '16px 24px', marginTop: '0' }}>
          <ShieldAlert size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}>BWG Threshold Exceeded</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Generating an average of <strong>{fmt(metrics.dailyAverage)} kg/day</strong> over {metrics.uniqueDays} operating days this month. Under SWM Rules 2026, the campus is legally classified as a Bulk Waste Generator and must process this wet waste on-site.
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="pill-filter-group">
        <button className={`filter-pill ${selectedCaterer === 'all' ? 'active' : ''}`} onClick={() => setSelectedCaterer('all')}>All Campus Caterers</button>
        {caterersList.map(c => (
          <button key={c.caterer_id} className={`filter-pill ${selectedCaterer === c.caterer_id ? 'active' : ''}`} onClick={() => setSelectedCaterer(c.caterer_id)}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Configurations */}
      <div className="carbon-config-panel">
        <div className="config-group">
          <label className="form-label"><Factory size={14}/> Baseline Scenario</label>
          <select className="form-select" value={baselineMethod} onChange={(e) => setBaselineMethod(e.target.value)}>
            {Object.values(allFactors.baseline).map(f => (
              <option key={f.id} value={f.id}>{f.label} (EF: {fmt(f.value, 3)})</option>
            ))}
          </select>
        </div>

        <div className="config-group">
          <label className="form-label"><Leaf size={14}/> Project Disposal</label>
          <div className="form-group-inline">
            <select className="form-select flex-fill" value={projectMethod} onChange={(e) => setProjectMethod(e.target.value)}>
              {Object.values(allFactors.project).map(f => (
                <option key={f.id} value={f.id}>{f.label} (EF: {fmt(f.value, 3)})</option>
              ))}
            </select>
            <button className="btn-ghost btn-icon-only" onClick={() => { setIsModalOpen(true); setActiveTab('calculator'); }} title="Manage EF Parameters">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      {loading ? (
        <div className="admin-loading"><div className="spin"><Wind size={24} /></div> Analyzing SWM compliance...</div>
      ) : metrics.totalWaste === 0 ? (
        <div className="admin-empty"><Trash2 size={32} className="admin-empty-icon" /><p>No waste recorded for this period.</p></div>
      ) : (
        <>
          <div className="stats-grid carbon-stats-grid">
            <div className="stat-card">
              <div className="stat-icon yellow"><Trash2 size={20} /></div>
              <div className="stat-label">Monthly Wet Waste</div>
              <div className="stat-value">{fmt(metrics.totalWaste)} <span className="stat-unit">kg</span></div>
              <div className="stacked-bar-container">
                <div className="stacked-bar-segment green" style={{ width: `${metrics.uPct}%` }} title={`Uncooked: ${fmt(metrics.uPct)}%`} />
                <div className="stacked-bar-segment blue" style={{ width: `${metrics.cPct}%` }} title={`Cooked: ${fmt(metrics.cPct)}%`} />
                <div className="stacked-bar-segment red" style={{ width: `${metrics.pPct}%` }} title={`Plate: ${fmt(metrics.pPct)}%`} />
              </div>
              <div className="stacked-bar-legend">
                <span><span className="legend-dot green"></span> Uncooked</span>
                <span><span className="legend-dot blue"></span> Cooked</span>
                <span><span className="legend-dot red"></span> Plate</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon red"><AlertCircle size={20} /></div>
              <div className="stat-label">Monthly Baseline Emissions</div>
              <div className="stat-value">{fmt(metrics.baselineEmissions)} <span className="stat-unit">kg CO₂e</span></div>
              <div className="stat-sub">Estimated emissions from municipal landfilling</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue"><CheckCircle size={20} /></div>
              <div className="stat-label">Monthly Project Emissions</div>
              <div className="stat-value">{fmt(metrics.projectEmissions)} <span className="stat-unit">kg CO₂e</span></div>
              <div className="stat-sub">Estimated emissions with selected intervention</div>
            </div>
          </div>

          <div className={`credits-banner ${metrics.credits > 0 ? 'success' : 'neutral'}`}>
            <div className="credits-banner-icon"><Leaf size={32} /></div>
            <div className="credits-banner-content">
              <div className="credits-label">Potential Carbon Credits Generated (This Month)</div>
              <div className="credits-value">{fmt(metrics.credits, 3)} <span className="credits-unit">Tonnes CO₂e</span></div>
              <div className="credits-sub">
                {metrics.credits > 0 ? `Successfully avoided ${fmt(metrics.emissionsAvoided)} kg of carbon emissions compared to standard landfilling.` : `No credits generated. Project emissions exceed or match baseline emissions.`}
              </div>
            </div>
          </div>
        </>
      )}

      {/* EF Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box ef-modal">
            <div className="ef-modal-header">
              <div className="modal-title" style={{ margin: 0 }}>Emission Factor Manager</div>
              <div className="ef-tabs">
                <button className={`ef-tab ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => setActiveTab('calculator')}>Calculate New</button>
                <button className={`ef-tab ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>Manage Saved</button>
              </div>
            </div>

            {activeTab === 'calculator' ? (
              <div className="ef-calculator-form">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={calcForm.category} onChange={e => setCalcForm({...calcForm, category: e.target.value})}>
                    <option value="project">Project Scenario (Intervention)</option>
                    <option value="baseline">Baseline Scenario (Status Quo)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Configuration Name</label>
                  <input type="text" className="form-input" placeholder="e.g., EBWGR Off-Site Processing" value={calcForm.name} onChange={e => setCalcForm({...calcForm, name: e.target.value})} />
                </div>

                <div className="ef-calc-grid">
                  <div className="form-group">
                    <label className="form-label">Process Emissions (kg CO₂e/kg)</label>
                    <input type="number" step="0.01" className="form-input" value={calcForm.process_ef} onChange={e => setCalcForm({...calcForm, process_ef: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transport Distance (km)</label>
                    <input type="number" className="form-input" value={calcForm.transport_km} onChange={e => setCalcForm({...calcForm, transport_km: e.target.value})} />
                  </div>
                </div>

                <div className="ef-result-box">
                  <div className="ef-formula">EF = Process + (Distance × 0.00015)</div>
                  <div className="ef-final-value">{fmt(currentCalculatedEF, 4)} <span>Final EF</span></div>
                </div>

                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button className="btn-primary" onClick={handleSaveFactor} disabled={savingEF || !calcForm.name.trim()}>
                    {savingEF ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Save Factor
                  </button>
                </div>
              </div>
            ) : (
              <div className="ef-manage-list">
                {customFactors.length === 0 ? (
                  <div className="admin-empty" style={{ padding: '30px 0' }}>No custom factors saved.</div>
                ) : (
                  customFactors.map(f => (
                    <div key={f.id} className="ef-list-item">
                      <div className="ef-item-info">
                        <strong>{f.name}</strong>
                        <span className={`role-pill ${f.category === 'baseline' ? 'admin' : 'caterer'}`}>{f.category}</span>
                        <div className="ef-item-sub">EF: {fmt(f.calculated_ef, 4)} (Process: {f.process_ef}, Distance: {f.transport_km}km)</div>
                      </div>
                      <button className="icon-btn" style={{ color: 'var(--danger)', borderColor: 'transparent' }} onClick={() => handleDeleteFactor(f.id, f.category)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Toast toasts={toasts} />

    </div>
  );
};

export default CarbonView;