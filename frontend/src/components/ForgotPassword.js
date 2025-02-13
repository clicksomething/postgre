import React, { useState } from 'react';
import './ForgotPassword.css'; // Import the CSS file

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically handle the password reset logic, e.g., API call
    if (email) {
      setMessage('A password reset link has been sent to your email address.');
      // Reset the email field
      setEmail('');
    } else {
      setMessage('Please enter a valid email address.');
    }
  };

  return (
    <div className="forgot-password-container">
      <h2 className="form-heading">Forgot Password</h2>
      <p className="form-subheading">Please enter your email address to receive a password reset link.</p>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="email" className="label">Email:</label>
          <div className="input-with-icon">
            <i className="fas fa-envelope icon"></i>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              required
            />
          </div>
        </div>
        <button type="submit" className="button">Send Reset Link</button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default ForgotPassword;