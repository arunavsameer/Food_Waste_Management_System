import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Utensils, ShieldAlert } from 'lucide-react';
import './Login.css';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student', // Default role
    mess_name: '' // Only needed if role is caterer
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Insert into Profiles Table (Critical for your Login logic)
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id, // Links profile to auth user
              role: formData.role,
              mess_name: formData.role === 'caterer' ? formData.mess_name : null,
              email: formData.email
            }
          ]);

        if (profileError) throw profileError;

        alert('Test user created successfully! You can now login.');
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ borderTop: '5px solid orange' }}>
      <div className="login-card">
        
        <div className="brand-header">
           <ShieldAlert className="logo-icon" size={28} color="orange" />
           <h1>Debug Register</h1>
        </div>
        <p className="welcome-text">Create test accounts for development</p>

        <form onSubmit={handleRegister} className="login-form">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input 
                type="email" name="email"
                placeholder="test@college.edu" 
                onChange={handleChange} required 
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" name="password"
                placeholder="Min 6 chars" 
                onChange={handleChange} required 
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="input-group">
            <label>Role</label>
            <div className="input-wrapper">
              <select 
                name="role" 
                value={formData.role} 
                onChange={handleChange}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', outline: 'none' }}
              >
                <option value="student">Student</option>
                <option value="caterer">Caterer (Mess Owner)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Conditional Input for Caterer */}
          {formData.role === 'caterer' && (
            <div className="input-group">
              <label>Mess Name</label>
              <div className="input-wrapper">
                <Utensils size={18} className="input-icon" />
                <input 
                  type="text" name="mess_name"
                  placeholder="e.g. Arora, Galav" 
                  onChange={handleChange} required 
                />
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Create Test User'}
          </button>
        </form>

        <div className="footer-links">
           <Link to="/">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;