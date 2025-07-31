import React, { useState, useEffect } from 'react';
import { FaUsers, FaUserCheck, FaCalendarAlt, FaClipboardList, FaSpinner } from 'react-icons/fa';
import axios from 'axios';
import './Dashboard.scss';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalObservers: 0,
    totalSchedules: 0,
    totalAssignments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      fetchDashboardStats();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('Not authorized');
      }

      // Fetch users count
      const usersResponse = await axios.get('http://localhost:3000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch observers count
      const observersResponse = await axios.get('http://localhost:3000/api/users/observers', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch schedules count
      const schedulesResponse = await axios.get('http://localhost:3000/api/exams/schedules/all', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch assignments count (schedule assignments)
      const assignmentsResponse = await axios.get('http://localhost:3000/api/exams/schedule-assignments', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStats({
        totalUsers: usersResponse.data.length || 0,
        totalObservers: observersResponse.data.length || 0,
        totalSchedules: schedulesResponse.data.schedules?.length || schedulesResponse.data.length || 0,
        totalAssignments: assignmentsResponse.data.length || 0
      });

      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, description }) => (
    <div className="stat-card">
      <div className="stat-icon" style={{ backgroundColor: color }}>
        <Icon />
      </div>
      <div className="stat-content">
        <h3 className="stat-value">{value}</h3>
        <p className="stat-title">{title}</p>
        <p className="stat-description">{description}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="loading-container">
            <FaSpinner className="loading-spinner" />
            <p>Loading dashboard statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchDashboardStats} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="welcome-message">
          <h2>Welcome to the Admin Dashboard</h2>
          <p>Manage your exam schedules and observers efficiently</p>
        </div>

        <div className="stats-grid">
          <StatCard
            icon={FaUsers}
            title="Total Users"
            value={stats.totalUsers}
            color="var(--primary-500)"
            description="Registered system users"
          />
          <StatCard
            icon={FaUserCheck}
            title="Total Observers"
            value={stats.totalObservers}
            color="var(--success-500)"
            description="Available exam observers"
          />
          <StatCard
            icon={FaCalendarAlt}
            title="Exam Schedules"
            value={stats.totalSchedules}
            color="var(--warning-500)"
            description="Uploaded exam schedules"
          />
          <StatCard
            icon={FaClipboardList}
            title="Assignments"
            value={stats.totalAssignments}
            color="var(--info-500)"
            description="Observer assignments"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;