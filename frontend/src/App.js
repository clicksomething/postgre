import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import ForgotPassword from './components/ForgotPassword';
import Login from './components/Login';
import ManageObservers from './components/Observer management/ManageObservers';
import ManageExams from './components/Exam management/ManageExams';
import Dashboard from './components/Dashboard';
import ManageUsers from './components/User Management/ManageUsers';
import Navbar from './components/Navbar';
import ScheduleDetails from './components/Exam management/ScheduleDetails';
import AlgorithmComparison from './components/AlgorithmComparison';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/common';

// Separate component to use AuthContext (since we can't use hooks outside of Router)
const AppContent = () => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {/* Conditionally render the Navbar only if the user is logged in */}
      {isAuthenticated && <Navbar />}
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/manage-users" element={isAuthenticated && isAdmin ? <ManageUsers /> : <Navigate to="/login" />} />          
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/manage-observers" element={isAuthenticated ? <ManageObservers /> : <Navigate to="/login" />} />
        <Route path="/manage-exams" element={isAuthenticated && isAdmin ? <ManageExams /> : <Navigate to="/login" />} />
        <Route path="/schedules/:id" element={isAuthenticated ? <ScheduleDetails /> : <Navigate to="/login" />} />
        <Route path="/algorithm-comparison" element={isAuthenticated && isAdmin ? <AlgorithmComparison /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
