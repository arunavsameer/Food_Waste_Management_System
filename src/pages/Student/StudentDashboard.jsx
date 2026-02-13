import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, MessageSquare, TrendingUp, LogOut, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Student.css';

// Import the sub-components
import CalendarView from './components/CalendarView';
import FeedbackView from './components/FeedbackView';
import TrendsView from './components/TrendsView';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setStudentProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand" style={{ justifyContent: isSidebarOpen ? 'space-between' : 'center' }}>
          {/* Only show Title if Open. If Closed, show NOTHING here, just the button below. */}
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
        </nav>

        <div className="sidebar-footer">
          {isSidebarOpen && (
            <div className="impact-card">
              <span className="leaf-icon">🌿</span>
              <div className="impact-text">
                <h4>Impact Score</h4>
                <p>Waste reduced by 12%</p>
              </div>
            </div>
          )}
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
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">{studentProfile?.mess_name || 'Loading...'}</span>
            </div>
            <div className="avatar">SD</div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'calendar' && <CalendarView messName={studentProfile?.mess_name} />}
          {activeTab === 'feedback' && <FeedbackView messName={studentProfile?.mess_name} />}
          {activeTab === 'trends' && <TrendsView />}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;