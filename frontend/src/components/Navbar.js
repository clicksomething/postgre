import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css'; // Import the CSS file for styling

const Navbar = ({ onLogout }) => {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <h1 className="navbar-title">Admin Dashboard</h1>
        <ul className="nav-links">
          <li>
            <Link to="/edit-users" className="nav-link">
              <i className="fas fa-user-edit"></i> Edit Users
            </Link>
          </li>
          <li>
            <Link to="/view-observers" className="nav-link">
              <i className="fas fa-eye"></i> View Observers
            </Link>
          </li>
          <li>
            <Link to="/create-user" className="nav-link">
              <i className="fas fa-user-plus"></i> Create User
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