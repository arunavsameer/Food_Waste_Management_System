import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar, MessageSquare, TrendingUp, LogOut, Menu, X,
  Check, AlertCircle, Gamepad2, User, UtensilsCrossed,
  Building2, Sun, Moon, Hash, ListOrdered
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './Student.css';

import CalendarView from './components/CalendarView';
import FeedbackView from './components/FeedbackView';
import TrendsView from './components/TrendsView';
import GameView from './components/GameView';

import { useLogout } from '../../hooks/useLogout';

// Helper: first two initials from a full name
const getInitials = (name) => {
  if (!name) return 'ST';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [studentProfile, setStudentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Desktop sidebar toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile menu state
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const hamburgerRef = useRef(null);

  // --- GAMIFICATION STATE ---
  const [credits, setCredits] = useState(0);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

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
    const fetchProfileAndStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select(`*, students (*)`)
            .eq('id', user.id)
            .single();

          if (error) throw error;
          setStudentProfile(data);

          const { data: scoreData } = await supabase
            .from('player_score')
            .select('game_points')
            .eq('student_id', user.id)
            .maybeSingle();

          if (scoreData) {
            setCredits(scoreData.game_points);
          } else {
            await supabase.from('player_score').insert([{ student_id: user.id, game_points: 0, high_score: 0, attempts_count: 0 }]);
            setCredits(0);
          }
        }
      } catch (err) {
        triggerToast('error', 'Failed to load profile');
      }
    };

    fetchProfileAndStats();
  }, []);

  const handleLogout = useLogout();

  const triggerToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
  };

  const handleFeedbackSuccess = () => {
    setCredits(prev => prev + 1);
    triggerToast('success', 'Feedback sent! +1 Game Token 🪙');
    setActiveTab('calendar');
  };

  const handleConsumeCredit = () => {
    setCredits(prev => Math.max(0, prev - 1));
  };

  const studentName = studentProfile?.students?.name || '';
  const initials = getInitials(studentName);
  const messName = studentProfile?.mess_name || 'Your Mess';

  // Handle navigation - closes mobile menu automatically
  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  // Toggle desktop sidebar
  const toggleDesktopSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className={`dashboard-container ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {toast.show && (
        <div className={`feedback-toast ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          {toast.message}
        </div>
      )}

      {/* Sidebar / Mobile Menu */}
      <aside 
        ref={mobileMenuRef}
        className={`sidebar 
          ${!isMobile && (isSidebarOpen ? 'open' : 'closed')} 
          ${isMobile && isMobileMenuOpen ? 'mobile-open' : ''} 
          ${!isMobile ? 'desktop-sidebar' : ''}`}
      >
        <div className="brand" style={{ justifyContent: (!isMobile && !isSidebarOpen) ? 'center' : 'space-between' }}>
          {(!isMobile && isSidebarOpen) && <h2>EcoPlate</h2>}
          {(!isMobile && !isSidebarOpen) && <h2 style={{ fontSize: '1.2rem' }}>E</h2>}
          {isMobile && <h2>EcoPlate</h2>}
          
          {/* Desktop toggle button - only show on desktop */}
          {!isMobile && (
            <button className="toggle-btn" onClick={toggleDesktopSidebar}>
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          
          {/* Close button inside sidebar for mobile */}
          {isMobile && (
            <button className="close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} 
            onClick={() => handleNavClick('calendar')}
          >
            <Calendar size={20} />
            {(!isMobile && isSidebarOpen) && <span>Food Calendar</span>}
            {(isMobile && isMobileMenuOpen) && <span>Food Calendar</span>}
          </button>
          <button 
            className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`} 
            onClick={() => handleNavClick('feedback')}
          >
            <MessageSquare size={20} />
            {(!isMobile && isSidebarOpen) && <span>Give Feedback</span>}
            {(isMobile && isMobileMenuOpen) && <span>Give Feedback</span>}
          </button>
          <button 
            className={`nav-item ${activeTab === 'trends' ? 'active' : ''}`} 
            onClick={() => handleNavClick('trends')}
          >
            <TrendingUp size={20} />
            {(!isMobile && isSidebarOpen) && <span>My Trends</span>}
            {(isMobile && isMobileMenuOpen) && <span>My Trends</span>}
          </button>
          <button 
            className={`nav-item ${activeTab === 'game' ? 'active' : ''}`} 
            onClick={() => handleNavClick('game')}
          >
            <Gamepad2 size={20} />
            {(!isMobile && isSidebarOpen) && <span>Arcade Zone</span>}
            {(isMobile && isMobileMenuOpen) && <span>Arcade Zone</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
            {(!isMobile && isSidebarOpen) && <span>Logout</span>}
            {(isMobile && isMobileMenuOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
<main className="main-content">
  {/* Mobile Top Bar - Hamburger + Profile on same line */}
  {isMobile && (
    <div className="mobile-top-bar">
      {/* Hamburger button */}
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

      {/* Profile section on mobile */}
      <div className="mobile-profile-section">
        {/* Credit Badge on mobile */}
        <div 
          className="mobile-credit-badge"
          onClick={() => handleNavClick('game')}
        >
          <span>🪙</span> {credits}
        </div>

        {/* Mess info on mobile */}
        <div className="mobile-mess-info">
          <span className="mobile-mess-label">CURRENT MESS</span>
          <span className="mobile-mess-value">{messName}</span>
        </div>

        {/* Avatar on mobile */}
        <div className="profile-wrapper" ref={profileRef}>
          <button
            className="mobile-avatar-btn"
            onClick={() => setShowProfile(prev => !prev)}
            title="Profile"
          >
            {initials}
          </button>

          {showProfile && (
            <div className="profile-dropdown">
              <div className="pd-header">
                <div className="pd-avatar-large">{initials}</div>
                <p className="pd-name">{studentName || 'Student'}</p>
                <p className="pd-sub">{studentProfile?.email || ''}</p>
              </div>

              <div className="pd-divider" />

              <ul className="pd-menu">
                <li className="pd-item">
                  <span className="pd-item-icon"><Building2 size={16} /></span>
                  <span className="pd-item-label">Mess</span>
                  <span className="pd-item-value">{messName}</span>
                </li>
                <li className="pd-item">
                  <span className="pd-item-icon"><UtensilsCrossed size={16} /></span>
                  <span className="pd-item-label">Food Type</span>
                  <span className="pd-item-value">{studentProfile?.students?.food_type || '—'}</span>
                </li>
                <li className="pd-item">
                  <span className="pd-item-icon"><Hash size={16} /></span>
                  <span className="pd-item-label">Roll No</span>
                  <span className="pd-item-value">{studentProfile?.students?.roll_no || '—'}</span>
                </li>
                <li className="pd-item">
                  <span className="pd-item-icon"><ListOrdered size={16} /></span>
                  <span className="pd-item-label">Serial No</span>
                  <span className="pd-item-value">{studentProfile?.students?.serial_no || '—'}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

  {/* Desktop Header - unchanged */}
  <header className="top-bar">
    <div className="page-title">
      {activeTab === 'calendar' && 'Mess Performance Calendar'}
      {activeTab === 'feedback' && 'Daily Meal Feedback'}
      {activeTab === 'trends' && 'My Feedback History'}
      {activeTab === 'game' && 'Arcade Zone'}
    </div>
    <div className="user-info">
      {/* Credit Badge */}
      <div
        className="credit-badge"
        onClick={() => handleNavClick('game')}
        style={{
          cursor: 'pointer', marginRight: '15px', display: 'flex',
          alignItems: 'center', gap: '5px', background: 'var(--bg-hover)',
          padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem',
          fontWeight: 'bold', color: '#f1c40f'
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>🪙</span> {credits}
      </div>

      {/* Mess Label */}
      <div className="user-details">
        <span className="label">CURRENT MESS</span>
        <span className="value">{messName}</span>
      </div>

      {/* Avatar + Dropdown */}
      <div className="profile-wrapper" ref={profileRef}>
        <button
          className="avatar-btn"
          onClick={() => setShowProfile(prev => !prev)}
          title="Profile"
        >
          {initials}
        </button>
      </div>
    </div>
  </header>

        <div className="content-area">
          {activeTab === 'calendar' && <CalendarView messName />}
          {activeTab === 'feedback' && (
            <FeedbackView
              onSuccessfulSubmit={handleFeedbackSuccess}
              onError={(msg) => triggerToast('error', msg)}
            />
          )}
          {activeTab === 'trends' && <TrendsView />}
          {activeTab === 'game' && (
            <GameView credits={credits} onConsumeCredit={handleConsumeCredit} />
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;