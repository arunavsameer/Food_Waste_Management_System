import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Bell, History, MessageSquare, LogOut, Menu, X, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './CatererDashboard.css';

// Component Imports
import LogWasteView from './components/LogWasteView';
import MessagesView from './components/MessagesView';
import MessFeedbackView from './components/MessFeedbackView';
import WasteHistoryView from './components/WasteHistoryView';

const CatererDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('log');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/'); // Redirects to login page
  };

  return (
    <div className="dashboard-container caterer">
      {/* Sidebar - Matches Student layout (1st & 3rd ref) */}
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
          {isSidebarOpen && (
            <div className="impact-card">
              <Leaf color="#28a745" size={20} />
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

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
             {activeTab === 'log' && 'Log Daily Waste'}
             {activeTab === 'messages' && 'Admin Messages'}
             {activeTab === 'history' && 'Waste History'}
             {activeTab === 'feedback' && 'Food Feedback (This Mess)'}
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">{profile?.mess_name || 'Loading...'}</span>
            </div>
            <div className="avatar">CT</div>
          </div>
        </header>

        {/* Content Area - Form is only rendered when activeTab is 'log' */}
        <div className="content-area">
          {activeTab === 'log' && <LogWasteView profile={profile} />}
          {activeTab === 'messages' && <MessagesView />}
          {activeTab === 'history' && <WasteHistoryView messName={profile?.mess_name} />}
          {activeTab === 'feedback' && <MessFeedbackView messName={profile?.mess_name} />}
        </div>
      </main>
    </div>
  );
};

export default CatererDashboard;