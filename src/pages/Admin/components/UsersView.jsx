import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';
import {
  Loader2, Users, Plus, Pencil, RefreshCw, X, Check, Upload, AlertCircle, Trash2, AlertTriangle
} from 'lucide-react';

const ROLES = ['student', 'caterer', 'admin'];
const HOSTELS = ['APJ', 'CVR', 'DA', 'VSB', 'HJB', 'JCB', 'PM Ajay', 'Others'];
const FOOD_TYPES = ['regular', 'jain'];

const emptyForm = {
  email: '', role: 'student', mess_name: '',
  hostel: 'APJ', food_type: 'regular',
  manager_name: '', phone_no: '',
  admin_name: '', admin_phone_no: '',
};

const UsersView = ({ triggerToast }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  
  // Modal States
  const [modal, setModal] = useState(null); 
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [isPendingEdit, setIsPendingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  
  // Delete Modal State
  const [userToDelete, setUserToDelete] = useState(null);

  // XLS Bulk Upload State
  const [showXlsModal, setShowXlsModal] = useState(false);
  const [xlsData, setXlsData] = useState([]);
  const [isProcessingXls, setIsProcessingXls] = useState(false);
  const fileInputRef = useRef(null);

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

  // ── STANDARD ADD/EDIT/DELETE HANDLERS ──
  const openAdd = () => {
    setForm(emptyForm); setEditId(null); setIsPendingEdit(false);
    setModalError(''); setModal('add');
  };

  const openEdit = (p) => {
    setForm({
      email: p.email || '', role: p.role || 'student', mess_name: p.mess_name || '',
      hostel: p.students?.hostel || 'APJ', food_type: p.students?.food_type || 'regular',
      manager_name: p.caterers?.manager_name || '', phone_no: p.caterers?.phone_no || '',
      admin_name: p.admins?.name || '', admin_phone_no: p.admins?.phone_no || '',
    });
    setEditId(p.id); setIsPendingEdit(p.status === 'Pending');
    setModalError(''); setModal('edit');
  };

  const closeModal = () => { setModal(null); setModalError(''); };
  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleDelete = async () => {
    if (!userToDelete) return;
    setSaving(true);
    try {
      if (userToDelete.status === 'Pending') {
        const { error } = await supabase.from('pre_registrations').delete().eq('email', userToDelete.email);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('delete_user_admin', { user_id_to_delete: userToDelete.id });
        if (error) throw error;
      }
      
      if (typeof triggerToast === 'function') triggerToast('success', 'User completely deleted.');
      setUserToDelete(null);
      fetchProfiles();
    } catch (err) {
      console.error("Delete Error:", err);
      if (typeof triggerToast === 'function') triggerToast('error', 'Failed to delete user.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    setSaving(true); setModalError('');
    try {
      if (!form.email) throw new Error("Email address is required.");
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanMessName = form.mess_name?.trim() || '';
      
      if (form.role === 'student' && !cleanEmail.endsWith('@iiti.ac.in')) throw new Error('Students must use an @iiti.ac.in email address.');

      const { data: exist1 } = await supabase.from('profiles').select('email').eq('email', cleanEmail).limit(1);
      if (exist1?.length > 0) throw new Error("This email is already registered as an active user.");
      const { data: exist2 } = await supabase.from('pre_registrations').select('email').eq('email', cleanEmail).limit(1);
      if (exist2?.length > 0) throw new Error("This email is already pending.");

      let catererId = null;
      if (form.role === 'student') {
        if (!cleanMessName) throw new Error("Student requires a mess name to subscribe to.");
        const { data: cats } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
        if (!cats || cats.length === 0) throw new Error(`Caterer/Mess "${cleanMessName}" not found.`);
        catererId = cats[0].caterer_id;
      }

      if (form.role === 'caterer') {
        if (!cleanMessName) throw new Error("Please enter a Mess Name for this caterer.");
        const { data: activeCats } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
        if (activeCats?.length > 0) throw new Error(`An active caterer named "${cleanMessName}" already exists.`);
        const { data: pendingCats } = await supabase.from('pre_registrations').select('email').eq('role', 'caterer').ilike('mess_name', cleanMessName).limit(1);
        if (pendingCats?.length > 0) throw new Error(`A pending caterer named "${cleanMessName}" is already registered.`);
      }

      const { error: insertErr } = await supabase.from('pre_registrations').insert([{
        email: cleanEmail, role: form.role,
        mess_name: form.role === 'admin' ? null : cleanMessName, caterer_id: catererId,
        hostel: form.role === 'student' ? form.hostel : null, food_type: form.role === 'student' ? form.food_type : null,
        manager_name: form.role === 'caterer' ? form.manager_name?.trim() || null : null,
        phone_no: form.role === 'caterer' ? form.phone_no?.trim() || null : (form.role === 'admin' ? form.admin_phone_no?.trim() || null : null),
        admin_name: form.role === 'admin' ? form.admin_name?.trim() || null : null
      }]);
      if (insertErr) throw new Error("Failed to insert record: " + insertErr.message);

      if (typeof triggerToast === 'function') triggerToast('success', 'User pre-registered successfully!');
      closeModal(); fetchProfiles();
    } catch (err) { setModalError(err.message || 'Failed to add user.'); } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    setSaving(true); setModalError('');
    try {
      const cleanMessName = form.mess_name?.trim() || '';
      if (form.role === 'caterer') {
        if (!cleanMessName) throw new Error("Mess name is required.");
        if (isPendingEdit) {
           const { data: checkPend } = await supabase.from('pre_registrations').select('email').eq('role', 'caterer').ilike('mess_name', cleanMessName).neq('email', editId).limit(1);
           if (checkPend?.length > 0) throw new Error(`Another pending caterer already uses the name "${cleanMessName}".`);
           const { data: checkAct } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
           if (checkAct?.length > 0) throw new Error(`An active caterer already uses the name "${cleanMessName}".`);
        } else {
           const { data: checkAct } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).neq('caterer_id', editId).limit(1);
           if (checkAct?.length > 0) throw new Error(`Another active caterer already uses the name "${cleanMessName}".`);
           const { data: checkPend } = await supabase.from('pre_registrations').select('email').eq('role', 'caterer').ilike('mess_name', cleanMessName).limit(1);
           if (checkPend?.length > 0) throw new Error(`A pending caterer already uses the name "${cleanMessName}".`);
        }
      }

      if (isPendingEdit) {
        const { error } = await supabase.from('pre_registrations').update({
          mess_name: form.role === 'admin' ? null : cleanMessName,
          hostel: form.role === 'student' ? form.hostel : null, food_type: form.role === 'student' ? form.food_type : null,
          manager_name: form.role === 'caterer' ? form.manager_name?.trim() || null : null,
          phone_no: form.role === 'caterer' ? form.phone_no?.trim() || null : (form.role === 'admin' ? form.admin_phone_no?.trim() || null : null),
          admin_name: form.role === 'admin' ? form.admin_name?.trim() || null : null
        }).eq('email', editId);
        if (error) throw new Error("Update failed: " + error.message);
      } else {
        const { error: profErr } = await supabase.from('profiles').update({ mess_name: form.role === 'admin' ? null : cleanMessName }).eq('id', editId);
        if (profErr) throw new Error("Profile update failed: " + profErr.message);

        if (form.role === 'student') {
          let newCatererId = null;
          if (cleanMessName) {
            const { data: cats } = await supabase.from('caterers').select('caterer_id').ilike('name', cleanMessName).limit(1);
            if (!cats || cats.length === 0) throw new Error(`Caterer "${cleanMessName}" not found.`);
            newCatererId = cats[0].caterer_id;
          }
          await supabase.from('students').update({ hostel: form.hostel, food_type: form.food_type, caterer_id: newCatererId }).eq('id', editId);
        } else if (form.role === 'caterer') {
          await supabase.from('caterers').update({ name: cleanMessName, manager_name: form.manager_name?.trim() || null, phone_no: form.phone_no?.trim() || null }).eq('caterer_id', editId);
        } else if (form.role === 'admin') {
          await supabase.from('admins').update({ name: form.admin_name?.trim() || null, phone_no: form.admin_phone_no?.trim() || null }).eq('admin_id', editId);
        }
      }

      if (typeof triggerToast === 'function') triggerToast('success', 'User updated successfully!');
      closeModal(); fetchProfiles();
    } catch (err) { setModalError(err.message || 'Failed to update user.'); } finally { setSaving(false); }
  };
  const handleSubmit = () => modal === 'add' ? handleAdd() : handleEdit();

  // ── XLS BULK UPLOAD LOGIC ──
  const validateXlsRow = (row, existingProfiles) => {
    let errors = [];
    const email = row.email?.trim().toLowerCase();
    const role = row.role?.trim().toLowerCase();
    const mess = row.mess_name?.trim();

    if (!email) errors.push('Email is required.');
    if (!['student', 'caterer', 'admin'].includes(role)) errors.push(`Invalid role: ${role}`);
    
    if (role === 'student') {
      if (email && !email.endsWith('@iiti.ac.in')) errors.push('Student must use @iiti.ac.in.');
      if (!mess) errors.push('Mess Name required for student.');
      if (!HOSTELS.includes(row.hostel)) errors.push('Invalid hostel.');
      if (!FOOD_TYPES.includes(row.food_type?.toLowerCase())) errors.push('Invalid food type (regular/jain).');
    } else if (role === 'caterer') {
      if (!mess) errors.push('Mess Name required for caterer.');
      if (!row.phone_no) errors.push('Phone required for caterer.');
    }

    // Determine Action (New vs Edit)
    const existing = existingProfiles.find(p => p.email?.toLowerCase() === email);
    const action = existing ? 'edit' : 'new';
    const isPending = existing?.status === 'Pending';
    const dbId = existing?.id;

    return { 
      ...row, email, role, food_type: row.food_type?.toLowerCase(), 
      action, isPending, dbId,
      isValid: errors.length === 0, errorMsg: errors.join(' | ') 
    };
  };

  const handleXlsUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsProcessingXls(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        throw new Error("Spreadsheet appears to be empty or invalid.");
      }

      const parsedData = jsonData.map((row, index) => {
        const rawRow = {
          email: row.email || row.Email || row.EMAIL || '',
          role: row.role || row.Role || row.ROLE || 'student',
          mess_name: row.mess_name || row['Mess Name'] || row.mess || '',
          hostel: row.hostel || row.Hostel || row.HOSTEL || 'APJ',
          food_type: row.food_type || row['Food Type'] || row.Food_Type || 'regular',
          manager_name: row.manager_name || row['Manager Name'] || '',
          phone_no: row.phone_no || row['Phone No'] || row.phone || row.Phone || '',
          admin_name: row.admin_name || row['Admin Name'] || '',
          selected: true
        };
        return { ...rawRow, originalIndex: index };
      });

      const seenEmails = new Set();
      const uniqueData = parsedData.filter(row => {
        const email = row.email?.trim().toLowerCase();
        if (!email) return true; 
        if (seenEmails.has(email)) return false; 
        seenEmails.add(email);
        return true;
      });

      const validatedData = uniqueData.map(row => validateXlsRow(row, profiles));
      setXlsData(validatedData);
      setShowXlsModal(true);
      
    } catch (err) {
      console.error(err);
      triggerToast('error', 'Failed to read Excel file. Ensure it is formatted correctly.');
    } finally {
      setIsProcessingXls(false);
      e.target.value = null; 
    }
  };

  const handleXlsChange = (index, field, value) => {
    const updatedData = [...xlsData];
    updatedData[index] = { ...updatedData[index], [field]: value };
    updatedData[index] = validateXlsRow(updatedData[index], profiles);
    setXlsData(updatedData);
  };

  const toggleXlsRowSelection = (index) => {
    const updatedData = [...xlsData];
    updatedData[index].selected = !updatedData[index].selected;
    setXlsData(updatedData);
  };

  const handleBulkSubmit = async () => {
    const rowsToProcess = xlsData.filter(r => r.selected);
    if (rowsToProcess.length === 0) {
      triggerToast('error', 'No rows selected for processing.');
      return;
    }

    const invalidRows = rowsToProcess.filter(r => !r.isValid);
    if (invalidRows.length > 0) {
      triggerToast('error', `Fix errors in ${invalidRows.length} selected row(s) before submitting.`);
      return;
    }

    setSaving(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of rowsToProcess) {
      try {
        let catererId = null;

        if (row.role === 'student' && row.mess_name) {
          const { data: cats } = await supabase.from('caterers').select('caterer_id').ilike('name', row.mess_name).limit(1);
          if (!cats || cats.length === 0) throw new Error(`Mess "${row.mess_name}" not found.`);
          catererId = cats[0].caterer_id;
        }

        if (row.action === 'new') {
          const { error } = await supabase.from('pre_registrations').insert([{
            email: row.email, role: row.role,
            mess_name: row.role === 'admin' ? null : row.mess_name, caterer_id: catererId,
            hostel: row.role === 'student' ? row.hostel : null, food_type: row.role === 'student' ? row.food_type : null,
            manager_name: row.role === 'caterer' ? row.manager_name || null : null,
            phone_no: row.role === 'caterer' ? row.phone_no || null : (row.role === 'admin' ? row.phone_no || null : null),
            admin_name: row.role === 'admin' ? row.admin_name || null : null
          }]);
          if (error) throw error;
        } else {
          if (row.isPending) {
             const { error } = await supabase.from('pre_registrations').update({
                role: row.role, mess_name: row.role === 'admin' ? null : row.mess_name, caterer_id: catererId,
                hostel: row.role === 'student' ? row.hostel : null, food_type: row.role === 'student' ? row.food_type : null,
                manager_name: row.role === 'caterer' ? row.manager_name || null : null,
                phone_no: row.role === 'caterer' ? row.phone_no || null : (row.role === 'admin' ? row.phone_no || null : null),
                admin_name: row.role === 'admin' ? row.admin_name || null : null
             }).eq('email', row.dbId);
             if (error) throw error;
          } else {
             await supabase.from('profiles').update({ mess_name: row.role === 'admin' ? null : row.mess_name }).eq('id', row.dbId);
             if (row.role === 'student') {
               await supabase.from('students').update({ hostel: row.hostel, food_type: row.food_type, caterer_id: catererId }).eq('id', row.dbId);
             } else if (row.role === 'caterer') {
               await supabase.from('caterers').update({ name: row.mess_name, manager_name: row.manager_name || null, phone_no: row.phone_no || null }).eq('caterer_id', row.dbId);
             } else if (row.role === 'admin') {
               await supabase.from('admins').update({ name: row.admin_name || null, phone_no: row.phone_no || null }).eq('admin_id', row.dbId);
             }
          }
        }
        successCount++;
      } catch (err) {
        console.error(`Error processing row for ${row.email}:`, err);
        failCount++;
      }
    }

    setSaving(false);
    if (failCount === 0) {
      triggerToast('success', `Successfully processed ${successCount} users.`);
      setShowXlsModal(false);
    } else {
      triggerToast('error', `Processed ${successCount} users. ${failCount} failed. Check console for details.`);
      setXlsData(xlsData.map(r => r.selected ? { ...r, selected: false } : r));
    }
    fetchProfiles();
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
            <input className="admin-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-filter-select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <button className="icon-btn" onClick={fetchProfiles} title="Refresh">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            
            <input type="file" accept=".xls,.xlsx" ref={fileInputRef} onChange={handleXlsUpload} style={{ display: 'none' }} />
            <button className="btn-ghost" onClick={() => fileInputRef.current.click()} disabled={isProcessingXls}>
              {isProcessingXls ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Bulk XLS
            </button>

            <button className="btn-primary" onClick={openAdd}>
              <Plus size={16} /> Pre-Register
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
                  <th>User</th><th>Role</th><th>Mess</th><th>Details</th><th>Status</th><th style={{textAlign: 'right'}}>Actions</th>
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
                    <td style={{textAlign: 'right'}}>
                       <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                         <button className="btn-edit" onClick={() => openEdit(p)}><Pencil size={13} /> Edit</button>
                         <button className="btn-danger" onClick={() => setUserToDelete(p)} title="Delete User">
                           <Trash2 size={14} />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {userToDelete && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setUserToDelete(null)}>
          <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(231, 76, 60, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
               <AlertTriangle size={28} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.25rem', color: 'var(--text-main)' }}>Delete User?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete <strong>{userToDelete.email}</strong>?
            </p>
            {userToDelete.status === 'Active' && (
               <p style={{ color: 'var(--danger)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '24px' }}>
                 This will erase their authentication record, profile, and all associated data. This action cannot be undone.
               </p>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '24px auto 0', width: '100%', maxWidth: '300px' }}>
              <button className="btn-ghost" onClick={() => setUserToDelete(null)} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={saving} style={{ flex: 1, justifyContent: 'center', padding: '9px 18px' }}>
                {saving ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
              {form.role === 'student' && (
                <>
                  <div className="form-group"><label className="form-label">Hostel</label><select className="form-select" name="hostel" value={form.hostel} onChange={handleChange}>{HOSTELS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Food Type</label><select className="form-select" name="food_type" value={form.food_type} onChange={handleChange}>{FOOD_TYPES.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                  <div className="form-group full"><label className="form-label">Mess Name</label><input className="form-input" type="text" name="mess_name" value={form.mess_name} onChange={handleChange} /></div>
                </>
              )}
              {form.role === 'caterer' && (
                <>
                  <div className="form-group full"><label className="form-label">Mess Name</label><input className="form-input" type="text" name="mess_name" value={form.mess_name} onChange={handleChange} /></div>
                  <div className="form-group"><label className="form-label">Manager Name</label><input className="form-input" type="text" name="manager_name" value={form.manager_name} onChange={handleChange} /></div>
                  <div className="form-group"><label className="form-label">Phone Number</label><input className="form-input" type="tel" name="phone_no" value={form.phone_no} onChange={handleChange} /></div>
                </>
              )}
              {form.role === 'admin' && (
                <>
                  <div className="form-group full"><label className="form-label">Admin Name</label><input className="form-input" type="text" name="admin_name" value={form.admin_name} onChange={handleChange} /></div>
                  <div className="form-group full"><label className="form-label">Phone Number</label><input className="form-input" type="tel" name="admin_phone_no" value={form.admin_phone_no} onChange={handleChange} /></div>
                </>
              )}
            </div>
            {modalError && <div className="modal-error"><strong>Error: </strong>{modalError}</div>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={closeModal} disabled={saving}><X size={15} /> Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Save</button>
            </div>
          </div>
        </div>
      )}

      {showXlsModal && (
        <div className="modal-backdrop xls-backdrop" onClick={e => e.target === e.currentTarget && setShowXlsModal(false)}>
          <div className="modal-box xls-modal">
            <div className="modal-title">Review Bulk Upload Data</div>
            
            <div className="xls-legend">
              <div className="legend-item"><span className="xls-dot bg-green"></span> <strong>Pre-Register:</strong> New users to be added.</div>
              <div className="legend-item"><span className="xls-dot bg-blue"></span> <strong>Update:</strong> Existing users to be modified.</div>
              <div className="legend-item"><span className="xls-dot bg-red"></span> <strong>Error:</strong> Fix highlighted issues before submitting.</div>
            </div>

            <div className="xls-table-container">
              <table className="xls-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        className="xls-checkbox"
                        checked={xlsData.length > 0 && xlsData.every(r => r.selected)} 
                        onChange={(e) => setXlsData(xlsData.map(r => ({...r, selected: e.target.checked})))} 
                      />
                    </th>
                    <th style={{ width: '90px' }}>Action</th>
                    <th style={{ width: '220px' }}>Email</th>
                    <th style={{ width: '100px' }}>Role</th>
                    <th style={{ width: '140px' }}>Mess Name</th>
                    <th style={{ width: '90px' }}>Hostel</th>
                    <th style={{ width: '110px' }}>Food Type</th>
                    <th style={{ width: '140px' }}>Name (Mgr/Admin)</th>
                    <th style={{ width: '130px' }}>Phone No</th>
                    <th>Status / Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {xlsData.map((row, index) => {
                    const hasError = !row.isValid;
                    let rowStateClass = hasError ? 'state-error' : (row.action === 'new' ? 'state-new' : 'state-edit');

                    return (
                      <tr key={index} className={`xls-row ${rowStateClass} ${!row.selected ? 'row-disabled' : ''}`}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            className="xls-checkbox"
                            checked={row.selected} 
                            onChange={() => toggleXlsRowSelection(index)} 
                          />
                        </td>
                        <td>
                           <span className={`xls-badge ${row.action === 'new' ? 'badge-new' : 'badge-edit'}`}>
                             {row.action === 'new' ? 'Pre-Reg' : 'Update'}
                           </span>
                        </td>
                        <td>
                          <input 
                            className="xls-input" 
                            value={row.email} 
                            placeholder="user@iiti.ac.in"
                            onChange={(e) => handleXlsChange(index, 'email', e.target.value)} 
                            disabled={row.action==='edit'} 
                          />
                        </td>
                        <td>
                          <div className="xls-select-wrapper">
                            <select className="xls-input" value={row.role} onChange={(e) => handleXlsChange(index, 'role', e.target.value)}>
                              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </td>
                        <td>
                          <input 
                            className="xls-input" 
                            value={row.mess_name} 
                            placeholder="e.g. APJ Mess"
                            onChange={(e) => handleXlsChange(index, 'mess_name', e.target.value)} 
                          />
                        </td>
                        <td>
                          <div className="xls-select-wrapper">
                            <select className="xls-input" value={row.hostel} onChange={(e) => handleXlsChange(index, 'hostel', e.target.value)} disabled={row.role !== 'student'}>
                              <option value="">-</option>
                              {HOSTELS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        </td>
                        <td>
                          <div className="xls-select-wrapper">
                            <select className="xls-input" value={row.food_type} onChange={(e) => handleXlsChange(index, 'food_type', e.target.value)} disabled={row.role !== 'student'}>
                              <option value="">-</option>
                              {FOOD_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                        </td>
                        <td>
                          <input 
                            className="xls-input" 
                            placeholder={row.role === 'student' ? 'N/A' : 'Full Name'} 
                            value={row.role === 'admin' ? row.admin_name : (row.role === 'caterer' ? row.manager_name : '')} 
                            onChange={(e) => handleXlsChange(index, row.role === 'admin' ? 'admin_name' : 'manager_name', e.target.value)} 
                            disabled={row.role === 'student'} 
                          />
                        </td>
                        <td>
                          <input 
                            className="xls-input" 
                            placeholder={row.role === 'student' ? 'N/A' : '+91 00000 00000'} 
                            value={row.phone_no} 
                            onChange={(e) => handleXlsChange(index, 'phone_no', e.target.value)} 
                            disabled={row.role === 'student'} 
                          />
                        </td>
                        <td className="xls-status-cell">
                           {hasError ? (
                             <div className="xls-error-bubble">
                               <AlertCircle size={14} className="error-icon" />
                               <span>{row.errorMsg}</span>
                             </div>
                           ) : (
                             <span className="xls-ok-text"><Check size={14} /> Ready</span>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions xls-footer">
              <div className="xls-selection-count">
                 <strong>{xlsData.filter(r => r.selected).length}</strong> of {xlsData.length} rows selected
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-ghost" onClick={() => setShowXlsModal(false)} disabled={saving}><X size={15} /> Cancel</button>
                <button className="btn-primary" onClick={handleBulkSubmit} disabled={saving}>
                  {saving ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Submit Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;