// EditObserverModal.js
import React, { useState } from 'react';
import './EditObserverModal.scss'; // Import the SCSS file for styling
import { FaSave, FaTimes } from 'react-icons/fa';

const EditObserverModal = ({ observer, onClose, onSave }) => {
    const [editingObserver, setEditingObserver] = useState(observer);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Predefined options for Title and Scientific Rank
    const titleOptions = [
        "Dr.",
        "Prof.",
        "Assoc. Prof.",
        "Assist. Prof.",
        "Mr.",
        "Mrs.",
        "Ms."
    ];

    const scientificRankOptions = [
        "Professor",
        "Associate Professor",
        "Assistant Professor",
        "Lecturer",
        "Teaching Assistant",
        "Research Assistant"
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let processedValue = value;
        
        if (['name', 'fatherName'].includes(name)) {
            processedValue = value
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }
        
        setEditingObserver(prev => ({
            ...prev,
            [name]: processedValue
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            await onSave(editingObserver);
            onClose();
        } catch (error) {
            setErrors({ submit: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="edit-observer-modal">
            <div className="modal-content">
                <h2>Edit Observer</h2>

                {errors.submit && (
                    <div className="error-message submit-error">
                        {errors.submit}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={editingObserver.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Father's Name:</label>
                        <input
                            type="text"
                            name="fatherName"
                            value={editingObserver.fatherName}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email:</label>
                        <input
                            type="email"
                            name="email"
                            value={editingObserver.email}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Phone Number:</label>
                        <input
                            type="text"
                            name="phoneNum"
                            value={editingObserver.phoneNum}
                            onChange={handleInputChange}
                            placeholder="09XXXXXXXX"
                        />
                    </div>

                    <div className="form-group">
                        <label>Title:</label>
                        <select
                            name="title"
                            value={editingObserver.title}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select Title</option>
                            {titleOptions.map((title, index) => (
                                <option key={index} value={title}>
                                    {title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Scientific Rank:</label>
                        <select
                            name="scientificRank"
                            value={editingObserver.scientificRank}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select Scientific Rank</option>
                            {scientificRankOptions.map((rank, index) => (
                                <option key={index} value={rank}>
                                    {rank}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Availability:</label>
                        <select
                            name="availability"
                            value={editingObserver.availability}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="part-time">Part Time</option>
                            <option value="full-time">Full Time</option>
                        </select>
                    </div>

                    <div className="buttons">
                        <button type="button" className="button secondary" onClick={onClose}>
                            <FaTimes /> Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="button primary"
                            disabled={isSubmitting}
                        >
                            <FaSave /> {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditObserverModal;
