import React from 'react';
import './DeleteObserverModal.scss';
import { FaTimes, FaTrash } from 'react-icons/fa';

const DeleteObserverModal = ({ observer, onClose, onConfirm }) => {
    const handleConfirm = () => {
        onConfirm(observer.observerID);
    };

    return (
        <div className="delete-observer-modal">
            <div className="modal-content">
                <h2>Delete Observer</h2>
                <div className="confirmation-text">
                    <p>Are you sure you want to delete the observer:</p>
                    <p className="observer-name">{observer.name}?</p>
                    <p className="warning">This action cannot be undone.</p>
                </div>
                <div className="buttons">
                    <button type="button" className="secondary" onClick={onClose}>
                        <FaTimes /> Cancel
                    </button>
                    <button type="button" className="danger" onClick={handleConfirm}>
                        <FaTrash /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteObserverModal;