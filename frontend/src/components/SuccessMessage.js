import React from 'react';
import './SuccessMessage.css'; // Import the CSS file for styling

const SuccessMessage = ({ messages, onClose }) => {
  if (!messages.length) return null; // Don't render if there are no messages

  return (
    <div className="success-messages">
      {messages.map((msg, index) => (
        <div key={index} className="success-message">
          <i className="fas fa-check-circle"></i> {msg}
          <button className="close-button" onClick={() => onClose(index)}>×</button>
        </div>
      ))}
    </div>
  );
};

export default SuccessMessage;