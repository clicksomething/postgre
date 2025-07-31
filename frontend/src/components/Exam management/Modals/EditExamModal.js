import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import axios from 'axios';
import './EditExamModal.scss';

const EditExamModal = ({ exam, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        examName: exam.examName || '',
        courseName: exam.course.name || '',
        roomNum: exam.room.number || '',
        roomCapacity: exam.room.capacity || '',
        examDate: exam.examDate || '',
        startTime: exam.startTime || '',
        endTime: exam.endTime || '',
        numOfStudents: exam.numOfStudents || ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [conflicts, setConflicts] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'startTime' || name === 'endTime') {
            // Simple time input - backend should validate format
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
        
        setConflicts(null);
        setError(null);
    };

    const validateForm = () => {
        if (!formData.examName || !formData.courseName || !formData.roomNum || 
            !formData.examDate || !formData.startTime || !formData.endTime || 
            !formData.numOfStudents || !formData.roomCapacity) {
            setError('All fields are required');
            return false;
        }

        // Basic validation - backend should handle complex validation
        if (!formData.startTime || !formData.endTime) {
            setError('Start time and end time are required');
            return false;
        }

        // Simple time comparison - backend should handle complex validation
        if (formData.startTime >= formData.endTime) {
            setError('End time must be after start time');
            return false;
        }

        // Validate student count against room capacity
        if (parseInt(formData.numOfStudents) > parseInt(formData.roomCapacity)) {
            setError(`Number of students exceeds room capacity (${formData.roomCapacity})`);
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        const token = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');
        
        if (!token || userRole !== 'admin') {
            setError('Only administrators can edit exams');
            return;
        }

        setLoading(true);
        setError(null);
        setConflicts(null);

        try {
            const response = await axios.put(
                `http://localhost:3000/api/exams/${exam.examId}`,
                formData,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            onUpdate();
        } catch (err) {
            if (err.response?.status === 409) {
                setConflicts(err.response.data.conflicts);
            } else {
                setError(err.response?.data?.message || 'Error updating exam');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Edit Exam</h2>
                </div>

                {error && <div className="error-message">{error}</div>}
                
                {conflicts && (
                    <div className="conflicts-warning">
                        <h3>⚠️ Time Slot Conflicts Detected</h3>
                        <ul>
                            {conflicts.map((conflict, index) => (
                                <li key={index}>
                                    {conflict.examName} ({conflict.courseName})<br />
                                    Time: {conflict.startTime} - {conflict.endTime}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Exam Name</label>
                        <input
                            type="text"
                            name="examName"
                            value={formData.examName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Course Name</label>
                        <input
                            type="text"
                            name="courseName"
                            value={formData.courseName}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Room Number</label>
                            <input
                                type="text"
                                name="roomNum"
                                value={formData.roomNum}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Room Capacity</label>
                            <input
                                type="number"
                                name="roomCapacity"
                                value={formData.roomCapacity}
                                onChange={handleChange}
                                min="1"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Exam Date</label>
                        <input
                            type="date"
                            name="examDate"
                            value={formData.examDate}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Start Time (HH:mm)</label>
                            <input
                                type="time"
                                name="startTime"
                                value={formData.startTime}
                                onChange={handleChange}
                                step="60"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>End Time (HH:mm)</label>
                            <input
                                type="time"
                                name="endTime"
                                value={formData.endTime}
                                onChange={handleChange}
                                step="60"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Number of Students</label>
                        <input
                            type="number"
                            name="numOfStudents"
                            value={formData.numOfStudents}
                            onChange={handleChange}
                            min="1"
                            required
                        />
                    </div>

                    <div className="modal-actions">
                        <button 
                            type="button" 
                            className="cancel-button"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="save-button"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditExamModal; 
