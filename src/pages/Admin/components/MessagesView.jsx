import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { Send, MessageSquareDashed, Loader2, Radio, AlertCircle } from 'lucide-react';

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const fmtDateSeparator = (ts) =>
  new Date(ts).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

/* Sentinel for the "Broadcast All" virtual channel */
const BROADCAST_ID = '__broadcast__';

/* ─────────────────────────────────────────────
   DATE SEPARATOR
───────────────────────────────────────────── */
const DateSep = ({ ts }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '12px',
    margin: '12px 0', color: 'var(--text-muted)',
  }}>
    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
    <span style={{ fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {fmtDateSeparator(ts)}
    </span>
    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const MessagesView = () => {
  const [adminId,   setAdminId]   = useState(null);
  const [caterers,  setCaterers]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null); // caterer object | { caterer_id: BROADCAST_ID }
  const [messages,  setMessages]  = useState([]);
  const [msgLoading,setMsgLoading]= useState(false);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [error,     setError]     = useState('');

  const bottomRef   = useRef(null);
  const channelRef  = useRef(null);

  /* ── 1. Bootstrap: get admin id + caterers ── */
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAdminId(user?.id || null);

        const { data: cats } = await supabase
          .from('caterers')
          .select('caterer_id, name, manager_name, phone_no')
          .order('name');

        setCaterers(cats || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  /* ── 2. Scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── 3. Fetch messages for a given channel ── */
  const fetchMessages = useCallback(async (sel, myAdminId) => {
    if (!sel || !myAdminId) return;
    setMsgLoading(true);
    setMessages([]);
    setError('');

    try {
      let query;

      if (sel.caterer_id === BROADCAST_ID) {
        /*
          Broadcast channel: show all messages where reciever_id IS NULL.
          This includes admin broadcasts AND caterer-to-all-admins messages.
        */
        query = supabase
          .from('messages')
          .select('id, sender_id, reciever_id, message, message_time')
          .is('reciever_id', null)
          .order('message_time', { ascending: true });

      } else {
        /*
          Direct channel with a specific caterer:
          Show:
            A) Admin → caterer direct  (sender=admin,   reciever=caterer)
            B) Caterer → admin direct  (sender=caterer, reciever=admin)
            C) Admin broadcasts        (sender=admin,   reciever=null)   ← visible in every caterer chat
            D) Caterer → admins bcast  (sender=caterer, reciever=null)   ← caterer's broadcast, shown here
        */
        const catererId = sel.caterer_id;

        const { data, error: qErr } = await supabase
          .from('messages')
          .select('id, sender_id, reciever_id, message, message_time')
          .or(
            // A: admin→caterer direct
            `and(sender_id.eq.${myAdminId},reciever_id.eq.${catererId}),` +
            // B: caterer→admin direct
            `and(sender_id.eq.${catererId},reciever_id.eq.${myAdminId}),` +
            // C: admin broadcast (null reciever)
            `and(sender_id.eq.${myAdminId},reciever_id.is.null),` +
            // D: caterer broadcast to admins (null reciever)
            `and(sender_id.eq.${catererId},reciever_id.is.null)`
          )
          .order('message_time', { ascending: true });

        if (qErr) throw qErr;
        setMessages(data || []);
        setMsgLoading(false);
        return;
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setMessages(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setMsgLoading(false);
    }
  }, []);

  /* ── 4. Real-time subscription ── */
  useEffect(() => {
    if (!selected || !adminId) return;

    // Tear down previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const ch = supabase
      .channel(`messages-${selected.caterer_id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          const catererId = selected.caterer_id;

          let relevant = false;

          if (catererId === BROADCAST_ID) {
            // Broadcast channel: only null-reciever messages
            relevant = msg.reciever_id === null;
          } else {
            // Direct channel: messages A, B, C, D as described above
            const isAdminToCaterer    = msg.sender_id === adminId   && msg.reciever_id === catererId;
            const isCatererToAdmin    = msg.sender_id === catererId && msg.reciever_id === adminId;
            const isAdminBroadcast    = msg.sender_id === adminId   && msg.reciever_id === null;
            const isCatererBroadcast  = msg.sender_id === catererId && msg.reciever_id === null;
            relevant = isAdminToCaterer || isCatererToAdmin || isAdminBroadcast || isCatererBroadcast;
          }

          if (relevant) {
            setMessages(prev => {
              // Avoid duplicates (optimistic insert)
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [selected, adminId]);

  /* ── 5. Fetch messages when selection changes ── */
  useEffect(() => {
    if (selected && adminId) fetchMessages(selected, adminId);
  }, [selected, adminId, fetchMessages]);

  /* ── 6. Select a channel ── */
  const selectChannel = (item) => {
    setSelected(item);
    setInput('');
    setError('');
  };

  /* ── 7. Send message ── */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selected || !adminId || sending) return;

    setSending(true);
    setError('');

    const isBroadcast = selected.caterer_id === BROADCAST_ID;
    const payload = {
      sender_id:    adminId,
      reciever_id:  isBroadcast ? null : selected.caterer_id,
      message:      text,
      message_time: new Date().toISOString(),
    };

    // Optimistic insert
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, ...payload }]);
    setInput('');

    try {
      const { data, error: insErr } = await supabase
        .from('messages')
        .insert([payload])
        .select()
        .single();

      if (insErr) throw insErr;

      // Replace temp with real row
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    } catch (err) {
      console.error(err);
      setError('Failed to send message. Please try again.');
      // Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ── Helpers for render ── */
  const isBroadcastChannel = selected?.caterer_id === BROADCAST_ID;

  const getMessageRole = (msg) => {
    if (!adminId) return 'unknown';
    if (msg.sender_id === adminId) return 'admin';
    return 'caterer';
  };

  const getCatererName = (senderId) => {
    const cat = caterers.find(c => c.caterer_id === senderId);
    return cat?.name || 'Caterer';
  };

  /* Render messages with date separators */
  const renderMessages = () => {
    if (!messages.length) return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '8px', color: 'var(--text-muted)',
      }}>
        <MessageSquareDashed size={44} style={{ opacity: 0.2 }} />
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>No messages yet</p>
        <p style={{ margin: 0, fontSize: '0.78rem' }}>
          {isBroadcastChannel ? 'Send a broadcast to all caterers below' : `Start a conversation with ${selected?.name}`}
        </p>
      </div>
    );

    const items = [];
    let lastDate = null;

    messages.forEach((msg, i) => {
      const ts   = msg.message_time;
      const role = getMessageRole(msg);

      // Date separator
      if (!lastDate || !isSameDay(lastDate, ts)) {
        items.push(<DateSep key={`sep-${i}`} ts={ts} />);
        lastDate = ts;
      }

      const isSent = role === 'admin';
      const isBcast= msg.reciever_id === null;

      items.push(
        <div
          key={msg.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isSent ? 'flex-end' : 'flex-start',
            marginBottom: '4px',
          }}
        >
          {/* Sender label for broadcast channel or caterer messages */}
          {(!isSent || (isBroadcastChannel && isBcast)) && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px',
              paddingLeft: isSent ? 0 : '4px', paddingRight: isSent ? '4px' : 0,
            }}>
              {isSent
                ? `You${isBcast ? ' · 📢 Broadcast' : ''}`
                : `${getCatererName(msg.sender_id)}${isBcast ? ' · to all admins' : ''}`
              }
            </span>
          )}

          {/* Broadcast badge on sent side */}
          {isSent && isBcast && !isBroadcastChannel && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px', paddingRight: '4px' }}>
              You · 📢 Broadcast
            </span>
          )}

          <div style={{
            maxWidth: '65%',
            padding: '10px 14px',
            borderRadius: isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            fontSize: '0.875rem', lineHeight: 1.5,
            background: isSent
              ? isBcast
                ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)'   // purple gradient for broadcast
                : 'var(--primary-green)'                          // green for direct
              : 'var(--bg-hover)',
            color: isSent ? '#fff' : 'var(--text-main)',
            border: isSent ? 'none' : '1px solid var(--border-color)',
            boxShadow: isSent ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
            position: 'relative',
          }}>
            {msg.message}
            <div style={{
              fontSize: '0.65rem', marginTop: '5px', textAlign: 'right',
              opacity: isSent ? 0.75 : 0.6,
            }}>
              {fmtTime(ts)}
            </div>
          </div>
        </div>
      );
    });

    return items;
  };

  /* ─────────────────────────────────────────────
     LOADING STATE
  ───────────────────────────────────────────── */
  if (loading) return (
    <div className="admin-loading">
      <Loader2 size={22} className="spin" /> Loading messages…
    </div>
  );

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      <div className="messages-layout">
        {/* ── Sidebar ── */}
        <div className="messages-sidebar">
          <div className="messages-sidebar-header">Conversations</div>

          <div className="caterer-list">
            {/* Broadcast channel — always at top */}
            <div
              className={`caterer-item ${selected?.caterer_id === BROADCAST_ID ? 'active' : ''}`}
              onClick={() => selectChannel({ caterer_id: BROADCAST_ID, name: 'Broadcast — All Caterers' })}
              style={{
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '6px',
                paddingBottom: '10px',
              }}
            >
              <div
                className="caterer-avatar"
                style={{
                  background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                }}
              >
                <Radio size={16} />
              </div>
              <div>
                <div className="caterer-item-name" style={{ color: 'var(--primary-blue)' }}>
                  📢 Broadcast All
                </div>
                <div className="caterer-item-sub">Send to all caterers at once</div>
              </div>
            </div>

            {/* Individual caterers */}
            {caterers.length === 0 ? (
              <div className="admin-empty" style={{ padding: '20px 10px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No caterers found</p>
              </div>
            ) : caterers.map(c => (
              <div
                key={c.caterer_id}
                className={`caterer-item ${selected?.caterer_id === c.caterer_id ? 'active' : ''}`}
                onClick={() => selectChannel(c)}
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

        {/* ── Chat area ── */}
        <div className="chat-area">
          {!selected ? (
            /* Nothing selected */
            <div className="chat-empty">
              <MessageSquareDashed size={60} className="chat-empty-icon" />
              <p style={{ margin: 0, fontWeight: 600 }}>Select a conversation</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Choose a caterer for direct messaging,<br />or use Broadcast to reach all caterers.
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="chat-header">
                {isBroadcastChannel ? (
                  <div style={{
                    width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Radio size={18} color="#fff" />
                  </div>
                ) : (
                  <div className="caterer-avatar" style={{ width: 40, height: 40, fontSize: '0.8rem', flexShrink: 0 }}>
                    {getInitials(selected.name)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="chat-header-name">
                    {isBroadcastChannel ? '📢 Broadcast — All Caterers' : selected.name}
                  </div>
                  <div className="chat-header-sub">
                    {isBroadcastChannel
                      ? `Message delivered to all ${caterers.length} caterer${caterers.length !== 1 ? 's' : ''}`
                      : `${selected.manager_name ? `${selected.manager_name} · ` : ''}${selected.phone_no || 'No phone on file'}`
                    }
                  </div>
                </div>

                {/* Broadcast badge in header */}
                {isBroadcastChannel && (
                  <span style={{
                    padding: '4px 12px', borderRadius: '20px',
                    background: 'rgba(108,92,231,0.12)',
                    color: 'var(--primary-blue)',
                    fontSize: '0.72rem', fontWeight: 700,
                    border: '1px solid rgba(108,92,231,0.2)',
                  }}>
                    BROADCAST
                  </span>
                )}
              </div>

              {/* Broadcast notice */}
              {isBroadcastChannel && (
                <div style={{
                  margin: '0 16px 0', padding: '9px 14px',
                  background: 'rgba(108,92,231,0.07)',
                  border: '1px solid rgba(108,92,231,0.2)',
                  borderRadius: '10px',
                  fontSize: '0.78rem', color: 'var(--text-muted)',
                  display: 'flex', gap: '8px', alignItems: 'center',
                }}>
                  <Radio size={14} color="var(--primary-blue)" style={{ flexShrink: 0 }} />
                  Messages sent here are delivered to <strong style={{ color: 'var(--text-main)' }}>all caterers</strong>.
                  Each caterer will see this in their message thread with the admin.
                  Broadcast messages appear in purple.
                </div>
              )}

              {/* Direct channel broadcast notice */}
              {!isBroadcastChannel && (
                <div style={{
                  margin: '0 16px 0', padding: '8px 14px',
                  background: 'var(--bg-hover)',
                  borderRadius: '10px',
                  fontSize: '0.76rem', color: 'var(--text-muted)',
                  display: 'flex', gap: '8px', alignItems: 'center',
                }}>
                  <span>💬 Direct messages · </span>
                  <span>📢 Purple bubbles are admin broadcasts visible to all caterers</span>
                </div>
              )}

              {/* Messages */}
              <div className="chat-messages" style={{ paddingTop: '12px' }}>
                {msgLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-muted)' }}>
                    <Loader2 size={18} className="spin" /> Loading messages…
                  </div>
                ) : (
                  renderMessages()
                )}
                <div ref={bottomRef} />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  margin: '0 16px', padding: '8px 14px',
                  background: 'rgba(231,76,60,0.08)',
                  border: '1px solid rgba(231,76,60,0.2)',
                  borderRadius: '10px', fontSize: '0.78rem',
                  color: 'var(--danger)', display: 'flex', gap: '8px', alignItems: 'center',
                }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {/* Input row */}
              <div className="chat-input-row">
                <textarea
                  className="chat-input"
                  rows={1}
                  placeholder={
                    isBroadcastChannel
                      ? `Broadcast to all ${caterers.length} caterers…`
                      : `Message ${selected.name}…`
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <button
                  className="chat-send-btn"
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  title={isBroadcastChannel ? 'Broadcast to all caterers' : 'Send message'}
                  style={{
                    background: isBroadcastChannel
                      ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)'
                      : 'var(--primary-green)',
                    opacity: (!input.trim() || sending) ? 0.5 : 1,
                  }}
                >
                  {sending
                    ? <Loader2 size={16} className="spin" />
                    : isBroadcastChannel
                      ? <Radio size={17} />
                      : <Send size={17} />
                  }
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