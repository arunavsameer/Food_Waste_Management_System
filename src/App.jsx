// App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase'; 
import { ThemeProvider } from './context/ThemeContext'; 
import ThemeToggle from './components/ThemeToggle';     
import ProtectedRoute from './components/ProtectedRoute';

// Import Pages
import Login from './pages/Login/Login';
import ForgotPassword from './pages/Login/ForgotPassword';
import Register from './pages/Login/Register';
import StudentDashboard from './pages/Student/StudentDashboard';
import UpdatePassword from './pages/Login/UpdatePassword';
import CatererDashboard from "./pages/Caterer/CatererDashboard";
import AdminDashboard from "./pages/Admin/AdminDashboard";

const AuthListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      // 1. Explicitly handle sign outs
      if (event === 'SIGNED_OUT') {
        window.location.replace('/');
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (!session) return;

        // 2. THE FIX: Only route them if they are on the login or register page!
        // If they are already in the admin/caterer/student dashboard, do nothing.
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '/register') {
          return; 
        }

        try {
          const userEmail = session.user.email;
          const userId = session.user.id;
          const googleName = session.user.user_metadata?.full_name || '';

          // Check if user already exists in official profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, mess_name')
            .eq('id', userId)
            .maybeSingle();

          if (profile) {
            // Route them to their dashboard
            if (profile.role === 'admin') navigate('/admin');
            else if (profile.role === 'caterer') navigate('/caterer', { state: { messName: profile.mess_name } });
            else navigate('/student');
            return;
          }

          // First Time Login: Check the Admin's pre-registration list
          const { data: preReg } = await supabase
            .from('pre_registrations')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (!preReg) {
            await supabase.auth.signOut();
            alert("Unauthorized: Your email has not been allocated to a mess by the Admin yet. Please contact support.");
            window.location.replace('/');
            return;
          }

          // User is Pre-Registered! Finalize their account setup.
          await supabase.from('profiles').upsert([
            { id: userId, email: userEmail, role: preReg.role, mess_name: preReg.role === 'admin' ? null : preReg.mess_name }
          ]);

          if (preReg.role === 'student') {
            const rollNo = userEmail.split('@')[0].toUpperCase();
            const finalName = googleName || rollNo; 

            await supabase.from('students').upsert([
              { id: userId, roll_no: rollNo, name: finalName, hostel: preReg.hostel, food_type: preReg.food_type, caterer_id: preReg.caterer_id }
            ]);
          } else if (preReg.role === 'caterer') {
            await supabase.from('caterers').upsert([
              { caterer_id: userId, name: preReg.mess_name, manager_name: preReg.manager_name, phone_no: preReg.phone_no }
            ]);
          } else if (preReg.role === 'admin') {
            await supabase.from('admins').upsert([
              { admin_id: userId, name: preReg.admin_name || googleName, phone_no: preReg.phone_no }
            ]);
          }

          // Cleanup: Remove them from the waiting room
          await supabase.from('pre_registrations').delete().eq('email', userEmail);

          // Navigate to correct dashboard
          if (preReg.role === 'admin') navigate('/admin');
          else if (preReg.role === 'caterer') navigate('/caterer', { state: { messName: preReg.mess_name } });
          else navigate('/student');

        } catch (error) {
          console.error("Account finalize error:", error);
          alert("An error occurred while setting up your account.");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null; 
};

function App() {
  return (
    <ThemeProvider> 
      <Router>
        <AuthListener />
        <ThemeToggle /> 
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/caterer" element={<ProtectedRoute allowedRoles={['caterer']}><CatererDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;