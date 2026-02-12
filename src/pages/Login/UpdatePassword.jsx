// src/pages/Login/UpdatePassword.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Make sure this path is correct
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, Leaf } from 'lucide-react'; 
import './Login.css'; // Reusing your existing styles

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Optional: Check if the user is actually authenticated (clicked the link)
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
      // This updates the password for the currently logged-in user
      // (The user is "logged in" because they clicked the email link)
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      });

      if (error) throw error;

      alert('Password updated successfully! You can now login.');
      navigate('/'); // Send them back to login page
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="brand-header">
           <Leaf className="logo-icon" size={28} />
           <h1>New Password</h1>
        </div>
        <p className="welcome-text">Enter your new secure password</p>

        <form onSubmit={handleUpdate} className="login-form">
          <div className="input-group">
            <label>New Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
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

          <button type="submit" className="signin-btn" disabled={loading || error === 'Invalid or expired reset link.'}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;