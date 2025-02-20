import React from 'react';
import './DeleteUserModal.scss';

const DeleteUserModal = ({ user, onClose, onConfirm }) => {
    return (
        <div className="delete-user-modal">
            <div className="modal-content">
                <p>Are you sure you want to delete user: <strong>{user.name}</strong>?</p>
                <div className="buttons">
                    <button onClick={onConfirm} className="confirm-button">
                        Yes, Delete
                    </button>
                    <button onClick={onClose} className="cancel-button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteUserModal;
