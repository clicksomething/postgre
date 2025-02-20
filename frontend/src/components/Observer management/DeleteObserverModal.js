import React from 'react';
import './DeleteObserverModal.scss';
import { FaTimes } from 'react-icons/fa';

const DeleteObserverModal = ({ observer, onClose, onConfirm }) => {
    const handleConfirm = () => {
        onConfirm(observer.observerID);
    };

    return (
        <div className="modal-overlay">
            <div className="delete-observer-modal">
                <div className="modal-header">
                    <h2>Delete Observer</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>
                <div className="modal-content">
                    <div className="confirmation-text">
                        <p>Are you sure you want to delete the observer:</p>
                        <p className="observer-name">{observer.name}?</p>
                        <p className="warning">This action cannot be undone.</p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="cancel-button" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="delete-button" onClick={handleConfirm}>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteObserverModal;