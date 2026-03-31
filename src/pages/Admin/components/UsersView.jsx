import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Users, Plus, Pencil, RefreshCw, X, Check,
} from 'lucide-react';

const ROLES = ['student', 'caterer', 'admin'];
const HOSTELS = ['APJ', 'CVR', 'DA', 'VSB', 'HJB', 'JCB', 'PM Ajay', 'Others'];
const FOOD_TYPES = ['veg', 'non_veg', 'jain'];

const emptyForm = {
  email: '', role: 'student', mess_name: '',
  hostel: 'APJ', food_type: 'veg',
  manager_name: '', phone_no: '',
  admin_name: '', admin_phone_no: '',
};

const UsersView = ({ triggerToast }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [modal, setModal] = useState(null); 
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [isPendingEdit, setIsPendingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data: activeUsers, error: err1 } = await supabase
        .from('profiles')
        .select('id, email, role, mess_name, created_at, students(name, roll_no, hostel, food_type), admins(name, phone_no), caterers(manager_name, phone_no)')
        .order('created_at', { ascending: false });
      if (err1) throw err1;

      const { data: pendingUsers, error: err2 } = await supabase
        .from('pre_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (err2) throw err2;

      const combined = [
        ...(activeUsers || []).map(p => ({ ...p, status: 'Active' })),
        ...(pendingUsers || []).map(p => ({
          id: p.email, 
          email: p.email,
          role: p.role,
          mess_name: p.mess_name,
          status: 'Pending',
          created_at: p.created_at,
          students: p.role === 'student' ? { hostel: p.hostel, food_type: p.food_type } : null,
          caterers: p.role === 'caterer' ? { manager_name: p.manager_name, phone_no: p.phone_no } : null,
          admins: p.role === 'admin' ? { name: p.admin_name, phone_no: p.phone_no } : null
        }))
      ];
      
      setProfiles(combined);
    } catch (err) {
      console.error("Fetch Profiles Error:", err);
      if (typeof triggerToast === 'function') triggerToast('error', 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const filtered = profiles.filter(p => {
    const matchRole = filterRole === 'all' || p.role === filterRole;
    const name = p.students?.name || p.admins?.name || '';
    const matchSearch =
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.mess_name?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setIsPendingEdit(false);
    setModalError('');
    setModal('add');
  };

  const openEdit = (p) => {
    setForm({
      email: p.email || '',
      role: p.role || 'student',
      mess_name: p.mess_name || '',
      hostel: p.students?.hostel || 'APJ',
      food_type: p.students?.food_type || 'veg',
      manager_name: p.caterers?.manager_name || '',
      phone_no: p.caterers?.phone_no || '',
      admin_name: p.admins?.name || '',
      admin_phone_no: p.admins?.phone_no || '',
    });
    setEditId(p.id);
    setIsPendingEdit(p.status === 'Pending');
    setModalError('');
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setModalError(''); };
  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // ── ADD: BULLETPROOF PRE-CHECKS ──
  const handleAdd = async () => {
    setSaving(true);
    setModalError('');
    try {
      if (!form.email) throw new Error("Email address is required.");
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanMessName = form.mess_name?.trim() || '';
      
      if (form.role === 'student' && !cleanEmail.endsWith('@iiti.ac.in')) {
        throw new Error('Students must use an @iiti.ac.in email address.');
      }

      // 1. Pre-check: Does email exist ANYWHERE?
      const { data: exist1, error: err1 } = await supabase.from('profiles').select('email').eq('email', cleanEmail).limit(1);
      if (err1) throw new Error("DB Check Error: " + err1.message);
      if (exist1?.length > 0) throw new Error("This email is already registered as an active user.");

      const { data: exist2, error: err2 } = await supabase.from('pre_registrations').select('email').eq('email', cleanEmail).limit(1);
      if (err2) throw new Error("DB Check Error: " + err2.message);
      if (exist2?.length > 0) throw new Error("This email is already in the pending registrations list.");

      let catererId = null;

      // 2. Pre-check: Student validation
      if (form.role === 'student') {
        if (!cleanMessName) throw new Error("Student requires a mess name to subscribe to.");
        
        const { data: cats, error: catErr } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
        if (catErr) throw new Error("DB Check Error: " + catErr.message);
        if (!cats || cats.length === 0) throw new Error(`Caterer/Mess "${cleanMessName}" not found. Verify spelling.`);
        catererId = cats[0].caterer_id;
      }

      // 3. Pre-check: Caterer duplication check (Case Insensitive)
      if (form.role === 'caterer') {
        if (!cleanMessName) throw new Error("Please enter a Mess Name for this caterer.");
        
        // Is it already active?
        const { data: activeCats, error: actErr } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
        if (actErr) throw new Error("DB Check Error: " + actErr.message);
        if (activeCats?.length > 0) throw new Error(`An active caterer named "${cleanMessName}" already exists.`);

        // Is it already pending?
        const { data: pendingCats, error: pendErr } = await supabase.from('pre_registrations').select('email').eq('role', 'caterer').ilike('mess_name', cleanMessName).limit(1);
        if (pendErr) throw new Error("DB Check Error: " + pendErr.message);
        if (pendingCats?.length > 0) throw new Error(`A pending caterer named "${cleanMessName}" is already registered.`);
      }

      // 4. Final Insert
      const { error: insertErr } = await supabase.from('pre_registrations').insert([{
        email: cleanEmail,
        role: form.role,
        mess_name: form.role === 'admin' ? null : cleanMessName,
        caterer_id: catererId,
        hostel: form.role === 'student' ? form.hostel : null,
        food_type: form.role === 'student' ? form.food_type : null,
        manager_name: form.role === 'caterer' ? form.manager_name?.trim() || null : null,
        phone_no: form.role === 'caterer' ? form.phone_no?.trim() || null : (form.role === 'admin' ? form.admin_phone_no?.trim() || null : null),
        admin_name: form.role === 'admin' ? form.admin_name?.trim() || null : null
      }]);

      if (insertErr) throw new Error("Failed to insert record: " + insertErr.message);

      if (typeof triggerToast === 'function') triggerToast('success', 'User pre-registered successfully!');
      closeModal();
      fetchProfiles();
    } catch (err) {
      console.error("Add User Error:", err);
      setModalError(err.message || 'Failed to add user.');
    } finally {
      setSaving(false); 
    }
  };

  // ── EDIT: BULLETPROOF PRE-CHECKS ──
  const handleEdit = async () => {
    setSaving(true);
    setModalError('');
    try {
      const cleanMessName = form.mess_name?.trim() || '';

      // Protect against renaming caterer to an already existing name
      if (form.role === 'caterer') {
        if (!cleanMessName) throw new Error("Mess name is required.");

        if (isPendingEdit) {
           // Ensure no OTHER pending or active caterer has this name
           const { data: checkPend } = await supabase.from('pre_registrations').select('email').eq('role', 'caterer').ilike('mess_name', cleanMessName).neq('email', editId).limit(1);
           if (checkPend?.length > 0) throw new Error(`Another pending caterer already uses the name "${cleanMessName}".`);
           
           const { data: checkAct } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
           if (checkAct?.length > 0) throw new Error(`An active caterer already uses the name "${cleanMessName}".`);
        } else {
           // Ensure no OTHER active or pending caterer has this name
           const { data: checkAct } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).neq('caterer_id', editId).limit(1);
           if (checkAct?.length > 0) throw new Error(`Another active caterer already uses the name "${cleanMessName}".`);
           
           const { data: checkPend } = await supabase.from('pre_registrations').select('email').eq('role', 'caterer').ilike('mess_name', cleanMessName).limit(1);
           if (checkPend?.length > 0) throw new Error(`A pending caterer already uses the name "${cleanMessName}".`);
        }
      }

      if (isPendingEdit) {
        // Edit Pending User
        const { error } = await supabase.from('pre_registrations').update({
          mess_name: form.role === 'admin' ? null : cleanMessName,
          hostel: form.role === 'student' ? form.hostel : null,
          food_type: form.role === 'student' ? form.food_type : null,
          manager_name: form.role === 'caterer' ? form.manager_name?.trim() || null : null,
          phone_no: form.role === 'caterer' ? form.phone_no?.trim() || null : (form.role === 'admin' ? form.admin_phone_no?.trim() || null : null),
          admin_name: form.role === 'admin' ? form.admin_name?.trim() || null : null
        }).eq('email', editId);
        if (error) throw new Error("Update failed: " + error.message);
      } else {
        // Edit Active User
        const { error: profErr } = await supabase.from('profiles').update({ mess_name: form.role === 'admin' ? null : cleanMessName }).eq('id', editId);
        if (profErr) throw new Error("Profile update failed: " + profErr.message);

        if (form.role === 'student') {
          let newCatererId = null;
          if (cleanMessName) {
            const { data: cats } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
            if (!cats || cats.length === 0) throw new Error(`Caterer "${cleanMessName}" not found.`);
            newCatererId = cats[0].caterer_id;
          }
          const { error: stuErr } = await supabase.from('students').update({ hostel: form.hostel, food_type: form.food_type, caterer_id: newCatererId }).eq('id', editId);
          if (stuErr) throw new Error("Student update failed: " + stuErr.message);
          
        } else if (form.role === 'caterer') {
          const { error: catErr } = await supabase.from('caterers')
            .update({ name: cleanMessName, manager_name: form.manager_name?.trim() || null, phone_no: form.phone_no?.trim() || null }).eq('caterer_id', editId);
          if (catErr) throw new Error("Caterer update failed: " + catErr.message);

        } else if (form.role === 'admin') {
          const { error: admErr } = await supabase.from('admins')
            .update({ name: form.admin_name?.trim() || null, phone_no: form.admin_phone_no?.trim() || null }).eq('admin_id', editId);
          if (admErr) throw new Error("Admin update failed: " + admErr.message);
        }
      }

      if (typeof triggerToast === 'function') triggerToast('success', 'User updated successfully!');
      closeModal();
      fetchProfiles();
    } catch (err) {
      console.error("Edit User Error:", err);
      setModalError(err.message || 'Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => modal === 'add' ? handleAdd() : handleEdit();

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', marginBottom: '20px' }}>
        {['student', 'caterer', 'admin'].map(role => {
          const count = profiles.filter(p => p.role === role).length;
          const colorMap = { student: 'blue', caterer: 'green', admin: 'red' };
          return (
            <div className="stat-card" key={role}>
              <div className={`stat-icon ${colorMap[role]}`}><Users size={20} /></div>
              <div className="stat-label">{role}s</div>
              <div className="stat-value">{count}</div>
            </div>
          );
        })}
        <div className="stat-card">
          <div className="stat-icon yellow"><Users size={20} /></div>
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{profiles.length}</div>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h3>All Users</h3>
          <div className="admin-table-actions">
            <input className="admin-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <button className="icon-btn" onClick={fetchProfiles} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-primary" onClick={openAdd}>
              <Plus size={16} /> Pre-Register User
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading users…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Mess</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {p.students?.name || p.admins?.name || p.caterers?.manager_name || p.email?.split('@')[0].toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                      </div>
                    </td>
                    <td><span className={`role-pill ${p.role}`}>{p.role}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.mess_name || '—'}</td>
                    <td className="muted">
                      {p.role === 'student' && p.students && <span>{p.students.hostel} · {p.students.food_type}</span>}
                      {p.role === 'caterer' && p.caterers && <span>{p.caterers.phone_no || '—'}</span>}
                      {p.role === 'admin' && p.admins && <span>{p.admins.phone_no || '—'}</span>}
                    </td>
                    <td>
                      {p.status === 'Pending' ? (
                        <span style={{color: 'orange', fontSize: '12px', fontWeight: 'bold'}}>⏳ Pending</span>
                      ) : (
                        <span style={{color: 'green', fontSize: '12px', fontWeight: 'bold'}}>✓ Active</span>
                      )}
                    </td>
                    <td>
                      <button className="btn-edit" onClick={() => openEdit(p)}><Pencil size={13} /> Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-title">{modal === 'add' ? 'Pre-Register User' : 'Edit User'}</div>

            <div className="modal-grid">
              {modal === 'add' && (
                <div className="form-group full">
                  <label className="form-label">Role</label>
                  <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group full">
                <label className="form-label">Email Address {form.role === 'student' && '(Must be @iiti.ac.in)'}</label>
                <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} disabled={modal === 'edit'} />
              </div>

              {/* Student Fields */}
              {form.role === 'student' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Hostel</label>
                    <select className="form-select" name="hostel" value={form.hostel} onChange={handleChange}>
                      {HOSTELS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Food Type</label>
                    <select className="form-select" name="food_type" value={form.food_type} onChange={handleChange}>
                      {FOOD_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group full">
                    <label className="form-label">Mess Name (To Subscribe)</label>
                    <input className="form-input" type="text" name="mess_name" value={form.mess_name} onChange={handleChange} placeholder="e.g. APJ Mess" />
                  </div>
                </>
              )}

              {/* Caterer Fields */}
              {form.role === 'caterer' && (
                <>
                  <div className="form-group full">
                    <label className="form-label">Mess Name</label>
                    <input className="form-input" type="text" name="mess_name" value={form.mess_name} onChange={handleChange} placeholder="e.g. APJ Mess" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Manager Name</label>
                    <input className="form-input" type="text" name="manager_name" value={form.manager_name} onChange={handleChange} placeholder="Manager's Name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" type="tel" name="phone_no" value={form.phone_no} onChange={handleChange} placeholder="+91 98765 43210" />
                  </div>
                </>
              )}

              {/* Admin Fields */}
              {form.role === 'admin' && (
                <>
                  <div className="form-group full">
                    <label className="form-label">Admin Name</label>
                    <input className="form-input" type="text" name="admin_name" value={form.admin_name} onChange={handleChange} placeholder="Admin's Full Name" />
                  </div>
                  <div className="form-group full">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" type="tel" name="admin_phone_no" value={form.admin_phone_no} onChange={handleChange} placeholder="+91 98765 43210" />
                  </div>
                </>
              )}
            </div>

            {/* ERROR DISPLAY */}
            {modalError && (
              <div style={{
                color: 'var(--danger)', 
                backgroundColor: 'rgba(255, 0, 0, 0.1)', 
                padding: '10px', 
                borderRadius: '6px', 
                marginTop: '15px', 
                fontSize: '0.85rem',
                border: '1px solid rgba(255, 0, 0, 0.2)'
              }}>
                <strong>Error: </strong>{modalError}
              </div>
            )}

            <div className="modal-actions" style={{marginTop: 20}}>
              <button className="btn-ghost" onClick={closeModal} disabled={saving}><X size={15} /> Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;