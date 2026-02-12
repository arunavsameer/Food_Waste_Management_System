import React, { useState } from 'react';
import { supabase } from '../../lib/subabase';
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

    try {
      // 1. Authenticate with Supabase Auth (Checks email/password)
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;

      // 2. Fetch the User's Role from the 'profiles' table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, mess_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new Error("Profile not found. Please contact admin.");
      }

      // 3. Redirect based on Role
      if (profile.role === 'admin') {
        navigate('/admin');
      } else if (profile.role === 'caterer') {
        // We pass the mess name (e.g., 'Arora') to the dashboard so they only see their data
        navigate('/caterer', { state: { messName: profile.mess_name } });
      } else {
        navigate('/student');
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to login');
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
           <a href="#">Forgot Password?</a>
        </div>
      </div>
    </div>
  );
};

export default Login;