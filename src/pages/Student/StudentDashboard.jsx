import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, MessageSquare, TrendingUp, LogOut, Menu, X, Check, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { useNavigate } from 'react-router-dom';
import './Student.css';

import CalendarView from './components/CalendarView';
import FeedbackView from './components/FeedbackView';
import TrendsView from './components/TrendsView';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [studentProfile, setStudentProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // UNIFIED TOAST STATE
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

  // GENERIC TOAST HANDLER
  const triggerToast = (type, message) => {
    setToast({ show: true, type, message });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  // Called by FeedbackView on success
  const handleFeedbackSuccess = () => {
    setActiveTab('calendar');
    triggerToast('success', 'Feedback submitted successfully!');
  };

  return (
    <div className="dashboard-container">
      
      {/* DYNAMIC TOAST COMPONENT */}
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
          
          {/* Passed 'triggerToast' so FeedbackView can also show errors if needed */}
          {activeTab === 'feedback' && (
            <FeedbackView 
              onSuccessfulSubmit={handleFeedbackSuccess} 
              onError={(msg) => triggerToast('error', msg)} 
            />
          )}
          
          {activeTab === 'trends' && <TrendsView />}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;