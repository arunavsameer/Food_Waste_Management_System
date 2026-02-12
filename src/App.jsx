import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import Auth components
import Login from './pages/Login/Login';
import ForgotPassword from './pages/Login/ForgotPassword';
import Register from './pages/Login/Register';
import StudentDashboard from './pages/Student/StudentDashboard';
import UpdatePassword from './pages/Login/UpdatePassword';
import CatererDashboard from "./pages/Caterer/CatererDashboard";

// Placeholder components
const AdminDashboard = () => <h2>Admin Dashboard (Analytics)</h2>;

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        
        {/* We will replace these later */}
        <Route path="/caterer" element={<CatererDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;