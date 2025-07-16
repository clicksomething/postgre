import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUsers, FaUserTie, FaCalendarAlt, FaChartLine, FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';
import './Navbars.scss';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      path: '/manage-users',
      label: 'Manage Users',
      icon: FaUsers,
      adminOnly: true
    },
    {
      path: '/manage-observers',
      label: 'Manage Observers',
      icon: FaUserTie,
      adminOnly: false
    },
    {
      path: '/manage-exams',
      label: 'Manage Exams',
      icon: FaCalendarAlt,
      adminOnly: true
    },
    {
      path: '/algorithm-comparison',
      label: 'Algorithm Comparison',
      icon: FaChartLine,
      adminOnly: true
    }
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/dashboard" className="brand-link">
            <div className="brand-logo">
              <div className="logo-icon">📊</div>
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Exam Manager</h1>
              <p className="brand-subtitle">Admin Dashboard</p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-nav desktop-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Icon className="nav-icon" />
                <span className="nav-text">{item.label}</span>
                {isActive(item.path) && <div className="active-indicator" />}
              </Link>
            );
          })}
        </div>

        {/* User Actions */}
        <div className="navbar-actions">
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt className="logout-icon" />
            <span className="logout-text">Logout</span>
          </button>
          
          {/* Mobile Menu Toggle */}
          <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-content">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`mobile-nav-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Icon className="mobile-nav-icon" />
                <span className="mobile-nav-text">{item.label}</span>
              </Link>
            );
          })}
          <button className="mobile-logout-button" onClick={handleLogout}>
            <FaSignOutAlt className="mobile-logout-icon" />
            <span className="mobile-logout-text">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
