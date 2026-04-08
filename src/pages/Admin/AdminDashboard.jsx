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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  
  // Profile dropdown state
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const hamburgerRef = useRef(null);

  // Check if mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      // Close mobile menu when clicking outside (but not on hamburger)
      if (isMobile && isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        if (hamburgerRef.current && !hamburgerRef.current.contains(e.target)) {
          setIsMobileMenuOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isMobileMenuOpen]);

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
    menu:      'Menu Management',
    'report-calendar': 'Report Calendar',
    carbon:    'Carbon Insights',
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
  const adminData = Array.isArray(adminProfile?.admins) ? adminProfile.admins[0] : adminProfile?.admins;
  const adminName = adminData?.name || 'Admin';
  const adminPhone = adminData?.phone_no || '—';
  const initials = getInitials(adminName);

  // Handle navigation - closes mobile menu automatically
  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className={`dashboard-container ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {/* Toast */}
      {toast.show && (
        <div className={`feedback-toast ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          {toast.message}
        </div>
      )}

      {/* ── Sidebar / Mobile Menu ── */}
      <aside 
        ref={mobileMenuRef}
        className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''} ${!isMobile ? 'desktop-sidebar' : ''}`}
      >
        <div className="brand">
          <h2>EcoPlate</h2>
          {/* Close button inside sidebar for mobile */}
          {isMobile && (
            <button className="close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Admin badge - only show on desktop or when sidebar is open on mobile */}
        {(!isMobile || (isMobile && isMobileMenuOpen)) && (
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
              onClick={() => handleNavClick(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {/* Hamburger Menu Button - Placed in main content flow, NOT sticky */}
        {isMobile && (
          <div className="hamburger-wrapper">
            <button 
              ref={hamburgerRef}
              className="hamburger-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        )}

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