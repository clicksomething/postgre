// EditObserverModal.js
import React from 'react';
import './EditObserverModal.scss'; // Import the SCSS file for styling

const EditObserverModal = ({ observer, onClose, onSave }) => {
    // Handle form submission and call onSave
    const handleSubmit = (e) => {
        e.preventDefault();
        // Prepare updated observer data
        const updatedObserver = {
            observerID: observer.observerID,
            userID: observer.userID, // Add this to maintain the link with AppUser
            title: e.target.title.value,
            name: e.target.name.value,
            email: e.target.email.value,
            phoneNum: e.target.phoneNum.value,
            scientificRank: e.target.scientificRank.value,
            fatherName: e.target.fatherName.value,
            availability: e.target.availability.value,
        };

        // Call the onSave function with updated data
        onSave(updatedObserver);

        // Close the modal after saving
        onClose();
    };

    return (
        <div className="edit-observer-modal">
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>
                    &times;
                </span>
                <h2>Edit Observer</h2>
                <form onSubmit={handleSubmit}>
                     {/* Title */}
                    <div className="form-group">
                        <label htmlFor="title">Title:</label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            defaultValue={observer.title}
                            required
                        />
                    </div>
                    {/* Name */}
                    <div className="form-group">
                        <label htmlFor="name">Name:</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            defaultValue={observer.name}
                            required
                        />
                    </div>

                    {/* Scientific Rank */}
                    <div className="form-group">
                        <label htmlFor="scientificRank">Scientific Rank:</label>
                        <input
                            type="text"
                            id="scientificRank"
                            name="scientificRank"
                            defaultValue={observer.scientificRank}
                        />
                    </div>

                    {/* Father Name */}
                    <div className="form-group">
                        <label htmlFor="fatherName">Father Name:</label>
                        <input
                            type="text"
                            id="fatherName"
                            name="fatherName"
                            defaultValue={observer.fatherName}
                        />
                    </div>

                    {/* Email */}
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            defaultValue={observer.email}
                            required
                        />
                    </div>

                    {/* Phone Number */}
                    <div className="form-group">
                        <label htmlFor="phoneNum">Phone Number:</label>
                        <input
                            type="text"
                            id="phoneNum"
                            name="phoneNum"
                            defaultValue={observer.phoneNum}
                        />
                    </div>

                    {/* Availability */}
                    <div className="form-group">
                        <label htmlFor="availability">Availability:</label>
                        <select
                            id="availability"
                            name="availability"
                            defaultValue={observer.availability}
                        >
                            <option value="full-time">Full time</option>
                            <option value="part-time">Part time</option>
                        </select>
                    </div>

                    <div className="buttons">
                        {/* Cancel Button */}
                        <button type="button" className="cancel-button" onClick={onClose}>
                            Cancel
                        </button>

                        {/* Submit Button */}
                        <button type="submit" className="save-button">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditObserverModal;
