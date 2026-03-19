import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, FileBarChart2, MessageSquare,
  Users, Send, LogOut, Menu, X,
  Check, AlertCircle, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

import OverviewView      from './components/OverviewView';
import WasteReportsView  from './components/WasteReportsView';
import AdminFeedbackView from './components/AdminFeedbackView';
import MessagesView      from './components/MessagesView';
import UsersView         from './components/UsersView';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [adminProfile, setAdminProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

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
  };

  const NAV_ITEMS = [
    { id: 'overview', icon: <LayoutDashboard size={20} />, label: 'Overview'  },
    { id: 'waste',    icon: <FileBarChart2   size={20} />, label: 'Waste Reports'  },
    { id: 'feedback', icon: <MessageSquare  size={20} />, label: 'Feedback'   },
    { id: 'messages', icon: <Send           size={20} />, label: 'Messages'   },
    { id: 'users',    icon: <Users          size={20} />, label: 'Users'      },
  ];

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
              <span className="value">{adminProfile?.email || 'Admin'}</span>
            </div>
            <div
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--danger), #ff9f43)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                flexShrink: 0,
              }}
              title="Admin"
            >
              AD
            </div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'overview'  && <OverviewView />}
          {activeTab === 'waste'     && <WasteReportsView />}
          {activeTab === 'feedback'  && <AdminFeedbackView />}
          {activeTab === 'messages'  && <MessagesView />}
          {activeTab === 'users'     && <UsersView triggerToast={triggerToast} />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;