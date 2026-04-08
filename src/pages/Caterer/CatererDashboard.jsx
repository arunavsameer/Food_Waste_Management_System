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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);
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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      // Close mobile menu when clicking outside (but not on hamburger)
      if (isMobile && isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        if (hamburgerRef.current && !hamburgerRef.current.contains(event.target)) {
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

  const handleLogout = useLogout();

  const getInitials = (name) => {
    if (!name) return 'CT';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Handle navigation - closes mobile menu automatically
  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className={`dashboard-container caterer ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {/* Sidebar / Mobile Menu */}
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

        <span className="nav-menu-label">MENU</span>
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'log' ? 'active' : ''}`} 
            onClick={() => handleNavClick('log')}
          >
            <Trash2 size={20} />
            <span>Log Waste</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} 
            onClick={() => handleNavClick('messages')}
          >
            <Bell size={20} />
            <span>Messages</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} 
            onClick={() => handleNavClick('history')}
          >
            <History size={20} />
            <span>History</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`} 
            onClick={() => handleNavClick('feedback')}
          >
            <MessageSquare size={20} />
            <span>Feedback</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
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
          <div className="page-title">
            {activeTab === 'log' && 'Log Daily Waste'}
            {activeTab === 'messages' && 'Admin Messages'}
            {activeTab === 'history' && 'Waste History'}
            {activeTab === 'feedback' && 'Food Feedback (This Mess)'}
          </div>

          {/* User Info with rich dropdown */}
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

            {/* Rich Profile Dropdown */}
            {isProfileOpen && !isLoading && (
              <div className="profile-dropdown">
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