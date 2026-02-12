import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, MessageSquare, History, LogOut, Menu, X, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './CatererDashboard.css';

// Component Imports
import LogWasteView from './components/LogWasteView';
// import HistoryView from './components/HistoryView';
// import MessagesView from './components/MessagesView';

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
    <div className="dashboard-container">
      {/* Sidebar - Matches Student Sidebar Logic */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="brand">
          {isSidebarOpen ? <h2>EcoPlate</h2> : <h2 style={{fontSize: '1.5rem'}}>🌱</h2>}
          <button className="toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
            <Trash2 size={20} />
            {isSidebarOpen && <span>Log Waste</span>}
          </button>
          <button className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
            <MessageSquare size={20} />
            {isSidebarOpen && <span>Messages</span>}
          </button>
          <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={20} />
            {isSidebarOpen && <span>History</span>}
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
          {/* {activeTab === 'history' && <HistoryView />} */}
        </div>
      </main>
    </div>
  );
};

export default CatererDashboard;