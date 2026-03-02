import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login'; // Ensure case matches filename
import Register from './pages/register';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerProfile from './pages/CustomerProfile'; // Import the new file
import NewShipment from './components/NewShipment';
import EditShipment from './components/EditShipment';
<<<<<<< HEAD
import VideoCallPage from './pages/VideoCallPage';
import OrderDetails from './pages/OrderDetails';
import AsyncVerificationPage from './pages/AsyncVerificationPage';
import IncomingCallOverlay from './components/IncomingCallOverlay';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token || role !== 'customer') {
    return <Navigate to="/login" replace />;
  }
  return children;
};
=======
import VoiceEnrollment from './pages/VoiceEnrollment';
import VoiceVerification from './pages/VoiceVerification';
>>>>>>> 54e2011845a6733081074d04a5f29da037390fd1

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <IncomingCallOverlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
<<<<<<< HEAD
        <Route path="/dashboard" element={<ProtectedRoute><CustomerDashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><CustomerProfile /></ProtectedRoute>} />
        <Route path="/new-shipment" element={<ProtectedRoute><NewShipment /></ProtectedRoute>} />
        <Route path="/edit-shipment/:id" element={<ProtectedRoute><EditShipment /></ProtectedRoute>} />
        <Route path="/order/:id" element={<ProtectedRoute><OrderDetails /></ProtectedRoute>} />
        <Route path="/video-call/:sessionToken" element={<ProtectedRoute><VideoCallPage /></ProtectedRoute>} />
        <Route path="/async-verify/:token" element={<AsyncVerificationPage />} />
=======
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/profile" element={<CustomerProfile />} />
        <Route path="/new-shipment" element={<NewShipment />} />
        <Route path="/edit-shipment/:id" element={<EditShipment />} />
        <Route path="/voice-enrollment" element={<VoiceEnrollment />} />
        <Route path="/verify/:verificationId" element={<VoiceVerification />} />
>>>>>>> 54e2011845a6733081074d04a5f29da037390fd1
      </Routes>
    </BrowserRouter>
  );
}
export default App;