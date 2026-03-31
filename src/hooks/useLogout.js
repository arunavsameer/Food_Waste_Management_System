import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const useLogout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error during logout:", error.message);
    } finally {
      // Clear any lingering local storage data
      localStorage.removeItem('debug_registration_data');
      
      // Force navigation back to login
      navigate('/', { replace: true });
    }
  };

  return handleLogout;
};