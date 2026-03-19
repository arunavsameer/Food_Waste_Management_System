import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <ThemeProvider> 
      <Router>
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