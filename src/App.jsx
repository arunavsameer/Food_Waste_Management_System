import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import your Auth components
import Login from './pages/Login/Login';
import ForgotPassword from './pages/Login/ForgotPassword';
import Register from './pages/Login/Register';
import UpdatePassword from './pages/Login/UpdatePassword'; // <--- Import this

// Placeholder components
const StudentDashboard = () => <h2>Student Dashboard (Calendar View)</h2>;
const CatererDashboard = () => <h2>Caterer Portal (Waste Entry)</h2>;
const AdminDashboard = () => <h2>Admin Dashboard (Analytics)</h2>;

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        
        {/* Add this new route */}
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Protected Dashboard Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/caterer" element={<CatererDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;