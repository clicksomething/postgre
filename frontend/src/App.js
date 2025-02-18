import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import ForgotPassword from './components/ForgotPassword';
import Login from './components/Login';
import ManageObservers from './components/Observer management/ManageObservers';
import Dashboard from './components/Dashboard';
import ManageUsers from './components/User Management/ManageUsers';
import Navbar from './components/Navbar'; // Import the Navbar component

const App = () => {
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedRole = localStorage.getItem('userRole');

    const validateToken = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/auth/validateToken', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setRole(savedRole);
        } else {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          setRole(null);
        }
      } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (token && savedRole) {
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleLogin = (userRole) => {
    setRole(userRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    setRole(null);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div>
        {/* Conditionally render the Navbar only if the user is logged in */}
        {role && <Navbar onLogout={handleLogout} />} {/* Include the Navbar here */}
        <Routes>
          <Route path="/" element={<Login onLoginSuccess={handleLogin} />} />
          <Route path="/login" element={<Login onLoginSuccess={handleLogin} />} /> {/* Explicit login route */}
          <Route path="/dashboard" element={role === 'admin' ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/manage-users" element={role === 'admin' ? <ManageUsers /> : <Navigate to="/login" />} />          
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/manage-observers" element={<ManageObservers />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
