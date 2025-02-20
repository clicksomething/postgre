import React from 'react';
import './CreateObserverModal.scss'; // Import the SCSS file for styling

const CreateObserverModal = ({ onClose, onCreate }) => {
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate form data
    const form = e.target;
    if (form.password.value !== form.confirmPassword.value) {
      alert("Passwords don't match!");
      return;
    }

    // Prepare new observer data from the form
    const newObserver = {
      name: form.name.value,
      email: form.email.value,
      password: form.password.value,
      phonenum: form.phonenum.value,
      title: form.title.value,
      scientificRank: form.scientificRank.value,
      fatherName: form.fatherName.value,
      availability: form.availability.value,
    };

    // Call the onCreate function with the new data
    onCreate(newObserver);
    onClose();
  };

  return (
    <div className="create-observer-modal">
      <div className="modal-content">
        <h2>Create Observer</h2>
        <form onSubmit={handleSubmit} className="observer-form">
          {/* Name */}
          <div className="form-group">
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              required
            />
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
            />
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label htmlFor="phonenum">Phone Number:</label>
            <input
              type="tel"
              id="phonenum"
              name="phonenum"
              required
              pattern="[0-9]{10}"
              placeholder="Enter 10-digit phone number"
              className="form-control"
            />
          </div>

          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">Title:</label>
            <select
              id="title"
              name="title"
              required
            >
              <option value="">Select a title</option>
              <option value="Dr.">Dr.</option>
              <option value="Prof.">Prof.</option>
              <option value="Assistant Prof.">Assistant Prof.</option>
              <option value="Associate Prof.">Associate Prof.</option>
            </select>
          </div>

          {/* Scientific Rank */}
          <div className="form-group">
            <label htmlFor="scientificRank">Scientific Rank:</label>
            <select
              id="scientificRank"
              name="scientificRank"
              required
            >
              <option value="">Select a rank</option>
              <option value="Professor">Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="Lecturer">Lecturer</option>
            </select>
          </div>

          {/* Father Name */}
          <div className="form-group">
            <label htmlFor="fatherName">Father Name:</label>
            <input
              type="text"
              id="fatherName"
              name="fatherName"
              required
            />
          </div>

          {/* Availability */}
          <div className="form-group">
            <label htmlFor="availability">Availability:</label>
            <select
              id="availability"
              name="availability"
              required
            >
              <option value="">Select availability</option>
              <option value="full-time">Full time</option>
              <option value="part-time">Part time</option>
            </select>
          </div>

          {/* Submit and Cancel Buttons */}
          <div className="button-group">
            <button type="submit" className="save-button">
              <i className="fas fa-plus"></i> Create
            </button>
            <button type="button" className="cancel-button" onClick={onClose}>
              <i className="fas fa-times"></i> Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateObserverModal;
