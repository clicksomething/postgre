import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './Login'; // Import your Login component
import ForgotPassword from './ForgotPassword'; // Import your Forgot Password component

const App = () => {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Login />} /> {/* Route for the Login page */}
          <Route path="/forgot-password" element={<ForgotPassword />} /> {/* Route for the Forgot Password page */}
        </Routes>
      </div>
    </Router>
  );
};

export default App;