import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SuccessMessage from './SuccessMessage'; // Import the SuccessMessage component
import './CreateUser.css'; // Import the CSS file for styling

const CreateUser = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNum: '', // Add phoneNum field
    password: '',
    role: 'normal_user', // Default to 'normal_user'
  });
  const [successMessages, setSuccessMessages] = useState([]); // State for success messages
  const [loading, setLoading] = useState(false); // State for loading
  const [errors, setErrors] = useState({}); // State for validation errors

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    // Clear errors when the user types
    setErrors((prevErrors) => ({ ...prevErrors, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.phoneNum) newErrors.phoneNum = 'Phone number is required';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; // Return true if no errors
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!validateForm()) return; // Stop if validation fails

    setLoading(true); // Show loading state

    try {
      const response = await fetch('http://localhost:3000/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating user:', errorData.message);
        setErrors({ submit: errorData.message }); // Show submission error
        return;
      }

      console.log('User created successfully');
      setSuccessMessages((prevMessages) => [
        ...prevMessages,
        'User created successfully!', // Add success message
      ]);

      // Reset the form
      setFormData({
        name: '',
        email: '',
        phoneNum: '',
        password: '',
        role: 'normal_user', // Reset to default role
      });

      // Set a timeout to remove the message after 3 seconds
      setTimeout(() => {
        setSuccessMessages((prevMessages) => prevMessages.slice(1)); // Remove the first message
      }, 3000);
    } catch (error) {
      console.error('Network error:', error);
      setErrors({ submit: 'Network error. Please try again.' }); // Show network error
    } finally {
      setLoading(false); // Hide loading state
    }
  };

  return (
    <div className="create-user-container">
      {/* Back Button */}
      <button className="back-button" onClick={() => navigate('/')}>
        <i className="fas fa-arrow-left"></i> Back to Dashboard
      </button>

      <h2>Create New User</h2>
      <form className="create-user-form" onSubmit={handleCreateUser}>
        <label>
          Name:
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className={errors.name ? 'input-error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </label>
        <label>
          Email:
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className={errors.email ? 'input-error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </label>
        <label>
          Phone Number:
          <input
            type="text"
            name="phoneNum"
            value={formData.phoneNum}
            onChange={handleInputChange}
            required
            className={errors.phoneNum ? 'input-error' : ''}
          />
          {errors.phoneNum && <span className="error-message">{errors.phoneNum}</span>}
        </label>
        <label>
          Password:
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
            className={errors.password ? 'input-error' : ''}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </label>
        <label>
          Role:
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            required
          >
            <option value="normal_user">Normal User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {errors.submit && <span className="error-message">{errors.submit}</span>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>

      {/* Success Messages */}
      <SuccessMessage messages={successMessages} onClose={(index) => {
        setSuccessMessages((prevMessages) => prevMessages.filter((_, i) => i !== index));
      }} />
    </div>
  );
};

export default CreateUser;