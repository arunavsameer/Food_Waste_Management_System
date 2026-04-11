import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { parseTemplateMessage } from '../../../utils/messageTemplates';
import { Send, MessageSquareDashed, Loader2, Radio, AlertCircle, RefreshCw } from 'lucide-react';

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
const AdminMessagesView = () => {
  const [adminId,    setAdminId]    = useState(null);
  const [adminIdSet, setAdminIdSet] = useState(new Set());
  const [caterers,   setCaterers]   = useState([]);
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
        setAdminId(myId);

        const [{ data: cats }, { data: adminProfiles }] = await Promise.all([
          supabase.from('caterers').select('caterer_id, name, manager_name, phone_no').order('name'),
          supabase.from('profiles').select('id').eq('role', 'admin'),
        ]);

        setCaterers(cats || []);
        setAdminIdSet(new Set((adminProfiles || []).map(p => p.id)));
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
  ══════════════════════════════════════════ */
  const fetchMessages = useCallback(async (sel, myAdminId) => {
    if (!sel || !myAdminId) return;
    setMsgLoading(true);
    setMessages([]);
    setError('');

    try {
      if (sel.caterer_id === BROADCAST_ID) {
        const { data, error: e } = await supabase
          .from('messages')
          .select('id, sender_id, reciever_id, message, message_time')
          .is('reciever_id', null)
          .order('message_time', { ascending: true });

        if (e) throw e;
        setMessages(data || []);

      } else {
        const catererId = sel.caterer_id;

        const [p2pResult, adminBcastResult, catBcastResult] = await Promise.all([
          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .or(`and(sender_id.eq.${myAdminId},reciever_id.eq.${catererId}),and(sender_id.eq.${catererId},reciever_id.eq.${myAdminId})`)
            .order('message_time', { ascending: true }),

          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .eq('sender_id', myAdminId)
            .is('reciever_id', null)
            .order('message_time', { ascending: true }),

          supabase
            .from('messages')
            .select('id, sender_id, reciever_id, message, message_time')
            .eq('sender_id', catererId)
            .is('reciever_id', null)
            .order('message_time', { ascending: true }),
        ]);

        if (p2pResult.error)        throw p2pResult.error;
        if (adminBcastResult.error) throw adminBcastResult.error;
        if (catBcastResult.error)   throw catBcastResult.error;

        const merged = dedupe([
          ...(p2pResult.data        || []),
          ...(adminBcastResult.data || []),
          ...(catBcastResult.data   || []),
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
    if (!selected || !adminId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const catererId = selected.caterer_id;

    const ch = supabase
      .channel(`msg-${catererId}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new;
          const senderIsAdmin   = adminIdSet.has(msg.sender_id);
          const isBroadcast     = msg.reciever_id === null;
          let relevant = false;

          if (catererId === BROADCAST_ID) {
            relevant = isBroadcast;
          } else {
            const isAdminToCaterer = senderIsAdmin && msg.reciever_id === catererId;
            const isCatererToAdmin = msg.sender_id === catererId && !isBroadcast && adminIdSet.has(msg.reciever_id);
            const isAdminBroadcast = senderIsAdmin && isBroadcast;
            const isCatererBcast   = msg.sender_id === catererId && isBroadcast;
            relevant = isAdminToCaterer || isCatererToAdmin || isAdminBroadcast || isCatererBcast;
          }

          if (relevant) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              const updated = [...prev, msg];
              updated.sort((a, b) => new Date(a.message_time) - new Date(b.message_time));
              return updated;
            });
          }
        }
      )
      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [selected, adminId, adminIdSet]);

  /* ══════════════════════════════════════════
     4. RE-FETCH ON SELECTION CHANGE
  ══════════════════════════════════════════ */
  useEffect(() => {
    if (selected && adminId) fetchMessages(selected, adminId);
  }, [selected, adminId, fetchMessages]);

  /* ══════════════════════════════════════════
     5. SCROLL
  ══════════════════════════════════════════ */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectChannel = (item) => {
    setSelected(item);
    setInput('');
    setError('');
  };

  /* ══════════════════════════════════════════
     7. SEND
  ══════════════════════════════════════════ */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selected || !adminId || sending) return;

    setSending(true);
    setError('');

    const isBcast = selected.caterer_id === BROADCAST_ID;
    const payload = {
      sender_id:    adminId,
      reciever_id:  isBcast ? null : selected.caterer_id,
      message:      text,
      message_time: new Date().toISOString(),
    };

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
  ══════════════════════════════════════════ */
  const isBroadcastChannel = selected?.caterer_id === BROADCAST_ID;

  const getCatererName = (senderId) =>
    caterers.find(c => c.caterer_id === senderId)?.name || 'Caterer';

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
            ? 'Send a broadcast to all caterers below'
            : `Start a conversation with ${selected?.name}`}
        </p>
      </div>
    );

    const items = [];
    let lastDate = null;

    messages.forEach((msg, i) => {
      const ts         = msg.message_time;
      const senderIsAdmin = adminIdSet.has(msg.sender_id) || msg.sender_id?.startsWith('temp-');
      const isBcast    = msg.reciever_id === null;
      const isSent     = senderIsAdmin;

      if (!lastDate || !isSameDay(lastDate, ts)) {
        items.push(<DateSep key={`sep-${i}`} ts={ts} />);
        lastDate = ts;
      }

      let senderLabel = null;
      if (isSent && isBcast) {
        senderLabel = `You · Broadcast to all`;
      } else if (!isSent) {
        senderLabel = isBcast
          ? `${getCatererName(msg.sender_id)} · to all admins`
          : getCatererName(msg.sender_id);
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
            whiteSpace: 'pre-wrap', 
            background: isSent
              ? (isBcast ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : 'var(--primary-green)')
              : (isBcast ? 'rgba(108,92,231,0.12)' : 'var(--bg-hover)'),
            color: isSent ? '#fff' : 'var(--text-main)',
            border: isSent ? 'none' : (isBcast ? '1px solid rgba(108,92,231,0.25)' : '1px solid var(--border-color)'),
            boxShadow: isSent ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          }}>
            {parseTemplateMessage(msg.message)}
            <div style={{
              fontSize: '0.65rem', marginTop: '5px', textAlign: 'right',
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
     RENDER
  ══════════════════════════════════════════ */
  if (loading) return (
    <div className="admin-loading">
      <Loader2 size={22} className="spin" /> Loading messages…
    </div>
  );

  return (
    <div className="messages-layout">
      {/* ── Sidebar ── */}
      <div className="messages-sidebar">
        <div className="messages-sidebar-header">Conversations</div>
        <div className="caterer-list">
          <div
            className={`caterer-item ${selected?.caterer_id === BROADCAST_ID ? 'active' : ''}`}
            onClick={() => selectChannel({ caterer_id: BROADCAST_ID, name: 'Broadcast — All Caterers' })}
            style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '6px', paddingBottom: '10px' }}
          >
            <div className="caterer-avatar" style={{
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Radio size={16} />
            </div>
            <div>
              <div className="caterer-item-name" style={{ color: 'var(--primary-blue)' }}>Broadcast</div>
              <div className="caterer-item-sub">Send to all caterers at once</div>
            </div>
          </div>

          {caterers.length === 0
            ? <div className="admin-empty" style={{ padding: '20px 10px' }}><p style={{ margin: 0, fontSize: '0.85rem' }}>No caterers found</p></div>
            : caterers.map(c => (
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
              Choose a caterer for direct messaging,<br />or use Broadcast to reach all caterers.
            </p>
          </div>
        ) : (
          <>
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
                  {isBroadcastChannel ? 'Broadcast — All Caterers' : selected.name}
                </div>
                <div className="chat-header-sub">
                  {isBroadcastChannel
                    ? `Sends to all ${caterers.length} caterer${caterers.length !== 1 ? 's' : ''}`
                    : `${selected.manager_name ? `${selected.manager_name} · ` : ''}${selected.phone_no || 'No phone on file'}`
                  }
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
              <button
                className="icon-btn"
                onClick={() => fetchMessages(selected, adminId)}
                disabled={msgLoading}
                title="Refresh messages"
              >
                <RefreshCw size={15} className={msgLoading ? 'spin' : ''} />
              </button>
            </div>

            <div style={{
              margin: '0 16px', padding: '8px 14px',
              background: isBroadcastChannel ? 'rgba(108,92,231,0.07)' : 'var(--bg-hover)',
              border: isBroadcastChannel ? '1px solid rgba(108,92,231,0.2)' : '1px solid var(--border-color)',
              borderRadius: '10px', fontSize: '0.75rem', color: 'var(--text-muted)',
              display: 'flex', gap: '8px', alignItems: 'center',
            }}>
              {isBroadcastChannel ? (
                <><Radio size={13} color="var(--primary-blue)" style={{ flexShrink: 0 }} />
                Messages sent here go to <strong style={{ color: 'var(--text-main)' }}>all caterers</strong></>
              ) : (
                <>Direct messages with {selected.name}</>
              )}
            </div>

            <div className="chat-messages" style={{ paddingTop: '12px' }}>
              {msgLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '8px', color: 'var(--text-muted)' }}>
                  <Loader2 size={18} className="spin" /> Loading messages…
                </div>
              ) : renderMessages()}
              <div ref={bottomRef} />
            </div>

            {error && (
              <div style={{
                margin: '0 16px', padding: '8px 14px',
                background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)',
                borderRadius: '10px', fontSize: '0.78rem',
                color: 'var(--danger)', display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

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

export default AdminMessagesView;