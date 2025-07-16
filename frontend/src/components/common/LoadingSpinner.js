import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import './LoadingSpinner.scss';

const LoadingSpinner = ({ 
    message = "Loading...", 
    size = "medium",
    className = "" 
}) => {
    return (
        <div className={`loading-spinner ${size} ${className}`}>
            <FaSpinner className="spinner-icon" />
            <span className="loading-message">{message}</span>
        </div>
    );
};

export default LoadingSpinner; 