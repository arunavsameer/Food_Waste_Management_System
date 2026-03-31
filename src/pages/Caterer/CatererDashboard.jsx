import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Bell, History, MessageSquare, LogOut, Menu, X, Phone, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './CatererDashboard.css';

import LogWasteView from './components/LogWasteView';
import MessagesView from './components/MessagesView';
import MessFeedbackView from './components/MessFeedbackView';
import WasteHistoryView from './components/WasteHistoryView';

import { useLogout } from '../../hooks/useLogout';

const CatererDashboard = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('log');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('caterers')
          .select('*')
          .eq('caterer_id', user.id)
          .single();
        if (data) setProfile(data);
        else if (error) console.error("Error fetching profile:", error);
      }
      setIsLoading(false);
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = useLogout();

  const getInitials = (name) => {
    if (!name) return 'CT';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="dashboard-container caterer">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand" style={{ justifyContent: isSidebarOpen ? 'space-between' : 'center' }}>
          {isSidebarOpen && <h2>EcoPlate</h2>}
          <button className="toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <span className="nav-menu-label">MENU</span>
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
            <Trash2 size={20} />
            {isSidebarOpen && <span>Log Waste</span>}
          </button>
          <button className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
            <Bell size={20} />
            {isSidebarOpen && <span>Messages</span>}
          </button>
          <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={20} />
            {isSidebarOpen && <span>History</span>}
          </button>
          <button className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>
            <MessageSquare size={20} />
            {isSidebarOpen && <span>Feedback</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            {activeTab === 'log' && 'Log Daily Waste'}
            {activeTab === 'messages' && 'Admin Messages'}
            {activeTab === 'history' && 'Waste History'}
            {activeTab === 'feedback' && 'Food Feedback (This Mess)'}
          </div>

          {/* ✅ Updated User Info with rich dropdown */}
          <div className="user-info" ref={dropdownRef}>
            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">
                {isLoading ? 'Loading...' : (profile?.name || 'Unknown')}
              </span>
            </div>

            {/* Avatar */}
            <div
              className="avatar"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              {isLoading ? '...' : getInitials(profile?.manager_name || profile?.name)}
            </div>

            {/* ✅ Rich Profile Dropdown — matches Student design */}
            {isProfileOpen && !isLoading && (
              <div className="profile-dropdown">

                {/* Header: avatar + name + mess */}
                <div className="pd-header">
                  <div className="pd-avatar-large" style={{
                    background: 'linear-gradient(135deg, #e67e22 0%, #f39c12 100%)',
                    boxShadow: '0 6px 20px rgba(230, 126, 34, 0.4)'
                  }}>
                    {getInitials(profile?.manager_name || profile?.name)}
                  </div>
                  <p className="pd-name">{profile?.manager_name || profile?.name || 'Manager'}</p>
                  <p className="pd-sub">{profile?.name || ''}</p>
                </div>

                <div className="pd-divider" />

                {/* Info rows */}
                <ul className="pd-menu">
                  <li className="pd-item">
                    <span className="pd-item-icon">
                      <Phone size={15} />
                    </span>
                    <span className="pd-item-label">Phone</span>
                    <span className="pd-item-value">{profile?.phone_no || '—'}</span>
                  </li>
                </ul>

              </div>
            )}
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'log' && <LogWasteView profile={profile} />}
          {activeTab === 'messages' && <MessagesView />}
          {activeTab === 'history' && <WasteHistoryView messName={profile?.name} />}
          {activeTab === 'feedback' && <MessFeedbackView messName={profile?.name} />}
        </div>
      </main>
    </div>
  );
};

export default CatererDashboard;