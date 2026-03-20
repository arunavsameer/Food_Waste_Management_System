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
  new Date(ts).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const dedupe = (arr) => {
  const seen = new Set();
  return arr.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
};

const BROADCAST_ID = '__broadcast__';

/* ─────────────────────────────────────────────
   DATE SEPARATOR
───────────────────────────────────────────── */
const DateSep = ({ ts }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '12px',
    margin: '12px 0',
  }}>
    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {fmtDateSeparator(ts)}
    </span>
    <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const MessagesView = () => {
  const [catererId,  setCatererId]  = useState(null);      // current caterer's UUID
  const [adminIdSet, setAdminIdSet] = useState(new Set()); // all admin UUIDs
  const [admins,     setAdmins]     = useState([]);        // admin list for sidebar
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [error,      setError]      = useState('');

  const bottomRef  = useRef(null);
  const channelRef = useRef(null);

  /* ══════════════════════════════════════════
     1. BOOTSTRAP
  ══════════════════════════════════════════ */
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const myId = user?.id ?? null;
        setCatererId(myId);

        const { data: adminData, error: adminErr } = await supabase
          .from('admins')
          .select('admin_id, name, phone_no')
          .order('name');

        if (adminErr) console.error('admin fetch error:', adminErr);

        const adminList = adminData || [];
        setAdmins(adminList);
        setAdminIdSet(new Set(adminList.map(a => a.admin_id)));

      } catch (err) {
        console.error('init error', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  /* ══════════════════════════════════════════
     2. FETCH MESSAGES

     VISIBILITY RULES:
       sender is ADMIN + reciever_id = null        → admin broadcast to all caterers → VISIBLE (received)
       sender is ADMIN + reciever_id = myCatererId → admin direct to me              → VISIBLE (received)
       sender is ADMIN + reciever_id = other       → not for me                      → NOT VISIBLE

       sender is ME   + reciever_id = null         → my broadcast to all admins      → VISIBLE (sent)
       sender is ME   + reciever_id = adminId      → my direct to that admin         → VISIBLE (sent)
       sender is ME   + reciever_id = other        → not relevant                    → NOT VISIBLE
  ══════════════════════════════════════════ */
  const fetchMessages = useCallback(async (sel, myId) => {
    if (!sel || !myId) return;
    setMsgLoading(true);
    setMessages([]);
    setError('');

    try {
      if (sel.admin_id === BROADCAST_ID) {
        /*
          BROADCAST CHANNEL — show all null-receiver messages:
            • Any admin → null  (admin broadcast to all caterers)
            • Me        → null  (my broadcast to all admins)
        */
        const { data, error: e } = await supabase
          .from('messages')
          .select('id, sender_id, reciever_id, message, message_time')
          .is('reciever_id', null)
          .order('message_time', { ascending: true });

        if (e) throw e;
        setMessages(data || []);

      } else {
        /*
          DIRECT CHANNEL with a specific admin.
          4 separate queries:
            A. this admin → me      (direct)
            B. me → this admin      (direct)
            C. this admin → null    (admin broadcast to all caterers)
            D. me → null            (my broadcast to all admins)
        */
        const adminId = sel.admin_id;

        const [aToMe, meToA, adminBcast, myBcast] = await Promise.all([
          // A: this admin → me (direct)
          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .eq('sender_id', adminId)
            .eq('reciever_id', myId)
            .order('message_time', { ascending: true }),

          // B: me → this admin (direct)
          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .eq('sender_id', myId)
            .eq('reciever_id', adminId)
            .order('message_time', { ascending: true }),

          // C: this admin → null (admin broadcast to all caterers)
          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .eq('sender_id', adminId)
            .is('reciever_id', null)
            .order('message_time', { ascending: true }),

          // D: me → null (my broadcast to all admins)
          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .eq('sender_id', myId)
            .is('reciever_id', null)
            .order('message_time', { ascending: true }),
        ]);

        if (aToMe.error)      throw aToMe.error;
        if (meToA.error)      throw meToA.error;
        if (adminBcast.error) throw adminBcast.error;
        if (myBcast.error)    throw myBcast.error;

        const merged = dedupe([
          ...(aToMe.data      || []),
          ...(meToA.data      || []),
          ...(adminBcast.data || []),
          ...(myBcast.data    || []),
        ]).sort((a, b) => new Date(a.message_time) - new Date(b.message_time));

        setMessages(merged);
      }
    } catch (err) {
      console.error('fetchMessages error', err);
      setError('Failed to load messages. Please try again.');
    } finally {
      setMsgLoading(false);
    }
  }, []);

  /* ══════════════════════════════════════════
     3. REAL-TIME SUBSCRIPTION
  ══════════════════════════════════════════ */
  useEffect(() => {
    if (!selected || !catererId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const selAdminId = selected.admin_id;
    const isBcastCh  = selAdminId === BROADCAST_ID;

    const ch = supabase
      .channel(`caterer-msg-${selAdminId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg           = payload.new;
          const senderIsAdmin = adminIdSet.has(msg.sender_id);
          const senderIsMe    = msg.sender_id === catererId;
          const isBcast       = msg.reciever_id === null;

          let relevant = false;

          if (isBcastCh) {
            // Broadcast channel: any null-receiver message
            relevant = isBcast;
          } else {
            // A: this admin → me (direct)
            const adminToMe  = senderIsAdmin && msg.sender_id === selAdminId && msg.reciever_id === catererId;
            // B: me → this admin (direct)
            const meToAdmin  = senderIsMe && msg.reciever_id === selAdminId;
            // C: this admin's broadcast to all caterers
            const adminBcast = senderIsAdmin && msg.sender_id === selAdminId && isBcast;
            // D: my broadcast to all admins
            const myBcast    = senderIsMe && isBcast;

            relevant = adminToMe || meToAdmin || adminBcast || myBcast;
          }

          if (relevant) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg].sort(
                (a, b) => new Date(a.message_time) - new Date(b.message_time)
              );
            });
          }
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [selected, catererId, adminIdSet]);

  /* ══════════════════════════════════════════
     4. RE-FETCH ON SELECTION CHANGE
  ══════════════════════════════════════════ */
  useEffect(() => {
    if (selected && catererId) fetchMessages(selected, catererId);
  }, [selected, catererId, fetchMessages]);

  /* ══════════════════════════════════════════
     5. SCROLL TO BOTTOM
  ══════════════════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ══════════════════════════════════════════
     6. SELECT CHANNEL
  ══════════════════════════════════════════ */
  const selectChannel = (item) => {
    setSelected(item);
    setInput('');
    setError('');
  };

  /* ══════════════════════════════════════════
     7. SEND
       Direct to admin       → reciever_id = admin.admin_id
       Broadcast to admins   → reciever_id = null
  ══════════════════════════════════════════ */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selected || !catererId || sending) return;

    setSending(true);
    setError('');

    const isBcast = selected.admin_id === BROADCAST_ID;
    const payload = {
      sender_id:    catererId,
      reciever_id:  isBcast ? null : selected.admin_id,
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
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    } catch (err) {
      console.error('send error', err);
      setError('Failed to send. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ══════════════════════════════════════════
     8. RENDER MESSAGES

     PER-MESSAGE role logic:
       sender_id in adminIdSet   → ADMIN sent  → LEFT  (received)
       sender_id === catererId   → I sent       → RIGHT (sent)
       reciever_id === null      → broadcast

     Colour scheme:
       My direct msg      → orange gradient  (right)
       My broadcast       → purple gradient  (right)
       Admin direct       → neutral bg-hover (left)
       Admin broadcast    → green tint       (left)
  ══════════════════════════════════════════ */
  const isBroadcastChannel = selected?.admin_id === BROADCAST_ID;

  const getAdminName = (senderId) =>
    admins.find(a => a.admin_id === senderId)?.name || 'Admin';

  const renderMessages = () => {
    if (!messages.length) return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '8px', color: 'var(--text-muted)',
      }}>
        <MessageSquareDashed size={44} style={{ opacity: 0.2 }} />
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>No messages yet</p>
        <p style={{ margin: 0, fontSize: '0.78rem', textAlign: 'center' }}>
          {isBroadcastChannel
            ? 'Send a message to all admins below'
            : `Start a conversation with ${selected?.name}`}
        </p>
      </div>
    );

    const items = [];
    let lastDate = null;

    messages.forEach((msg, i) => {
      const ts            = msg.message_time;
      const senderIsAdmin = adminIdSet.has(msg.sender_id);
      const senderIsMe    = msg.sender_id === catererId || msg.sender_id?.startsWith('temp-');
      const isBcast       = msg.reciever_id === null;

      // I sent it → right. Admin sent it → left.
      const isSent = senderIsMe;

      // Date separator
      if (!lastDate || !isSameDay(lastDate, ts)) {
        items.push(<DateSep key={`sep-${i}`} ts={ts} />);
        lastDate = ts;
      }

      // Sender label
      let senderLabel = null;
      if (isSent && isBcast) {
        senderLabel = 'You · Broadcast to all admins';
      } else if (!isSent && senderIsAdmin) {
        senderLabel = isBcast
          ? `${getAdminName(msg.sender_id)} · Broadcast to all caterers`
          : getAdminName(msg.sender_id);
      }

      items.push(
        <div
          key={msg.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isSent ? 'flex-end' : 'flex-start',
            marginBottom: '6px',
          }}
        >
          {senderLabel && (
            <span style={{
              fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px',
              paddingLeft: isSent ? 0 : '4px',
              paddingRight: isSent ? '4px' : 0,
            }}>
              {senderLabel}
            </span>
          )}

          <div style={{
            maxWidth: '65%',
            padding: '10px 14px',
            borderRadius: isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            background: isSent
              ? (isBcast
                  ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)'  // my broadcast → purple
                  : 'linear-gradient(135deg, #e67e22, #f39c12)') // my direct    → orange
              : (isBcast
                  ? 'rgba(46,204,113,0.12)'  // admin broadcast → green tint
                  : 'var(--bg-hover)'),       // admin direct    → neutral
            color: isSent ? '#fff' : 'var(--text-main)',
            border: isSent
              ? 'none'
              : (isBcast
                  ? '1px solid rgba(46,204,113,0.25)'
                  : '1px solid var(--border-color)'),
            boxShadow: isSent ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
          }}>
            {msg.message}
            <div style={{
              fontSize: '0.65rem', marginTop: '5px',
              textAlign: 'right',
              opacity: isSent ? 0.75 : 0.55,
            }}>
              {fmtTime(ts)}
            </div>
          </div>
        </div>
      );
    });

    return items;
  };

  /* ══════════════════════════════════════════
     LOADING GATE
  ══════════════════════════════════════════ */
  if (loading) return (
    <div className="admin-loading">
      <Loader2 size={22} className="spin" /> Loading messages…
    </div>
  );

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div className="messages-layout">

      {/* ── Sidebar ── */}
      <div className="messages-sidebar">
        <div className="messages-sidebar-header">Conversations</div>
        <div className="caterer-list">

          {/* Broadcast — pinned at top */}
          <div
            className={`caterer-item ${selected?.admin_id === BROADCAST_ID ? 'active' : ''}`}
            onClick={() => selectChannel({ admin_id: BROADCAST_ID, name: 'Broadcast — All Admins' })}
            style={{
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '6px', paddingBottom: '10px',
            }}
          >
            <div className="caterer-avatar" style={{
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Radio size={16} />
            </div>
            <div>
              <div className="caterer-item-name" style={{ color: 'var(--primary-blue)' }}>
                Broadcast All
              </div>
              <div className="caterer-item-sub">Send to all admins at once</div>
            </div>
          </div>

          {/* Individual admins */}
          {admins.length === 0
            ? (
              <div className="admin-empty" style={{ padding: '20px 10px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No admins found</p>
              </div>
            )
            : admins.map(a => (
              <div
                key={a.admin_id}
                className={`caterer-item ${selected?.admin_id === a.admin_id ? 'active' : ''}`}
                onClick={() => selectChannel(a)}
              >
                <div className="caterer-avatar">{getInitials(a.name)}</div>
                <div>
                  <div className="caterer-item-name">{a.name || 'Admin'}</div>
                  <div className="caterer-item-sub">{a.phone_no || 'Admin'}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="chat-area">
        {!selected ? (
          <div className="chat-empty">
            <MessageSquareDashed size={60} className="chat-empty-icon" />
            <p style={{ margin: 0, fontWeight: 600 }}>Select a conversation</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Choose an admin for direct messaging,<br />
              or use Broadcast to reach all admins.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
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
                <div className="caterer-avatar"
                  style={{ width: 40, height: 40, fontSize: '0.8rem', flexShrink: 0 }}>
                  {getInitials(selected.name)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="chat-header-name">
                  {isBroadcastChannel ? 'Broadcast — All Admins' : selected.name}
                </div>
                <div className="chat-header-sub">
                  {isBroadcastChannel
                    ? `Sends to all ${admins.length} admin${admins.length !== 1 ? 's' : ''}`
                    : (selected.phone_no || 'Admin')}
                </div>
              </div>
              {isBroadcastChannel && (
                <span style={{
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(108,92,231,0.12)', color: 'var(--primary-blue)',
                  fontSize: '0.72rem', fontWeight: 700,
                  border: '1px solid rgba(108,92,231,0.2)',
                }}>
                  BROADCAST
                </span>
              )}
            </div>

            {/* Hint bar */}
            <div style={{
              margin: '0 16px',
              padding: '8px 14px',
              background: isBroadcastChannel
                ? 'rgba(108,92,231,0.07)' : 'var(--bg-hover)',
              border: isBroadcastChannel
                ? '1px solid rgba(108,92,231,0.2)' : '1px solid var(--border-color)',
              borderRadius: '10px',
              fontSize: '0.75rem', color: 'var(--text-muted)',
              display: 'flex', gap: '8px', alignItems: 'center',
            }}>
              {isBroadcastChannel ? (
                <>
                  <Radio size={13} color="var(--primary-blue)" style={{ flexShrink: 0 }} />
                  Messages sent here go to{' '}
                  <strong style={{ color: 'var(--text-main)' }}>all admins</strong>.
                  Purple bubbles = your broadcast.
                </>
              ) : (
                <>
                  💬 Direct messages with {selected.name} ·
                  🟢 Green tint = admin broadcast (sent to all caterers)
                </>
              )}
            </div>

            {/* Messages */}
            <div className="chat-messages" style={{ paddingTop: '12px' }}>
              {msgLoading ? (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flex: 1,
                  gap: '8px', color: 'var(--text-muted)',
                }}>
                  <Loader2 size={18} className="spin" /> Loading messages…
                </div>
              ) : renderMessages()}
              <div ref={bottomRef} />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                margin: '0 16px', padding: '8px 14px',
                background: 'rgba(231,76,60,0.08)',
                border: '1px solid rgba(231,76,60,0.2)',
                borderRadius: '10px', fontSize: '0.78rem',
                color: 'var(--danger)',
                display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Input */}
            <div className="chat-input-row">
              <textarea
                className="chat-input"
                rows={1}
                placeholder={
                  isBroadcastChannel
                    ? `Broadcast to all ${admins.length} admins…`
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
                style={{
                  background: isBroadcastChannel
                    ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)'
                    : 'linear-gradient(135deg, #e67e22, #f39c12)',
                  opacity: (!input.trim() || sending) ? 0.5 : 1,
                }}
              >
                {sending
                  ? <Loader2 size={16} className="spin" />
                  : isBroadcastChannel ? <Radio size={17} /> : <Send size={17} />
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessagesView;