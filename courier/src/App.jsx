import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login';
import Register from './pages/register';
import CourierDashboard from './pages/CourierDashboard';
import CourierProfile from './pages/CourierProfile';
import ShipmentDetails from './pages/ShipmentDetails';
import RouteOptimizer from './pages/RouteOptimizer';
import VideoCall from './pages/VideoCall';
import VoiceAssistant from './pages/VoiceAssistant';
import IncomingCallOverlay from './components/IncomingCallOverlay';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <IncomingCallOverlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<CourierDashboard />} />
        <Route path="/shipment/:id" element={<ShipmentDetails />} />
        <Route path="/route-optimizer" element={<RouteOptimizer />} />
        <Route path="/video-call/:roomId" element={<VideoCall />} />
        <Route path="/profile" element={<CourierProfile />} />
        <Route path="/voice-assistant" element={<VoiceAssistant />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;