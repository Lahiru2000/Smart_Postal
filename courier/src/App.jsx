import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login';
import Register from './pages/register';
import CourierDashboard from './pages/CourierDashboard';
import CourierProfile from './pages/CourierProfile';
import VideoCallPage from './pages/VideoCallPage';
import OrderDetails from './pages/OrderDetails';
import VerificationDashboard from './pages/VerificationDashboard';
import AsyncReviewPage from './pages/AsyncReviewPage';
import IncomingCallOverlay from './components/IncomingCallOverlay';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (!token || role !== 'courier') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <IncomingCallOverlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><CourierDashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><CourierProfile /></ProtectedRoute>} />
        <Route path="/order/:id" element={<ProtectedRoute><OrderDetails /></ProtectedRoute>} />
        <Route path="/video-call/:sessionToken" element={<ProtectedRoute><VideoCallPage /></ProtectedRoute>} />
        <Route path="/verify/:sessionToken" element={<ProtectedRoute><VerificationDashboard /></ProtectedRoute>} />
        <Route path="/async-review/:token" element={<ProtectedRoute><AsyncReviewPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;