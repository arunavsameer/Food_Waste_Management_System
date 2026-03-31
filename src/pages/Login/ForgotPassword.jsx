import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, Leaf } from 'lucide-react';
import './Login.css';

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/update-password',
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Check your email for the password reset link.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Liquid glass orbs */}
      <div className="glass-orb glass-orb-1" />
      <div className="glass-orb glass-orb-2" />
      <div className="glass-orb glass-orb-3" />

      <div className="login-card">
        <div className="brand-header">
          <div className="logo-wrapper">
            <Leaf className="logo-icon" size={26} />
          </div>
          <h1>Recovery</h1>
        </div>
        <p className="welcome-text">Enter your email to reset your password</p>

        <form onSubmit={handleReset} className="login-form">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={17} className="input-icon" />
              <input
                type="email"
                placeholder="id@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {message.text && (
            <div className={`error-message ${message.type === 'success' ? 'success-text' : ''}`}>
              {message.text}
            </div>
          )}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Send Reset Link'}
          </button>
        </form>

        <div className="footer-links" style={{ justifyContent: 'center', marginTop: '24px' }}>
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft size={14} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;