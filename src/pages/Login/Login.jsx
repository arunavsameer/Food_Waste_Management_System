import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Leaf } from 'lucide-react'; 
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // Separate loading state for Google
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Standard Email/Password Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, mess_name')
        .eq('id', user.id)
        .single();

      if (profileError) throw new Error("Profile not found. Please contact admin.");

      if (profile.role === 'admin') navigate('/admin');
      else if (profile.role === 'caterer') navigate('/caterer', { state: { messName: profile.mess_name } });
      else navigate('/student');

    } catch (err) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Google OAuth Login
const handleGoogleLogin = async () => {
  setGoogleLoading(true);
  setError('');
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: 'iiti.ac.in' 
        }
      }
    });
    if (error) throw error;
  } catch (err) {
    setError(err.message || 'Failed to initialize Google login');
    setGoogleLoading(false);
  }
};

  return (
    <div className="login-container">
      <div className="login-card">
        
        <div className="brand-header">
          <div className="logo-wrapper">
             <Leaf className="logo-icon" size={28} />
          </div>
          <h1>EcoPlate</h1>
        </div>
        <p className="welcome-text">Campus Food Waste Management Portal</p>

        <form onSubmit={handleLogin} className="login-form">
          {/* ... (Keep your existing email and password inputs here) ... */}
          
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

          <button type="submit" className="signin-btn" disabled={loading || googleLoading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Sign In'}
          </button>
        </form>

        {/* NEW: Google Login Divider and Button */}
        <div className="divider">
          <span>OR</span>
        </div>

        <button 
          type="button" 
          onClick={handleGoogleLogin} 
          className="google-btn" 
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="spinner" size={20} />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div className="footer-links">
           <Link to="/forgot-password">Forgot Password?</Link>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6 }}>
            <Link to="/register">Create Test Account (Debug)</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;