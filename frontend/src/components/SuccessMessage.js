import React, { useState, useEffect, useCallback } from 'react';
import './SuccessMessage.scss';
import { FaTimes } from 'react-icons/fa'; // Import the X icon

const SuccessMessage = ({ messages, onClose }) => {
  const [messageStates, setMessageStates] = useState([]);

  // Reset message states when messages change
  useEffect(() => {
    setMessageStates(messages.map(() => 'entering'));
  }, [messages]);

  const handleAnimationEnd = useCallback((index) => {
    setMessageStates(prevStates => {
      const newStates = [...prevStates];
      if (newStates[index] === 'exiting') {
        onClose(index);
      }
      return newStates;
    });
  }, [onClose]);

  const handleClose = (index) => {
    setMessageStates(prevStates => {
      const newStates = [...prevStates];
      newStates[index] = 'exiting';
      return newStates;
    });
  };

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        setMessageStates(prevStates => prevStates.map(() => 'exiting'));
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="success-messages">
      {messages.map((msg, index) => (
        <div
          key={`${msg}-${index}`}
          className={`success-message ${messageStates[index] || ''}`}
          onAnimationEnd={() => handleAnimationEnd(index)}
        >
          <div className="message-content">
            <span className="check-icon">✓</span>
            <span className="message-text">{msg}</span>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={() => handleClose(index)}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>
      ))}
    </div>
  );
};

export default SuccessMessage;
