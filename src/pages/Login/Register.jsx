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
    role: 'student', 
    mess_name: 'Arora' // Default for students
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Insert Profile with the selected MESS NAME
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              role: formData.role,
              // Both Students and Caterers now need a mess_name
              mess_name: formData.mess_name, 
              email: formData.email
            }
          ]);

        if (profileError) throw profileError;

        alert('Account created! Please log in.');
        navigate('/');
      }
    } catch (err) {
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
        <p className="welcome-text">Create account (Dev Mode)</p>

        <form onSubmit={handleRegister} className="login-form">
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input type="email" name="email" placeholder="test@college.edu" onChange={handleChange} required />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input type="password" name="password" placeholder="Min 6 chars" onChange={handleChange} required />
            </div>
          </div>

          <div className="input-group">
            <label>Role</label>
            <div className="input-wrapper">
              <select name="role" value={formData.role} onChange={handleChange} className="styled-select">
                <option value="student">Student</option>
                <option value="caterer">Caterer (Mess Owner)</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Show Mess Selection for BOTH Students and Caterers */}
          {(formData.role === 'student' || formData.role === 'caterer') && (
            <div className="input-group">
              <label>{formData.role === 'student' ? 'Select Your Mess Subscription' : 'Mess Name'}</label>
              <div className="input-wrapper">
                <Utensils size={18} className="input-icon" />
                <select name="mess_name" value={formData.mess_name} onChange={handleChange} className="styled-select">
                  <option value="Arora">Arora Mess</option>
                  <option value="Sheela">Sheela Mess</option>
                  <option value="Food Sutra">Food Sutra</option>
                </select>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Create Account'}
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