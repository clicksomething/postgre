import React, { useState } from 'react';
import './CreateUserModal.scss';

const CreateUserModal = ({ onClose, onCreate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phonenum: '',
        password: '',
        role: 'normal_user',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
        setErrors((prevErrors) => ({ ...prevErrors, [name]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name) newErrors.name = 'Name is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.phonenum) newErrors.phonenum = 'Phone number is required';
        if (!formData.password) newErrors.password = 'Password is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);

        try {
            const response = await fetch('http://localhost:3000/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error creating user:', errorData.message);
                setErrors({ submit: errorData.message });
                return;
            }

            console.log('User created successfully');
            onCreate(formData); // Call onCreate to update the user list in ManageUsers
            onClose(); // Close the modal after successful creation
        } catch (error) {
            console.error('Network error:', error);
            setErrors({ submit: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-user-modal">
            <div className="modal-content">
                <h2>Create New User</h2>
                <form className="create-user-form" onSubmit={handleCreateUser}>
                    <label>
                        Name:
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            className={errors.name ? 'input-error' : ''}
                        />
                        {errors.name && <span className="error-message">{errors.name}</span>}
                    </label>
                    <label>
                        Email:
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className={errors.email ? 'input-error' : ''}
                        />
                        {errors.email && <span className="error-message">{errors.email}</span>}
                    </label>
                    <label>
                        Phone Number:
                        <input
                            type="text"
                            name="phonenum"
                            value={formData.phonenum}
                            onChange={handleInputChange}
                            required
                            className={errors.phonenum ? 'input-error' : ''}
                        />
                        {errors.phonenum && <span className="error-message">{errors.phonenum}</span>}
                    </label>
                    <label>
                        Password:
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            className={errors.password ? 'input-error' : ''}
                        />
                        {errors.password && <span className="error-message">{errors.password}</span>}
                    </label>
                    <label>
                        Role:
                        <select
                            name="role"
                            value={formData.role}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="normal_user">Normal User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>
                    {errors.submit && <span className="error-message">{errors.submit}</span>}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create User'}
                    </button>
                    <button type="button" onClick={onClose} className="cancel-button">
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;
