import React, { useState } from 'react';
import './CreateUserModal.scss';
import { FaSave, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';
import axios from 'axios';

const CreateUserModal = ({ onClose, onCreate }) => {
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        phonenum: '',
        role: 'normal_user',
        password: ''
    });

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const validateForm = () => {
        const newErrors = {};
        
        // Email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        
        // Phone validation (Syrian format)
        if (!/^09\d{8}$/.test(newUser.phonenum.replace(/\s/g, ''))) {
            newErrors.phonenum = 'Please enter a valid Syrian mobile number (09XXXXXXXX)';
        }
        
        // Password strength
        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(newUser.password)) {
            newErrors.password = 'Password must be at least 8 characters and include letters and numbers';
        }

        // Name validation
        if (!newUser.name.trim()) {
            newErrors.name = 'Name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const calculateProgress = () => {
        const fields = Object.values(newUser);
        const filledFields = fields.filter(field => field.length > 0).length;
        return (filledFields / fields.length) * 100;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let processedValue = value;
        
        if (name === 'name') {
            processedValue = value
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }
        
        setNewUser(prev => ({
            ...prev,
            [name]: processedValue
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            const response = await axios.post('http://localhost:3000/api/users/create', newUser, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`, // Add the Authorization header
                },
            });

            if (response.status !== 201) {
                throw new Error(response.data.message || 'Failed to create user');
            }

            await onCreate(newUser);
            onClose();
        } catch (error) {
            // Check if the error is due to a duplicate email
            if (error.response && error.response.data && error.response.data.message) {
                setErrors({ submit: error.response.data.message });
            } else {
                setErrors({ submit: error.message || 'Error creating user' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="create-user-modal">
            <div className="modal-content">
                <button className="close-button" onClick={onClose}>
                    <FaTimes />
                </button>
                <h2>Create New User</h2>

                <div className="form-progress">
                    <div 
                        className="progress-bar" 
                        style={{ width: `${calculateProgress()}%` }}
                    />
                </div>

                {errors.submit && <div className="submit-error">{errors.submit}</div>}

                <form onSubmit={handleSubmit}>
                    <div className={`form-group ${errors.name ? 'error' : ''}`}>
                        <label>Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={newUser.name}
                            onChange={handleInputChange}
                            required
                        />
                        {errors.name && <span className="error-text">{errors.name}</span>}
                    </div>

                    <div className={`form-group ${errors.email ? 'error' : ''}`}>
                        <label>Email:</label>
                        <input
                            type="email"
                            name="email"
                            value={newUser.email}
                            onChange={handleInputChange}
                            required
                        />
                        {errors.email && <span className="error-text">{errors.email}</span>}
                    </div>

                    <div className={`form-group ${errors.phonenum ? 'error' : ''}`}>
                        <label>Phone Number:</label>
                        <input
                            type="text"
                            name="phonenum"
                            value={newUser.phonenum}
                            onChange={handleInputChange}
                            required
                            placeholder="09XXXXXXXX"
                        />
                        {errors.phonenum && <span className="error-text">{errors.phonenum}</span>}
                    </div>

                    <div className="form-group">
                        <label>Role:</label>
                        <select
                            name="role"
                            value={newUser.role}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="normal_user">Normal User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div className={`form-group password-group ${errors.password ? 'error' : ''}`}>
                        <label>Password:</label>
                        <div className="password-input">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={newUser.password}
                                onChange={handleInputChange}
                                required
                            />
                            <button 
                                type="button" 
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                        {errors.password && <span className="error-text">{errors.password}</span>}
                    </div>

                    <div className="buttons">
                        <button type="button" className="secondary" onClick={onClose}>
                            <FaTimes /> Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="primary"
                            disabled={isSubmitting}
                        >
                            <FaSave /> {isSubmitting ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
