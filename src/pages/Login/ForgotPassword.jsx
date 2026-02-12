import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, Leaf } from 'lucide-react';
import './Login.css'; // Reusing the same CSS

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
        // This URL should point to a page where the user enters new password
        // e.g., 'http://localhost:5173/update-password'
        redirectTo: window.location.origin + '/update-password',
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Check your email for the password reset link.' 
      });
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="brand-header">
           <Leaf className="logo-icon" size={28} />
           <h1>Recovery</h1>
        </div>
        <p className="welcome-text">Enter your email to reset password</p>

        <form onSubmit={handleReset} className="login-form">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
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
            <div className={`error-message ${message.type === 'success' ? 'success-text' : ''}`} 
                 style={{ color: message.type === 'success' ? 'green' : undefined }}>
              {message.text}
            </div>
          )}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Send Reset Link'}
          </button>
        </form>

        <div className="footer-links" style={{ justifyContent: 'center' }}>
           <Link to="/" className="flex items-center gap-2">
             <ArrowLeft size={14} /> Back to Login
           </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;