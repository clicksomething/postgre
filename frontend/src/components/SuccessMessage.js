import React, { useState, useEffect, useCallback } from 'react';
import './SuccessMessage.scss';

const SuccessMessage = ({ messages, onClose }) => {
  const [messageStates, setMessageStates] = useState(messages.map(() => 'initial'));

  const handleAnimationEnd = useCallback((index) => {
    setMessageStates((prevStates) => {
      const newStates = [...prevStates];
      if (newStates[index] === 'exiting') {
        newStates[index] = 'exited';
      }
      return newStates;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessageStates((prevStates) =>
        prevStates.map((state, index) => (state === 'entering' ? 'exiting' : state))
      );
    }, 3000); // Keep messages visible for 3 seconds

    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className="success-messages">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`success-message ${messageStates[index]}`}
          onAnimationEnd={() => handleAnimationEnd(index)}
        >
          <i className="fas fa-check-circle"></i>
          {msg}
          <button
            type="button"
            className="close-button"
            onClick={() => onClose(index)}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      ))}
    </div>
  );
};

export default SuccessMessage;
