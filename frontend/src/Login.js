import React, { useState } from 'react';
import './Login.css'; // Import the CSS file

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would typically handle the login logic, e.g., API call
    if (username === '' || password === '') {
      setError('Please fill in both fields.');
    } else {
      setError('');
      // Simulate a successful login
      console.log('Logging in with:', { username, password });
      // Redirect or perform other actions after successful login
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="input-group">
          <label htmlFor="username" className="label">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password" className="label">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button">Login</button>
        <a href="/forgot-password" className="forgot-password">Forgot Password?</a>
      </form>
    </div>
  );
};

export default Login;