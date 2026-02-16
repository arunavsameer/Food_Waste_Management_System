import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, MessageSquare, TrendingUp, LogOut, Menu, X, Check, AlertCircle, Gamepad2 } from 'lucide-react'; // Added Gamepad2
import { useNavigate } from 'react-router-dom';
import './Student.css';

import CalendarView from './components/CalendarView';
import FeedbackView from './components/FeedbackView';
import TrendsView from './components/TrendsView';
import GameView from './components/GameView'; // Import the new component

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // --- GAMIFICATION STATE ---
  const [credits, setCredits] = useState(1); // Give 1 free credit to start
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (error) throw error;
          setStudentProfile(data);
        }
      } catch (err) {
        triggerToast('error', 'Failed to load profile');
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
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
  };

  // Called when Feedback is submitted
  const handleFeedbackSuccess = () => {
    // 1. Earn Credit
    setCredits(prev => prev + 1);
    
    // 2. Show Special Toast
    triggerToast('success', 'Feedback sent! +1 Game Credit 🪙');
    
    // 3. Switch to Game Tab to show the reward? (Optional, let's keep them on calendar for utility)
    setActiveTab('calendar');
  };

  // Called when Game starts
  const handleConsumeCredit = () => {
    setCredits(prev => Math.max(0, prev - 1));
  };

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
          {/* NEW GAME TAB */}
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
             {activeTab === 'game' && 'Arcade 🎮'}
          </div>
          <div className="user-info">
             {/* Show Credits in Header too */}
            <div className="credit-badge" onClick={() => setActiveTab('game')} style={{cursor: 'pointer', marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-hover)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', color: '#f1c40f'}}>
                <span style={{fontSize: '1.2rem'}}>🪙</span> {credits}
            </div>

            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">{studentProfile?.mess_name || 'Loading...'}</span>
            </div>
            <div className="avatar">SD</div>
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

          {/* NEW GAME VIEW */}
          {activeTab === 'game' && (
            <GameView credits={credits} onConsumeCredit={handleConsumeCredit} />
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;