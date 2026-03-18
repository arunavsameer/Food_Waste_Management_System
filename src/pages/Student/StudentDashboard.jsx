import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, MessageSquare, TrendingUp, LogOut, Menu, X, Check, AlertCircle, Gamepad2 } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import './Student.css';

import CalendarView from './components/CalendarView';
import FeedbackView from './components/FeedbackView';
import TrendsView from './components/TrendsView';
import GameView from './components/GameView'; 

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  // --- GAMIFICATION STATE ---
  const [credits, setCredits] = useState(0); // Set initial to 0
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  useEffect(() => {
    const fetchProfileAndStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // 1. Fetch Profile
          const { data, error } = await supabase
            .from('profiles')
            .select(`*, students (*)`)
            .eq('id', user.id)
            .single();

          if (error) throw error;
          setStudentProfile(data);

          // 2. Fetch or Initialize Tokens
          const { data: scoreData } = await supabase
            .from('player_score')
            .select('game_points')
            .eq('student_id', user.id)
            .maybeSingle();

          if (scoreData) {
            setCredits(scoreData.game_points);
          } else {
            // Give them a row with 0 tokens if it's their first time logging in
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
    setCredits(prev => prev + 1); // Update local state (DB is updated in FeedbackView)
    triggerToast('success', 'Feedback sent! +1 Game Token 🪙');
    setActiveTab('calendar');
  };

  const handleConsumeCredit = () => {
    setCredits(prev => Math.max(0, prev - 1)); // Decrement local state visually
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
            <div className="credit-badge" onClick={() => setActiveTab('game')} style={{cursor: 'pointer', marginRight: '15px', display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-hover)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', color: '#f1c40f'}}>
                <span style={{fontSize: '1.2rem'}}>🪙</span> {credits}
            </div>

            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">{studentProfile?.mess_name || 'Loading...'}</span>
            </div>
            <div className="avatar" onClick={() => setShowProfile(prev => !prev)} style={{ cursor: 'pointer' }}>
               {studentProfile?.email?.[0]?.toUpperCase() || 'S'}
            </div>
            {showProfile && (
              <div className="profile-dropdown">
                <h4>Student Info</h4>
                
                <div className="profile-item">
                  <span>Email:</span>
                  <span>{studentProfile?.email || 'N/A'}</span>
                </div>

                <div className="profile-item">
                  <span>Mess:</span>
                  <span>{studentProfile?.mess_name || 'N/A'}</span>
                </div>

                <div className="profile-item">
                  <span>Food Type:</span>
                  <span>{studentProfile?.students?.food_type || 'N/A'}</span>
                </div>

                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
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