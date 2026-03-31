import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, Leaf } from 'lucide-react';
import './Login.css';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Invalid or expired reset link.');
      }
    });
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      alert('Password updated successfully! You can now login.');
      navigate('/');
    } catch (err) {
      setError(err.message);
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
          <h1>New Password</h1>
        </div>
        <p className="welcome-text">Enter your new secure password below</p>

        <form onSubmit={handleUpdate} className="login-form">
          <div className="input-group">
            <label>New Password</label>
            <div className="input-wrapper">
              <Lock size={17} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="signin-btn"
            disabled={loading || error === 'Invalid or expired reset link.'}
          >
            {loading ? <Loader2 className="spinner" size={20} /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;