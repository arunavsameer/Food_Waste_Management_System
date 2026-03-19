import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Loader2, Users, Plus, Pencil, RefreshCw, X, Check,
  User, Lock, Utensils, Hash, Building, UserCircle, Phone
} from 'lucide-react';

const ROLES = ['student', 'caterer', 'admin'];
const HOSTELS = ['APJ', 'CVR', 'DA', 'VSB', 'HJB', 'JCB', 'PM Ajay', 'Others'];
const FOOD_TYPES = ['veg', 'non_veg', 'jain'];

const emptyForm = {
  email: '', password: '', role: 'student', mess_name: '',
  name: '', roll_no: '', hostel: 'APJ', food_type: 'veg',
  manager_name: '', phone_no: '',
};

const UsersView = ({ triggerToast }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, mess_name, created_at, students(name, roll_no, hostel, food_type)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const filtered = profiles.filter(p => {
    const matchRole = filterRole === 'all' || p.role === filterRole;
    const name = p.students?.name || '';
    const matchSearch =
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      p.mess_name?.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setModalError('');
    setModal('add');
  };

  const openEdit = (p) => {
    setForm({
      email: p.email || '',
      password: '',
      role: p.role || 'student',
      mess_name: p.mess_name || '',
      name: p.students?.name || '',
      roll_no: p.students?.roll_no || '',
      hostel: p.students?.hostel || 'APJ',
      food_type: p.students?.food_type || 'veg',
      manager_name: '',
      phone_no: '',
    });
    setEditId(p.id);
    setModalError('');
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setModalError(''); };

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // ── ADD new user (mirrors Register.jsx logic) ──
  const handleAdd = async () => {
    setSaving(true);
    setModalError('');
    try {
      let catererId = null;
      if (form.role === 'student') {
        const { data: existing } = await supabase
          .from('students').select('roll_no').eq('roll_no', form.roll_no).maybeSingle();
        if (existing) throw new Error(`Roll number ${form.roll_no} already exists.`);

        const { data: cat } = await supabase
          .from('caterers').select('caterer_id').eq('name', form.mess_name).single();
        if (!cat) throw new Error(`Mess "${form.mess_name}" does not exist.`);
        catererId = cat.caterer_id;
      }

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
      });
      if (authErr) throw authErr;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Auth user creation failed.');

      const { error: profErr } = await supabase.from('profiles').insert([{
        id: userId, email: form.email, role: form.role,
        mess_name: form.role === 'admin' ? null : form.mess_name,
      }]);
      if (profErr) throw profErr;

      if (form.role === 'student') {
        const { error: stuErr } = await supabase.from('students').insert([{
          id: userId, roll_no: form.roll_no, name: form.name,
          hostel: form.hostel, food_type: form.food_type, caterer_id: catererId,
        }]);
        if (stuErr) throw stuErr;
      } else if (form.role === 'caterer') {
        const { error: catErr } = await supabase.from('caterers').insert([{
          caterer_id: userId, name: form.mess_name,
          manager_name: form.manager_name, phone_no: form.phone_no,
        }]);
        if (catErr) throw catErr;
      }

      triggerToast('success', 'User created successfully!');
      closeModal();
      fetchProfiles();
    } catch (err) {
      setModalError(err.message || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  // ── EDIT profile (update mess_name + student name/hostel/food_type) ──
  const handleEdit = async () => {
    setSaving(true);
    setModalError('');
    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ mess_name: form.role === 'admin' ? null : form.mess_name })
        .eq('id', editId);
      if (profErr) throw profErr;

      if (form.role === 'student') {
        const { error: stuErr } = await supabase
          .from('students')
          .update({ name: form.name, hostel: form.hostel, food_type: form.food_type })
          .eq('id', editId);
        if (stuErr) throw stuErr;
      }

      triggerToast('success', 'User updated successfully!');
      closeModal();
      fetchProfiles();
    } catch (err) {
      setModalError(err.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => modal === 'add' ? handleAdd() : handleEdit();

  const getInitials = (email, name) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    }
    return (email || 'U').slice(0, 2).toUpperCase();
  };

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
            <input
              className="admin-search"
              placeholder="Search by name, email, mess…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="admin-filter-select"
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <button className="icon-btn" onClick={fetchProfiles} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading">
            <Loader2 size={20} className="spin" /> Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <Users size={48} className="admin-empty-icon" />
            <p style={{ margin: 0, fontWeight: 600 }}>No users found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Mess / Affiliation</th>
                  <th>Details</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '8px', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-green))',
                          color: '#fff', fontWeight: 700, fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {getInitials(p.email, p.students?.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {p.students?.name || p.email?.split('@')[0]}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`role-pill ${p.role}`}>{p.role}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.mess_name || '—'}</td>
                    <td className="muted">
                      {p.role === 'student' && p.students && (
                        <span>{p.students.roll_no} · {p.students.hostel} · {p.students.food_type}</span>
                      )}
                    </td>
                    <td className="muted">
                      {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <button className="btn-edit" onClick={() => openEdit(p)}>
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-title">
              {modal === 'add' ? <Plus size={20} /> : <Pencil size={20} />}
              {modal === 'add' ? 'Add New User' : 'Edit User'}
            </div>

            <div className="modal-grid">
              {/* Email — always shown */}
              <div className="form-group full">
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email" name="email"
                  value={form.email} onChange={handleChange}
                  placeholder="user@college.edu"
                  disabled={modal === 'edit'}
                />
              </div>

              {/* Password — only on Add */}
              {modal === 'add' && (
                <div className="form-group full">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password" name="password"
                    value={form.password} onChange={handleChange}
                    placeholder="Min 6 characters"
                  />
                </div>
              )}

              {/* Role — only on Add */}
              {modal === 'add' && (
                <div className="form-group full">
                  <label className="form-label">Role</label>
                  <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              )}

              {/* Student fields */}
              {form.role === 'student' && (
                <>
                  <div className="form-group full">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" type="text" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" />
                  </div>
                  {modal === 'add' && (
                    <div className="form-group">
                      <label className="form-label">Roll Number</label>
                      <input className="form-input" type="text" name="roll_no" value={form.roll_no} onChange={handleChange} placeholder="2023CSB1001" />
                    </div>
                  )}
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
                    <label className="form-label">Mess Name</label>
                    <input className="form-input" type="text" name="mess_name" value={form.mess_name} onChange={handleChange} placeholder="Mess Name" />
                  </div>
                </>
              )}

              {/* Caterer fields */}
              {form.role === 'caterer' && (
                <>
                  <div className="form-group full">
                    <label className="form-label">Mess Name</label>
                    <input className="form-input" type="text" name="mess_name" value={form.mess_name} onChange={handleChange} placeholder="Your Mess Name" />
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
            </div>

            {modalError && <div className="modal-error">{modalError}</div>}

            <div className="modal-actions">
              <button className="btn-ghost" onClick={closeModal} disabled={saving}>
                <X size={15} /> Cancel
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                {modal === 'add' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;