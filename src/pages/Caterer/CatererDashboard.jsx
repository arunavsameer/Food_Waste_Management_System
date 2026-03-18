import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
// Added Phone to your imports!
import { Trash2, Bell, History, MessageSquare, LogOut, Menu, X, Leaf, Phone } from 'lucide-react';
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
  
  // --- Dropdown & Loading State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // --- CORRECTED DATABASE FETCH ---
        // Using 'caterers' table and 'caterer_id' based on your Supabase schema
        const { data, error } = await supabase
          .from('caterers') 
          .select('*')
          .eq('caterer_id', user.id)
          .single();
          
        if (data) {
          setProfile(data);
        } else if (error) {
          console.error("Error fetching profile:", error);
        }
      }
      setIsLoading(false);
    };
    fetchProfile();
  }, []);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/'); // Redirects to login page
  };

  // Helper to extract initials
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
          
          {/* Interactive User Info Section */}
          <div className="user-info" ref={dropdownRef}>
            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">
                {/* Changed to profile.name to match your database schema ("Sheela") */}
                {isLoading ? 'Loading...' : (profile?.name || 'Unknown')}
              </span>
            </div>
            
            {/* Clickable Avatar */}
            <div 
              className="avatar" 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              {isLoading ? '...' : getInitials(profile?.manager_name || profile?.name)}
            </div>

            {/* --- UPDATED DROPDOWN DESIGN --- */}
            {isProfileOpen && !isLoading && (
              <div className="profile-dropdown">
                
                {/* Gray inner box from your screenshot */}
                <div className="profile-info-box">
                  <p className="profile-name">{profile?.manager_name || profile?.name || 'Caterer Profile'}</p>
                  
                  <div className="profile-phone">
                    <Phone size={14} className="phone-icon" strokeWidth={2.5} />
                    <span>{profile?.phone_no || 'No phone provided'}</span>
                  </div>
                </div>
                
                {/* Logout Button */}
                <div className="profile-actions">
                  <button onClick={handleLogout} className="dropdown-logout-btn">
                    <LogOut size={18} strokeWidth={2} />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="content-area">
          {/* Note: Updated these props to use profile?.name based on your schema */}
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