import React from 'react';
import './DeleteUserModal.scss';
import { FaTimes, FaTrash } from 'react-icons/fa';

const DeleteUserModal = ({ user, onClose, onConfirm }) => {
    const handleConfirm = () => {
        onConfirm(user.id);
    };

    return (
        <div className="delete-user-modal">
            <div className="modal-content">
                <button className="close-button" onClick={onClose}>
                    <FaTimes />
                </button>
                <h2>Delete User</h2>
                <div className="confirmation-text">
                    <p>Are you sure you want to delete the user:</p>
                    <p className="user-name">{user.name}?</p>
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

export default DeleteUserModal;
