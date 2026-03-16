import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase'; // Adjust this import path to match your project structure
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      // 2. Fetch the user's role from the profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!error && profile) {
        setIsAuthenticated(true);
        setUserRole(profile.role);
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Show a loading spinner while checking auth status
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="spinner" size={40} color="orange" />
      </div>
    );
  }

  // If not logged in, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If logged in but doesn't have the required role, redirect to their correct dashboard
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirects to their respective role dashboard (e.g., if userRole is 'student', it goes to '/student')
    return <Navigate to={`/${userRole}`} replace />;
  }

  // If logged in and has the right role, render the requested page
  return children;
};

export default ProtectedRoute;