import React from 'react';
import { FaTimes, FaTrash } from 'react-icons/fa';

const DeleteScheduleModal = ({ onConfirm, onCancel }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Delete Schedule</h2>
                <div className="confirmation-text">
                    <p>Are you sure you want to delete this schedule?</p>
                    <p className="warning">This action cannot be undone.</p>
                </div>
                <div className="buttons">
                    <button type="button" className="button secondary" onClick={onCancel}>
                        <FaTimes /> Cancel
                    </button>
                    <button type="button" className="button danger" onClick={onConfirm}>
                        <FaTrash /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteScheduleModal; 