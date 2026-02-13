import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext'; // Import Provider
import ThemeToggle from './components/ThemeToggle';     // Import Button

// Import Pages
import Login from './pages/Login/Login';
import ForgotPassword from './pages/Login/ForgotPassword';
import Register from './pages/Login/Register';
import StudentDashboard from './pages/Student/StudentDashboard';
import UpdatePassword from './pages/Login/UpdatePassword';
import CatererDashboard from "./pages/Caterer/CatererDashboard";

// Placeholder
const AdminDashboard = () => <h2>Admin Dashboard (Analytics)</h2>;

function App() {
  return (
    <ThemeProvider> {/* 1. Wrap entire app */}
      <Router>
        <ThemeToggle /> {/* 2. Add floating button here */}
        
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/caterer" element={<CatererDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;