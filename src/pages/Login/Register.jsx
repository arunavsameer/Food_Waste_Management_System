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
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student', 
    mess_name: '',      
    
    // Student specific fields
    name: '',           
    roll_no: '',        
    hostel: 'APJ',      // Set default to first enum value 
    food_type: 'veg',   
    
    // Caterer specific fields
    manager_name: '',   
    phone_no: '',

    // Admin specific fields
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // ==========================================
      // PRE-VALIDATION: Check Roll No & Caterer before Auth
      // ==========================================
      let catererId = null;
      
      if (formData.role === 'student') {
        // 1. Pre-check if the Roll Number already exists
        const { data: existingStudent, error: rollError } = await supabase
          .from('students')
          .select('roll_no')
          .eq('roll_no', formData.roll_no)
          .maybeSingle(); // maybeSingle returns 1 row or null without throwing an error

        if (rollError) {
          throw new Error("Failed to validate roll number. Please try again.");
        }

        if (existingStudent) {
          throw new Error(`An account with Roll Number ${formData.roll_no} already exists.`);
        }

        // 2. Pre-check if the Caterer exists
        catererId = await fetchCatererId(formData.mess_name);
        if (!catererId) {
          throw new Error(`Invalid caterer: "${formData.mess_name}" does not exist. Please check the spelling.`);
        }
      }

      // ==========================================
      // REGISTRATION EXECUTION
      // ==========================================
      
      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const userId = authData.user.id;

        // 2. Insert into the main Profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: userId,
              role: formData.role,
              mess_name: formData.role === 'admin' ? null : formData.mess_name, 
              email: formData.email
            }
          ]);

        if (profileError) throw profileError;

        // 3. Conditionally insert into Students or Caterers table
        if (formData.role === 'student') {
          const { error: studentError } = await supabase
            .from('students')
            .insert([
              {
                id: userId, 
                roll_no: formData.roll_no,
                name: formData.name,
                hostel: formData.hostel, // Now guaranteed to be an exact match to the enum
                food_type: formData.food_type, 
                caterer_id: catererId 
              }
            ]);
          if (studentError) throw studentError;
        } 
        else if (formData.role === 'caterer') {
          const { error: catererError } = await supabase
            .from('caterers')
            .insert([
              {
                caterer_id: userId, 
                name: formData.mess_name, 
                manager_name: formData.manager_name,
                phone_no: formData.phone_no
              }
            ]);
          if (catererError) throw catererError;
        }
        else if (formData.role === 'admin') {
          const { error: adminError } = await supabase
            .from('admins')
            .insert([
              {
                admin_id: userId,
                name: formData.admin_name,
                phone_no: formData.admin_phone_no
              }
            ]);
          if (adminError) throw adminError;
        }
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration.');
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

          {formData.role === 'student' && (
            <>
              <div className="input-group">
                <label>Full Name</label>
                <div className="input-wrapper">
                  <UserCircle size={18} className="input-icon" />
                  <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleChange} required />
                </div>
              </div>

              <div className="input-group">
                <label>Roll Number</label>
                <div className="input-wrapper">
                  <Hash size={18} className="input-icon" />
                  <input type="text" name="roll_no" placeholder="e.g., 2023CSB1001" value={formData.roll_no} onChange={handleChange} required />
                </div>
              </div>

              <div className="input-group">
                <label>Hostel</label>
                <div className="input-wrapper">
                  {/* Converted to dropdown matching the DB enum exactly */}
                  <select name="hostel" value={formData.hostel} onChange={handleChange} className="styled-select">
                    <option value="APJ">APJ</option>
                    <option value="CVR">CVR</option>
                    <option value="DA">DA</option>
                    <option value="VSB">VSB</option>
                    <option value="HJB">HJB</option>
                    <option value="JCB">JCB</option>
                    <option value="PM Ajay">PM Ajay</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label>Food Type</label>
                <div className="input-wrapper">
                  <select name="food_type" value={formData.food_type} onChange={handleChange} className="styled-select">
                    <option value="veg">Vegetarian</option>
                    <option value="non_veg">Non-Vegetarian</option>
                    <option value="jain">Jain</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {formData.role === 'caterer' && (
            <>
              <div className="input-group">
                <label>Manager Name</label>
                <div className="input-wrapper">
                  <UserCircle size={18} className="input-icon" />
                  <input type="text" name="manager_name" placeholder="Manager's Full Name" value={formData.manager_name} onChange={handleChange} required />
                </div>
              </div>

              <div className="input-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <Phone size={18} className="input-icon" />
                  <input type="text" name="phone_no" placeholder="e.g., +91 9876543210" value={formData.phone_no} onChange={handleChange} required />
                </div>
              </div>
            </>
          )}

          {formData.role === 'admin' && (
            <>
              <div className="input-group">
                <label>Full Name</label>
                <div className="input-wrapper">
                  <UserCircle size={18} className="input-icon" />
                  <input type="text" name="admin_name" placeholder="Admin's Full Name" value={formData.admin_name} onChange={handleChange} required />
                </div>
              </div>

              <div className="input-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <Phone size={18} className="input-icon" />
                  <input type="text" name="admin_phone_no" placeholder="e.g., +91 9876543210" value={formData.admin_phone_no} onChange={handleChange} required />
                </div>
              </div>
            </>
          )}

          {(formData.role === 'student' || formData.role === 'caterer') && (
            <div className="input-group">
              <label>{formData.role === 'student' ? 'Mess Name to Subscribe' : 'Your Mess Name'}</label>
              <div className="input-wrapper">
                <Utensils size={18} className="input-icon" />
                <input 
                  type="text" 
                  name="mess_name" 
                  placeholder="Enter Mess Name" 
                  value={formData.mess_name} 
                  onChange={handleChange} 
                  maxLength={100}
                  required 
                />
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