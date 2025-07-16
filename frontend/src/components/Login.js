import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { FaEye, FaEyeSlash, FaSpinner, FaUser, FaLock } from 'react-icons/fa';
import './Login.scss';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login, isAuthenticated, loading: authLoading } = useAuth();
    const { post } = useApi();

    // Redirect if already authenticated
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, authLoading, navigate]);

    // Show loading while checking authentication
    if (authLoading) {
        return (
            <div className="login-container">
                <div className="loading-spinner">
                    <FaSpinner className="spinner" />
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render login form if already authenticated
    if (isAuthenticated) {
        return null;
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError(''); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Make API call to authenticate
            const response = await post('/auth/login', {
                email: formData.email,
                password: formData.password
            });

            // Map roleId to role string for the context
            let role = 'normal_user';
            if (response.roleId === 2) {
                role = 'admin';
            } else if (response.roleId === 3) {
                role = 'observer';
            }

            // Call context login with the mapped role and token
            login(role, response.token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-background">
                {/* Floating Particles */}
                <div className="particles">
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                    <div className="particle"></div>
                </div>
                
                {/* Geometric Shapes */}
                <div className="geometric-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                    <div className="shape shape-3"></div>
                    <div className="shape shape-4"></div>
                    <div className="shape shape-5"></div>
                    <div className="shape shape-6"></div>
                </div>
                
                {/* Glowing Orbs */}
                <div className="glow-orbs">
                    <div className="glow-orb glow-orb-1"></div>
                    <div className="glow-orb glow-orb-2"></div>
                    <div className="glow-orb glow-orb-3"></div>
                </div>
            </div>
            
            <div className="login-content">
                <div className="login-card">
                    <div className="login-header">
                        <div className="logo-container">
                            <div className="logo-icon">📊</div>
                        </div>
                        <h1 className="login-title">Welcome Back</h1>
                        <p className="login-subtitle">Sign in to your Exam Manager account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="error-message">
                                <div className="error-icon">⚠️</div>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                <FaUser className="label-icon" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="Enter your email"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                <FaLock className="label-icon" />
                                Password
                            </label>
                            <div className="password-input-container">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Enter your password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={loading}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <div className="form-actions">
                            <Link to="/forgot-password" className="forgot-password">
                                Forgot your password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <FaSpinner className="spinner" />
                                    Signing In...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p className="footer-text">
                            Don't have an account?{' '}
                            <span className="contact-admin">
                                Contact your administrator
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;