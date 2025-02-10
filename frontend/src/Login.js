import React, { useState } from 'react';
import './Login.css'; // Import the CSS file

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Handle login logic here
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', { // Use the correct backend URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }), // Use email instead of username
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Success:', data);
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData);
      }
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="form-signin-heading">Please login</h2>
        <div className="input-group">
          <label className="label" htmlFor="email">Email Address</label>
          <input
            type="text"
            className="input"
            id="email"
            name="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label className="label" htmlFor="password">Password</label>
          <input
            type="password"
            className="input"
            id="password"
            name="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label className="checkbox">
            <input
              type="checkbox"
              value="remember-me"
              id="rememberMe"
              name="rememberMe"
            /> 
            Remember me
          </label>
        </div>
        <button className="button" type="submit">Login</button>
        <a href="/forgot-password" className="forgot-password">Forgot password?</a> {/* Update link to correct route */}
      </form>
    </div>
  );
};

export default Login;
