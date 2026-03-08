import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login'; // Ensure case matches filename
import Register from './pages/register';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerProfile from './pages/CustomerProfile'; // Import the new file
import NewShipment from './components/NewShipment';
import EditShipment from './components/EditShipment';
import ShipmentDetails from './pages/ShipmentDetails';
import VoiceEnrollment from './pages/VoiceEnrollment';
import VoiceVerification from './pages/VoiceVerification';
import VideoCall from './pages/VideoCall';
import VerificationCapture from './pages/VerificationCapture';
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
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/profile" element={<CustomerProfile />} />
        <Route path="/new-shipment" element={<NewShipment />} />
        <Route path="/shipment/:id" element={<ShipmentDetails />} />
        <Route path="/edit-shipment/:id" element={<EditShipment />} />
        <Route path="/voice-enrollment" element={<VoiceEnrollment />} />
        <Route path="/verify/:verificationId" element={<VoiceVerification />} />
        <Route path="/verification/:token" element={<VerificationCapture />} />
        <Route path="/video-call/:roomId" element={<VideoCall />} />
        <Route path="/voice-assistant" element={<VoiceAssistant />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;