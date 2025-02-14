import React, { useEffect, useState } from 'react';
import './CreateObserverModal.scss'; // Import the SCSS file for styling

const CreateObserverModal = ({ onClose, onCreate }) => {
  const [courseID, setCourseID] = useState(null); // State to hold the CourseID

  useEffect(() => {
    // Fetch the CourseID from the backend when the component mounts
    const fetchCourseID = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/courses/generateCourseID'); // Replace with your actual endpoint
        const data = await response.json();
        setCourseID(data.courseID); // Assuming the response contains a 'courseID' property
      } catch (error) {
        console.error('Error fetching CourseID:', error);
        // Handle error appropriately (e.g., display an error message)
      }
    };

    fetchCourseID();
  }, []);

  // Handle form submission and call onCreate
  const handleSubmit = (e) => {
    e.preventDefault();

    // Prepare new observer data from the form
    const newObserver = {
      name: e.target.name.value,
      email: e.target.email.value,
      password: e.target.password.value,
      phoneNum: e.target.phoneNum.value,
      title: e.target.title.value,
      scientificRank: e.target.scientificRank.value,
      fatherName: e.target.fatherName.value,
      availability: e.target.availability.value,
      courseID: courseID, // Use the fetched CourseID
    };

    // Call the onCreate function with the new data
    onCreate(newObserver);

    // Close the modal after creating
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

          {/* Phone Number */}
          <div className="form-group">
            <label htmlFor="phoneNum">Phone Number:</label>
            <input
              type="text"
              id="phoneNum"
              name="phoneNum"
            />
          </div>

          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">Title:</label>
            <input
              type="text"
              id="title"
              name="title"
            />
          </div>

          {/* Scientific Rank */}
          <div className="form-group">
            <label htmlFor="scientificRank">Scientific Rank:</label>
            <input
              type="text"
              id="scientificRank"
              name="scientificRank"
            />
          </div>

          {/* Father Name */}
          <div className="form-group">
            <label htmlFor="fatherName">Father Name:</label>
            <input
              type="text"
              id="fatherName"
              name="fatherName"
            />
          </div>

          {/* Availability */}
          <div className="form-group">
            <label htmlFor="availability">Availability:</label>
            <select
              id="availability"
              name="availability"
            >
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>

          {/* Course ID (Hidden) */}
          <input
            type="hidden"
            name="courseID"
            value={courseID || ''} // Use the fetched CourseID
          />

          {/* Submit Button */}
          <button type="submit" className="save-button">
            <i className="fas fa-plus"></i> Create
          </button>
          <button type="button" className="cancel-button" onClick={onClose}>
            <i className="fas fa-times"></i> Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateObserverModal;
