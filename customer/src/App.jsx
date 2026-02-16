import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login'; // Ensure case matches filename
import Register from './pages/register';
import CustomerDashboard from './pages/CustomerDashboard';
import CustomerProfile from './pages/CustomerProfile'; // Import the new file
import NewShipment from './components/NewShipment';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/profile" element={<CustomerProfile />} />
        <Route path="/new-shipment" element={<NewShipment />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;