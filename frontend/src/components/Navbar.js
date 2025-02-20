import React from 'react';
import { Link } from 'react-router-dom';
import './Navbars.scss'; // Import the SCSS file for styling

const Navbar = ({ onLogout }) => {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <h1 className="navbar-title">Admin Dashboard</h1>
        <ul className="nav-links">
          <li>
            <Link to="/manage-users" className="nav-link">
              <i className="fas fa-users-cog"></i> Manage Users
            </Link>
          </li>
          <li>
            <Link to="/manage-observers" className="nav-link">
              <i className="fas fa-user-tie"></i> Manage Observers
            </Link>
          </li>
          <li>
            <Link to="/manage-exams" className="nav-link">
              <i className="fas fa-calendar-alt"></i> Manage Exams
            </Link>
          </li>
          <li>
            <button className="nav-link logout-button" onClick={onLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
