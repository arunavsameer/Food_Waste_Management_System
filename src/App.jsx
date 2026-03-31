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

// ==========================================
// NEW: Auth Listener Component
// ==========================================
// This invisible component sits inside the Router to handle 
// the redirect after a user comes back from Google Login.
const AuthListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      if (event === 'SIGNED_IN' && session) {
        try {
          const userEmail = session.user.email;
          const userId = session.user.id;

          // Reject non-iiti.ac.in emails immediately
          if (!userEmail.endsWith('@iiti.ac.in')) {
            await supabase.auth.signOut();
            alert("Unauthorized: Only @iiti.ac.in email addresses are allowed.");
            navigate('/');
            return;
          }

          // ========================================================
          // NEW: Intercept Google Registration from localStorage
          // ========================================================
          const pendingRegString = localStorage.getItem('debug_registration_data');
          
          if (pendingRegString) {
            const regData = JSON.parse(pendingRegString);
            
            // 1. Upsert into Profiles (Using upsert to prevent errors if it somehow exists)
            await supabase.from('profiles').upsert([
              { id: userId, role: regData.role, mess_name: regData.role === 'admin' ? null : regData.mess_name, email: userEmail }
            ]);

            // 2. Upsert into specific role tables
            if (regData.role === 'student') {
              // We use the real Google Name if they didn't provide one, or fallback to the form
              const finalName = regData.name || session.user.user_metadata?.full_name || 'Student';
              await supabase.from('students').upsert([
                { id: userId, roll_no: regData.roll_no, name: finalName, hostel: regData.hostel, food_type: regData.food_type, caterer_id: regData.catererId }
              ]);
            } else if (regData.role === 'caterer') {
              await supabase.from('caterers').upsert([
                { caterer_id: userId, name: regData.mess_name, manager_name: regData.manager_name, phone_no: regData.phone_no }
              ]);
            } else if (regData.role === 'admin') {
              await supabase.from('admins').upsert([
                { admin_id: userId, name: regData.admin_name, phone_no: regData.admin_phone_no }
              ]);
            }

            // 3. Clear the localStorage so this only runs once!
            localStorage.removeItem('debug_registration_data');
          }
          // ========================================================

          // Now proceed with normal login routing...
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, mess_name')
            .eq('email', userEmail)
            .single();

          if (profileError || !profile) {
            await supabase.auth.signOut();
            alert("Unauthorized: Your email is not registered in the college database.");
            navigate('/');
            return;
          }

          if (profile.role === 'admin') navigate('/admin');
          else if (profile.role === 'caterer') navigate('/caterer', { state: { messName: profile.mess_name } });
          else navigate('/student');

        } catch (error) {
          console.error("Routing error:", error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null; 
};

// ==========================================
// Main App Component
// ==========================================
function App() {
  return (
    <ThemeProvider> 
      <Router>
        {/* Mount the Auth Listener inside the Router */}
        <AuthListener />
        
        <ThemeToggle /> 
        
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          
          {/* Protected Routes */}
          <Route 
            path="/student" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/caterer" 
            element={
              <ProtectedRoute allowedRoles={['caterer']}>
                <CatererDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;