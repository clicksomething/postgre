import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate()
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Success:', data);
        const role = data.isAdmin ? 'admin' : 'user';
        onLoginSuccess(role);

        // Save the token and role to localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userRole', role);

        if (role === 'admin') {
          navigate('/dashboard');
          console.log('Successfully navigated to Dashboard');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message);
      }
    } catch (error) {
      setError('An error occurred during login');
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2 className="form-signin-heading">Welcome Back</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="input-group">
          <label className="label" htmlFor="email">Email Address</label>
          <div className="input-with-icon">
            <i className="fas fa-envelope icon"></i>
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
        </div>
        <div className="input-group">
          <label className="label" htmlFor="password">Password</label>
          <div className="input-with-icon">
            <i className="fas fa-lock icon"></i>
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
        <button className="button" type="submit">Sign In</button>
        <a href="/forgot-password" className="forgot-password">Forgot your password?</a>
      </form>
    </div>
  );
};

export default Login;