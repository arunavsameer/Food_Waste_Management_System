import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Leaf } from 'lucide-react'; 
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // --- TEMPORARY DEV MODE ---
    // Since we haven't set up the database yet, this allows you to see the UI.
    // Remove this block once Supabase is connected.
    if (formData.email === 'admin@test.com') {
        navigate('/admin'); return;
    } else if (formData.email === 'caterer@test.com') {
        navigate('/caterer'); return;
    } else if (formData.email === 'student@test.com') {
        navigate('/student'); return;
    }
    // --------------------------

    try {
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Logic to fetch role will go here later
      navigate('/student'); // Default fallback

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        
        {/* Brand Header */}
        <div className="brand-header">
          <div className="logo-wrapper">
             <Leaf className="logo-icon" size={28} />
          </div>
          <h1>EcoPlate</h1>
        </div>
        <p className="welcome-text">Campus Food Waste Management Portal</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input 
                type="email" 
                name="email"
                placeholder="id@college.edu" 
                value={formData.email}
                onChange={handleChange}
                required 
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" 
                name="password"
                placeholder="••••••••" 
                value={formData.password}
                onChange={handleChange}
                required 
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Sign In'}
          </button>
        </form>

        <div className="footer-links">
            <p>Login as <span onClick={() => setFormData({email: 'admin@test.com', password: '123'})}>Admin</span>, <span onClick={() => setFormData({email: 'caterer@test.com', password: '123'})}>Caterer</span>, or <span onClick={() => setFormData({email: 'student@test.com', password: '123'})}>Student</span> (Demo)</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
