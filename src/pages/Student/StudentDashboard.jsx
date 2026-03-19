import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Calendar, MessageSquare, TrendingUp, LogOut, Menu, X,
  Check, AlertCircle, Gamepad2, User, UtensilsCrossed,
  Building2, Sun, Moon, Hash
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './Student.css';

import CalendarView from './components/CalendarView';
import FeedbackView from './components/FeedbackView';
import TrendsView from './components/TrendsView';
import GameView from './components/GameView';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  // --- GAMIFICATION STATE ---
  const [credits, setCredits] = useState(0);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

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

  return (
    <div className="dashboard-container">
      {toast.show && (
        <div className={`feedback-toast ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          </div>
          {toast.message}
        </div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand" style={{ justifyContent: isSidebarOpen ? 'space-between' : 'center' }}>
          {isSidebarOpen && <h2>EcoPlate</h2>}
          <button className="toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
            <Calendar size={20} />
            {isSidebarOpen && <span>Food Calendar</span>}
          </button>
          <button className={`nav-item ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>
            <MessageSquare size={20} />
            {isSidebarOpen && <span>Give Feedback</span>}
          </button>
          <button className={`nav-item ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
            <TrendingUp size={20} />
            {isSidebarOpen && <span>My Trends</span>}
          </button>
          <button className={`nav-item ${activeTab === 'game' ? 'active' : ''}`} onClick={() => setActiveTab('game')}>
            <Gamepad2 size={20} />
            {isSidebarOpen && <span>Arcade Zone</span>}
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
            {activeTab === 'calendar' && 'Mess Performance Calendar'}
            {activeTab === 'feedback' && 'Daily Meal Feedback'}
            {activeTab === 'trends' && 'My Feedback History'}
            {activeTab === 'game' && 'Arcade Zone'}
          </div>
          <div className="user-info">
            {/* Credit Badge */}
            <div
              className="credit-badge"
              onClick={() => setActiveTab('game')}
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
              <span className="value">{studentProfile?.mess_name || 'Loading...'}</span>
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

              {showProfile && (
                <div className="profile-dropdown">
                  {/* ── Top: Avatar + Name ── */}
                  <div className="pd-header">
                    <div className="pd-avatar-large">{initials}</div>
                    <p className="pd-name">{studentName || 'Student'}</p>
                    <p className="pd-sub">{studentProfile?.email || ''}</p>
                  </div>

                  <div className="pd-divider" />

                  {/* ── Info Rows ── */}
                  <ul className="pd-menu">
                    <li className="pd-item">
                      <span className="pd-item-icon"><Building2 size={16} /></span>
                      <span className="pd-item-label">Mess</span>
                      <span className="pd-item-value">{studentProfile?.mess_name || '—'}</span>
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
                  </ul>

                  {/* <div className="pd-divider" /> */}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'calendar' && <CalendarView messName={studentProfile?.mess_name} />}

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