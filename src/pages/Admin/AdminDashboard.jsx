import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, FileBarChart2, MessageSquare,
  Users, Send, LogOut, Menu, X,
  Check, AlertCircle, ShieldCheck, User, Phone, Utensils, CalendarDays, Leaf
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

import OverviewView      from './components/OverviewView';
import WasteReportsView  from './components/WasteReportsView';
import AdminFeedbackView from './components/AdminFeedbackView';
import MessagesView      from './components/MessagesView';
import UsersView         from './components/UsersView';
import MenuView          from './components/MenuView';
import ReportCalendarView from './components/ReportCalendarView'; 
import CarbonView        from './components/CarbonView';
import { useLogout } from '../../hooks/useLogout';

// Helper: first two initials from a full name
const getInitials = (name) => {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};



const AdminDashboard = () => {
  const navigate = useNavigate();

  const [adminProfile, setAdminProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  
  // Profile dropdown state
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fetch profile and join with admins table
          const { data } = await supabase
            .from('profiles')
            .select(`*, admins (*)`)
            .eq('id', user.id)
            .single();
          setAdminProfile(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = useLogout();

  const triggerToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const PAGE_TITLES = {
    overview:  'Overview & Analytics',
    waste:     'Waste Reports',
    feedback:  'Student Feedback',
    messages:  'Messages to Caterers',
    users:     'User Management',
    menu:      'Menu Management', // ADD THIS LINE
  };

const NAV_ITEMS = [
  { id: 'overview',         icon: <LayoutDashboard size={20} />, label: 'Overview'         },
  { id: 'waste',            icon: <FileBarChart2   size={20} />, label: 'Waste Reports'    },
  { id: 'report-calendar',  icon: <CalendarDays    size={20} />, label: 'Report Calendar'  },
  { id: 'feedback',         icon: <MessageSquare   size={20} />, label: 'Feedback'         },
  { id: 'messages',         icon: <Send            size={20} />, label: 'Messages'         },
  { id: 'menu',             icon: <Utensils        size={20} />, label: 'Menu'             },
  { id: 'users',            icon: <Users           size={20} />, label: 'Users'            },
  { id: 'carbon',           icon: <Leaf            size={20} />, label: 'Carbon Insights'  },
];

  // Admin Data Extract
  // Note: Depending on your exact Supabase relationship setup, admins might come back as an object or an array of 1.
  const adminData = Array.isArray(adminProfile?.admins) ? adminProfile.admins[0] : adminProfile?.admins;
  const adminName = adminData?.name || 'Admin';
  const adminPhone = adminData?.phone_no || '—';
  const initials = getInitials(adminName);

  return (
    <div className="dashboard-container">
      {/* Toast */}
      {toast.show && (
        <div className={`feedback-toast ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          {toast.message}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand" style={{ justifyContent: isSidebarOpen ? 'space-between' : 'center' }}>
          {isSidebarOpen && <h2>EcoPlate</h2>}
          <button className="toggle-btn" onClick={() => setIsSidebarOpen(s => !s)}>
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Admin badge */}
        {isSidebarOpen && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '10px', marginBottom: '12px',
            background: 'rgba(231,76,60,0.1)',
          }}>
            <ShieldCheck size={16} color="var(--danger)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger)' }}>ADMIN PANEL</span>
          </div>
        )}

        <nav className="nav-menu">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">{PAGE_TITLES[activeTab]}</div>
          <div className="user-info">
            <div className="user-details">
              <span className="label">LOGGED IN AS</span>
              <span className="value">{adminName || 'Admin'}</span>
            </div>
            
            {/* Avatar + Dropdown */}
            <div className="profile-wrapper" ref={profileRef}>
              <button
                className="avatar-btn"
                onClick={() => setShowProfile(prev => !prev)}
                title="Profile"
                style={{
                  background: 'linear-gradient(135deg, var(--danger), #ff9f43)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                {initials}
              </button>

              {showProfile && (
                <div className="profile-dropdown">
                  {/* ── Top: Avatar + Name ── */}
                  <div className="pd-header">
                    <div 
                      className="pd-avatar-large"
                      style={{ background: 'linear-gradient(135deg, var(--danger), #ff9f43)', color: '#fff' }}
                    >
                      {initials}
                    </div>
                    <p className="pd-name">{adminName}</p>
                    <p className="pd-sub">{adminProfile?.email || ''}</p>
                  </div>

                  <div className="pd-divider" />

                  {/* ── Info Rows ── */}
                  <ul className="pd-menu">
                    <li className="pd-item">
                      <span className="pd-item-icon"><ShieldCheck size={16} /></span>
                      <span className="pd-item-label">Role</span>
                      <span className="pd-item-value">Administrator</span>
                    </li>
                    <li className="pd-item">
                      <span className="pd-item-icon"><User size={16} /></span>
                      <span className="pd-item-label">Name</span>
                      <span className="pd-item-value">{adminName}</span>
                    </li>
                    <li className="pd-item">
                      <span className="pd-item-icon"><Phone size={16} /></span>
                      <span className="pd-item-label">Phone No</span>
                      <span className="pd-item-value">{adminPhone}</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'overview'  && <OverviewView />}
          {activeTab === 'waste'     && <WasteReportsView />}
          {activeTab === 'feedback'  && <AdminFeedbackView />}
          {activeTab === 'messages'  && <MessagesView />}
          {activeTab === 'menu'      && <MenuView triggerToast={triggerToast} />}
          {activeTab === 'users'     && <UsersView triggerToast={triggerToast} />}
          {activeTab === 'report-calendar' && <ReportCalendarView />}
          {activeTab === 'carbon' && <CarbonView />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;