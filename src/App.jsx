import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login';

// Placeholder components for now
const StudentDashboard = () => <h2>Student Dashboard (Calendar View)</h2>;
const CatererDashboard = () => <h2>Caterer Portal (Waste Entry)</h2>;
const AdminDashboard = () => <h2>Admin Dashboard (Analytics)</h2>;

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/caterer" element={<CatererDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
