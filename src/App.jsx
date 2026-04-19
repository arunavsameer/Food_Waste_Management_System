// App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase'; 
import { ThemeProvider } from './context/ThemeContext'; 
import { MenuParseProvider } from './context/MenuParseContext'; // <-- NEW IMPORT
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

        // 2. Only route them if they are on the login or register page!
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '/register') {
          return; 
        }

        try {
          const userEmail = session.user.email.toLowerCase(); // Force lowercase for safety
          const userId = session.user.id;
          const googleName = session.user.user_metadata?.full_name || '';

          // Check if user already exists in official profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, mess_name')
            .eq('id', userId)
            .maybeSingle();

          // We must check if they exist in BOTH profiles AND their role table to prevent partial creations
          let isFullyRegistered = false;
          if (profile) {
            if (profile.role === 'student') {
               const { data: studentRecord } = await supabase.from('students').select('id').eq('id', userId).maybeSingle();
               if (studentRecord) isFullyRegistered = true;
            } else if (profile.role === 'caterer') {
               const { data: catRecord } = await supabase.from('caterers').select('caterer_id').eq('caterer_id', userId).maybeSingle();
               if (catRecord) isFullyRegistered = true;
            } else if (profile.role === 'admin') {
               const { data: adminRecord } = await supabase.from('admins').select('admin_id').eq('admin_id', userId).maybeSingle();
               if (adminRecord) isFullyRegistered = true;
            }
          }

          if (isFullyRegistered) {
            // They are completely set up, route them safely.
            if (profile.role === 'admin') navigate('/admin');
            else if (profile.role === 'caterer') navigate('/caterer', { state: { messName: profile.mess_name } });
            else navigate('/student');
            return;
          }

          // First Time Login: Check the Admin's pre-registration list
          const { data: preReg } = await supabase
            .from('pre_registrations')
            .select('*')
            .ilike('email', userEmail) // Use ilike for case-insensitive matching
            .maybeSingle();

          if (!preReg) {
            await supabase.auth.signOut();
            alert("Unauthorized: Your email has not been allocated to a mess by the Admin yet. Please contact support.");
            window.location.replace('/');
            return;
          }

          // User is Pre-Registered! Finalize their account setup.
          const { error: profileErr } = await supabase.from('profiles').upsert([
            { id: userId, email: userEmail, role: preReg.role, mess_name: preReg.role === 'admin' ? null : preReg.mess_name }
          ]);
          if (profileErr) throw new Error("Profile creation failed: " + profileErr.message);

          if (preReg.role === 'student') {
            const rollNo = userEmail.split('@')[0].toUpperCase();
            const finalName = googleName || rollNo; 

            const { error: studentErr } = await supabase.from('students').upsert([
              { id: userId, roll_no: rollNo, name: finalName, hostel: preReg.hostel, food_type: preReg.food_type, caterer_id: preReg.caterer_id }
            ]);
            if (studentErr) throw new Error("Student creation failed: " + studentErr.message);
            
          } else if (preReg.role === 'caterer') {
            const { error: catErr } = await supabase.from('caterers').upsert([
              { caterer_id: userId, name: preReg.mess_name, manager_name: preReg.manager_name, phone_no: preReg.phone_no }
            ]);
            if (catErr) throw new Error("Caterer creation failed: " + catErr.message);
            
          } else if (preReg.role === 'admin') {
            const { error: adminErr } = await supabase.from('admins').upsert([
              { admin_id: userId, name: preReg.admin_name || googleName, phone_no: preReg.phone_no }
            ]);
            if (adminErr) throw new Error("Admin creation failed: " + adminErr.message);
          }

          // Cleanup: Remove them from the waiting room
          const { error: delErr } = await supabase.from('pre_registrations').delete().ilike('email', userEmail);
          if (delErr) throw new Error("Failed to clear pre-registration: " + delErr.message);

          // Navigate to correct dashboard
          if (preReg.role === 'admin') navigate('/admin');
          else if (preReg.role === 'caterer') navigate('/caterer', { state: { messName: preReg.mess_name } });
          else navigate('/student');

        } catch (error) {
          console.error("Account finalize error:", error);
          alert(`Account setup failed: ${error.message}. Please contact support.`);
          // Sign them out if it fails so they don't get stuck in a broken state
          await supabase.auth.signOut();
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
      {/* NEW: Wrapping the Router in our MenuParseProvider so background parsing survives navigation */}
      <MenuParseProvider>
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
      </MenuParseProvider>
    </ThemeProvider>
  );
}

export default App;