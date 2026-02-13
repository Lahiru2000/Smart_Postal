import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/login';
import Register from './pages/register';
import CourierDashboard from './pages/CourierDashboard';
import CourierProfile from './pages/CourierProfile';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<CourierDashboard />} />
        <Route path="/profile" element={<CourierProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;