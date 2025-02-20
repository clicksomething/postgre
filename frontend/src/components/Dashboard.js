import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar'; // Import the Navbar component
import './Dashboard.scss';

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/login'); // Redirect to login if no token
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Remove token on logout
    navigate('/login'); // Redirect to login
  };

  return (
    <div className="dashboard-container">
      <Navbar onLogout={handleLogout} /> {/* Use the Navbar component */}
      <div className="dashboard-content">
        <div className="welcome-message">
          <h2>Welcome to the Admin Dashboard</h2>
          <p>Manage your exam schedules and observers efficiently</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;