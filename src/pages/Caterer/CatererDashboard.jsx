import React, { useState } from "react";
import { Calendar, MessageSquare, BarChart3, LogOut, Trash2, Leaf } from "lucide-react";
import "./CatererDashboard.css";

const CatererDashboard = () => {
  const [activeTab, setActiveTab] = useState("log");

  return (
    <div className="dashboard-container">
      {/* Sidebar - Identical to Student Dashboard */}
      <aside className="sidebar">
        <div className="brand">
          <h2>EcoPlate</h2>
        </div>
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === "log" ? "active" : ""}`} onClick={() => setActiveTab("log")}>
            <Trash2 size={18}/> Log Waste
          </button>
          <button className={`nav-item ${activeTab === "messages" ? "active" : ""}`} onClick={() => setActiveTab("messages")}>
            <MessageSquare size={18}/> Admin Messages
          </button>
          <button className={`nav-item ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>
            <BarChart3 size={18}/> History
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="impact-card">
            <Leaf size={20} color="#28a745" />
            <div className="impact-text">
              <h4>Impact Score</h4>
              <p>Waste reduced by 12%</p>
            </div>
          </div>
          <button className="logout-btn">
            <LogOut size={16}/> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            {activeTab === "log" ? "Log Daily Waste" : activeTab === "history" ? "Waste History" : "Admin Messages"}
          </div>
          <div className="user-info">
            <div className="user-details">
              <span className="label">CURRENT MESS</span>
              <span className="value">Arora Mess Manager</span>
            </div>
            <div className="avatar">CT</div>
          </div>
        </header>

        <div className="dashboard-grid">
          {/* Left Column - Form Section */}
          <div className="left-column">
            <div className="card">
              <label>Select Date</label>
              <input type="date" className="styled-input" defaultValue={new Date().toISOString().split("T")[0]} />

              <div className="waste-row">
                <div className="waste-box green">
                  <h4>Kitchen Waste (Kg)</h4>
                  <input type="number" placeholder="0" />
                </div>
                <div className="waste-box red">
                  <h4>Plate Waste (Kg)</h4>
                  <input type="number" placeholder="0" />
                </div>
              </div>

              <label>Notes / Causes</label>
              <textarea className="styled-input" style={{height: '100px'}} placeholder="E.g. Overcooked rice, less student turnout..."></textarea>
              
              <button className="submit-btn-student">Submit Log</button>
            </div>
          </div>

          {/* Right Column - Widgets */}
          <div className="right-column">
            <div className="card">
              <h4 style={{marginBottom: '15px'}}>Segregation Guidelines</h4>
              <ul className="guideline-list">
                <li><span className="dot green"></span> <strong>Green Bin:</strong> Raw veggie peels</li>
                <li><span className="dot red"></span> <strong>Red Bin:</strong> Cooked plate leftovers</li>
                <li><span className="dot blue"></span> <strong>Blue Bin:</strong> Paper and dry waste</li>
              </ul>
            </div>

            <div className="card">
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                <h4 style={{margin: 0}}>Admin Messages</h4>
                <span style={{color:'#e74c3c', fontSize:'0.7rem', fontWeight:700}}>1 NEW</span>
              </div>
              <p style={{fontSize: '0.85rem', color: '#636e72', lineHeight: '1.4'}}>
                Please reduce the quantity of rice prepared for dinner today. Student turnout expected to be low.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CatererDashboard;