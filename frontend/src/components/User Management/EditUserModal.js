import React, { useEffect, useState } from 'react';
import './EditUserModal.scss';
import { FaSave, FaTimes } from 'react-icons/fa';

const EditUserModal = ({ user, onClose, onSave, isSaving }) => {
    const [editingUser, setEditingUser] = useState(user);

    useEffect(() => {
        setEditingUser(user);
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
                <button className="button secondary close-button" onClick={onClose}>
                    <FaTimes />
                </button>
                <h2>Edit User</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={editingUser.name}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Email:</label>
                        <input
                            type="email"
                            name="email"
                            value={editingUser.email}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Phone Number:</label>
                        <input
                            type="text"
                            name="phonenum"
                            value={editingUser.phonenum}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="form-group">
                        <label>Role:</label>
                        <select
                            name="role"
                            value={editingUser.role}
                            onChange={handleInputChange}
                        >
                            <option value="normal_user">Normal User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Password:</label>
                        <input
                            type="password"
                            name="password"
                            onChange={handleInputChange}
                            placeholder="Leave blank to keep current password"
                        />
                    </div>
                    <div className="buttons">
                        <button type="submit" className="button primary" disabled={isSaving}>
                            <FaSave /> {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" className="button secondary" onClick={onClose}>
                            <FaTimes /> Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;
