import { supabase } from '../lib/supabase';

export const useLogout = () => {
  const handleLogout = async () => {
    try {
      // 1. Tell Supabase to kill the session globally
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error during logout:", error.message);
    } finally {
      // 2. Nuke local/session storage to prevent ghost sessions
      localStorage.clear();
      sessionStorage.clear();
      
      // 3. HARD redirect. This completely clears React's memory tree,
      // instantly stopping any frozen loading states or stuck API calls.
      window.location.replace('/');
    }
  };

  return handleLogout;
};