import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, Lock, Loader2, Utensils, ShieldAlert, 
  Hash, Phone, Building, UserCircle 
} from 'lucide-react';
import './Login.css';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // NEW: Google loading state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student', 
    mess_name: '',      
    name: '',           
    roll_no: '',        
    hostel: 'APJ',      
    food_type: 'veg',   
    manager_name: '',   
    phone_no: '',
    admin_name: '',
    admin_phone_no: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const fetchCatererId = async (messName) => {
    try {
      const { data, error } = await supabase
        .from('caterers')
        .select('caterer_id')
        .eq('name', messName)
        .single();
      if (error) throw error;
      return data?.caterer_id || null;
    } catch (err) {
      return null; 
    }
  };

  // --------------------------------------------------
  // Pre-Validation Logic (Used by both Email & Google)
  // --------------------------------------------------
  const runPreValidation = async () => {
    let catererId = null;
    if (formData.role === 'student') {
      const { data: existingStudent, error: rollError } = await supabase
        .from('students')
        .select('roll_no')
        .eq('roll_no', formData.roll_no)
        .maybeSingle();

      if (rollError) throw new Error("Failed to validate roll number.");
      if (existingStudent) throw new Error(`Roll Number ${formData.roll_no} already exists.`);

      catererId = await fetchCatererId(formData.mess_name);
      if (!catererId) throw new Error(`Invalid caterer: "${formData.mess_name}" does not exist.`);
    }
    return catererId;
  };

  // --------------------------------------------------
  // Standard Email/Password Registration
  // --------------------------------------------------
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const catererId = await runPreValidation();
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const userId = authData.user.id;
        // Insert Profiles
        const { error: profileError } = await supabase.from('profiles').insert([
          { id: userId, role: formData.role, mess_name: formData.role === 'admin' ? null : formData.mess_name, email: formData.email }
        ]);
        if (profileError) throw profileError;

        // Insert Role Specifics
        if (formData.role === 'student') {
          await supabase.from('students').insert([{ id: userId, roll_no: formData.roll_no, name: formData.name, hostel: formData.hostel, food_type: formData.food_type, caterer_id: catererId }]);
        } else if (formData.role === 'caterer') {
          await supabase.from('caterers').insert([{ caterer_id: userId, name: formData.mess_name, manager_name: formData.manager_name, phone_no: formData.phone_no }]);
        } else if (formData.role === 'admin') {
          await supabase.from('admins').insert([{ admin_id: userId, name: formData.admin_name, phone_no: formData.admin_phone_no }]);
        }
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // NEW: Google OAuth Registration
  // --------------------------------------------------
  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      // 1. Run the same checks (Does roll no exist? Does caterer exist?)
      const catererId = await runPreValidation();

      // 2. Save the form data to localStorage so it survives the redirect
      localStorage.setItem('debug_registration_data', JSON.stringify({
        ...formData,
        catererId // save the fetched ID so we don't have to fetch it again
      }));

      // 3. Trigger Google Login
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, 
          queryParams: {
            hd: 'iiti.ac.in' // Restrict to college domain
          }
        }
      });
      if (error) throw error;

    } catch (err) {
      setError(err.message || 'Failed to start Google registration.');
      setGoogleLoading(false);
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
          {/* Email & Password are only required if they use the standard register button */}
          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input type="email" name="email" placeholder="test@college.edu" value={formData.email} onChange={handleChange} />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input type="password" name="password" placeholder="Min 6 chars" value={formData.password} onChange={handleChange} />
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

          {/* ... Keep all your existing conditional fields for Student, Caterer, Admin here ... */}
          {/* I have omitted them here for brevity, keep them exactly as you had them! */}
          {formData.role === 'student' && (
            <>
              <div className="input-group">
                <label>Roll Number</label>
                <div className="input-wrapper">
                  <Hash size={18} className="input-icon" />
                  <input type="text" name="roll_no" placeholder="e.g., 2023CSB1001" value={formData.roll_no} onChange={handleChange} required />
                </div>
              </div>
              {/* Keep the rest of your student inputs */}
            </>
          )}

          {(formData.role === 'student' || formData.role === 'caterer') && (
            <div className="input-group">
              <label>{formData.role === 'student' ? 'Mess Name to Subscribe' : 'Your Mess Name'}</label>
              <div className="input-wrapper">
                <Utensils size={18} className="input-icon" />
                <input type="text" name="mess_name" placeholder="Enter Mess Name" value={formData.mess_name} onChange={handleChange} required />
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="signin-btn" disabled={loading || googleLoading}>
            {loading ? <Loader2 className="spinner" size={20} /> : 'Register with Email'}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        {/* NEW: Google Register Button */}
        <button 
          type="button" 
          onClick={handleGoogleRegister} 
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
              Register with Google
            </>
          )}
        </button>

        <div className="footer-links">
           <Link to="/">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;