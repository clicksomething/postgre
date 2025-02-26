import React, { useState } from 'react';
import './CreateObserverModal.scss'; // Import the SCSS file for styling
import { FaSave, FaTimes, FaEye, FaEyeSlash } from 'react-icons/fa';

const CreateObserverModal = ({ onClose, onCreate }) => {
  const [newObserver, setNewObserver] = useState({
    name: '',
    email: '',
    phonenum: '',
    password: '',
    title: '',
    scientificRank: '',
    fatherName: '',
    availability: 'part-time'  // Changed to match the database enum
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Predefined options for Title and Scientific Rank
  const titleOptions = [
    "Dr.",
    "Prof.",
    "Assoc. Prof.",
    "Assist. Prof.",
    "Mr.",
    "Mrs.",
    "Ms."
  ];

  const scientificRankOptions = [
    "Professor",
    "Associate Professor",
    "Assistant Professor",
    "Lecturer",
    "Teaching Assistant",
    "Research Assistant"
  ];

  const validateForm = () => {
    const newErrors = {};
    
    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newObserver.email)) {
        newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone validation (Syrian mobile format only)
    if (!/^09\d{8}$/.test(newObserver.phonenum.replace(/\s/g, ''))) {
        newErrors.phonenum = 'Please enter a valid Syrian mobile number (09XXXXXXXX)';
    }
    
    // Password strength
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(newObserver.password)) {
        newErrors.password = 'Password must be at least 8 characters and include letters and numbers';
    }

    // Required fields
    ['name', 'title', 'scientificRank', 'fatherName'].forEach(field => {
        if (!newObserver[field].trim()) {
            newErrors[field] = 'This field is required';
        }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateProgress = () => {
    const fields = Object.values(newObserver);
    const filledFields = fields.filter(field => field.length > 0).length;
    return (filledFields / fields.length) * 100;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;
    
    if (['name', 'fatherName'].includes(name)) {
        processedValue = value
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    
    setNewObserver(prev => ({
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
        await onCreate(newObserver);
        onClose();
    } catch (error) {
        setErrors({ submit: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="create-observer-modal">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Create New Observer</h2>

        <div className="form-progress">
          <div 
            className="progress-bar" 
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>

        {errors.submit && (
          <div className="error-message submit-error">
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={`form-group ${errors.name ? 'error' : ''}`}>
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={newObserver.name}
              onChange={handleInputChange}
              required
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>
          <div className={`form-group ${errors.fatherName ? 'error' : ''}`}>
            <label>Father's Name:</label>
            <input
              type="text"
              name="fatherName"
              value={newObserver.fatherName}
              onChange={handleInputChange}
              required
            />
            {errors.fatherName && <span className="error-text">{errors.fatherName}</span>}
          </div>
          <div className={`form-group ${errors.email ? 'error' : ''}`}>
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={newObserver.email}
              onChange={handleInputChange}
              required
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>
          <div className={`form-group password-group ${errors.password ? 'error' : ''}`}>
            <label>Password:</label>
            <div className="password-input">
                <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={newObserver.password}
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
          <div className={`form-group ${errors.phonenum ? 'error' : ''}`}>
            <label>Phone Number:</label>
            <input
              type="text"
              name="phonenum"
              value={newObserver.phonenum}
              onChange={handleInputChange}
              required
              placeholder="09XXXXXXXX"
            />
            {errors.phonenum && <span className="error-text">{errors.phonenum}</span>}
          </div>
          <div className={`form-group ${errors.title ? 'error' : ''}`}>
            <label>Title:</label>
            <select
              name="title"
              value={newObserver.title}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Title</option>
              {titleOptions.map((title, index) => (
                <option key={index} value={title}>
                  {title}
                </option>
              ))}
            </select>
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>
          <div className={`form-group ${errors.scientificRank ? 'error' : ''}`}>
            <label>Scientific Rank:</label>
            <select
              name="scientificRank"
              value={newObserver.scientificRank}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Scientific Rank</option>
              {scientificRankOptions.map((rank, index) => (
                <option key={index} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
            {errors.scientificRank && <span className="error-text">{errors.scientificRank}</span>}
          </div>
          <div className="form-group">
            <label>Availability:</label>
            <select
              name="availability"
              value={newObserver.availability}
              onChange={handleInputChange}
              required
            >
              <option value="part-time">Part Time</option>
              <option value="full-time">Full Time</option>
            </select>
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
              <FaSave /> {isSubmitting ? 'Creating...' : 'Create Observer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateObserverModal;
