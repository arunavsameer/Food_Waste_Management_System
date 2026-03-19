import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Send, MessageSquareDashed, Loader2 } from 'lucide-react';

// Sample dummy messages per caterer
const DUMMY_HISTORY = {
  default: [
    { id: 1, from: 'admin', text: 'Please ensure the food quality is maintained this week.', time: '10:30 AM' },
    { id: 2, from: 'caterer', text: 'Understood! We will make sure everything is in order.', time: '10:45 AM' },
  ],
};

const MessagesView = () => {
  const [caterers, setCaterers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    const fetchCaterers = async () => {
      try {
        const { data } = await supabase
          .from('caterers')
          .select('caterer_id, name, manager_name, phone_no')
          .order('name');
        setCaterers(data || []);
        if (data && data.length > 0) {
          setSelected(data[0]);
          setMessages(DUMMY_HISTORY[data[0].caterer_id] || DUMMY_HISTORY.default);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaterers();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectCaterer = (c) => {
    setSelected(c);
    setMessages(DUMMY_HISTORY[c.caterer_id] || DUMMY_HISTORY.default);
    setInput('');
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !selected) return;
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), from: 'admin', text, time }]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 size={22} className="spin" /> Loading caterers…
      </div>
    );
  }

  return (
    <div>
      {/* Dummy notice */}
      <div style={{
        background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.3)',
        borderRadius: '12px', padding: '10px 16px', marginBottom: '16px',
        fontSize: '0.83rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center'
      }}>
        <span style={{ fontSize: '1rem' }}>🚧</span>
        <span>Messaging is in <strong style={{ color: 'var(--warning)' }}>demo mode</strong> — messages are not saved to the database yet. Backend integration coming soon.</span>
      </div>

      <div className="messages-layout">
        {/* Caterer list */}
        <div className="messages-sidebar">
          <div className="messages-sidebar-header">Caterers ({caterers.length})</div>
          <div className="caterer-list">
            {caterers.length === 0 ? (
              <div className="admin-empty" style={{ padding: '30px 10px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No caterers found</p>
              </div>
            ) : caterers.map(c => (
              <div
                key={c.caterer_id}
                className={`caterer-item ${selected?.caterer_id === c.caterer_id ? 'active' : ''}`}
                onClick={() => selectCaterer(c)}
              >
                <div className="caterer-avatar">{getInitials(c.name)}</div>
                <div>
                  <div className="caterer-item-name">{c.name}</div>
                  <div className="caterer-item-sub">{c.manager_name || 'Manager'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="chat-area">
          {!selected ? (
            <div className="chat-empty">
              <MessageSquareDashed size={60} className="chat-empty-icon" />
              <p style={{ margin: 0, fontWeight: 600 }}>Select a caterer to message</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="caterer-avatar" style={{ width: 40, height: 40, fontSize: '0.8rem' }}>
                  {getInitials(selected.name)}
                </div>
                <div>
                  <div className="chat-header-name">{selected.name}</div>
                  <div className="chat-header-sub">
                    {selected.manager_name && `${selected.manager_name} · `}{selected.phone_no || 'No phone'}
                  </div>
                </div>
              </div>

              <div className="chat-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`chat-bubble ${msg.from === 'admin' ? 'sent' : 'received'}`}>
                    {msg.text}
                    <div className="bubble-time">{msg.time}</div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="chat-input-row">
                <textarea
                  className="chat-input"
                  rows={1}
                  placeholder={`Message ${selected.name}…`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="chat-send-btn" onClick={sendMessage} title="Send">
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesView;