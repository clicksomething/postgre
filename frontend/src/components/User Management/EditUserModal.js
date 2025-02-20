import React, { useEffect, useState } from 'react';
import './EditUserModal.scss';

const EditUserModal = ({ user, onClose, onSave, isSaving }) => {
    const [editingUser, setEditingUser] = useState(user);

    useEffect(() => {
        setEditingUser(user); // Update local state when user prop changes
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditingUser(prevUser => ({
            ...prevUser,
            [name]: value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(editingUser);
    };

    return (
        <div className="edit-user-modal">
            <div className="modal-content">
                <h3>Edit User</h3>
                <form onSubmit={handleSubmit}>
                    <label>
                        Name:
            <input
                            type="text"
                            name="name"
                            value={editingUser.name}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Email:
            <input
                            type="email"
                            name="email"
                            value={editingUser.email}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Phone Number:
            <input
                            type="text"
                            name="phonenum"
                            value={editingUser.phonenum}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Role:
            <select
                            name="role"
                            value={editingUser.role}
                            onChange={handleInputChange}
                        >
                            <option value="normal_user">Normal User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>
                    <label>
                        Password:
            <input
                            type="password"
                            name="password"
                            onChange={handleInputChange}
                        />
                    </label>
                    <button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={onClose} className="cancel-button">
                        <i className="fas fa-times"></i> Cancel
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;
