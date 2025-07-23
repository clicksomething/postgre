import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';
import './EditScheduleModal.scss';

const EditScheduleModal = ({ schedule, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        academicYear: schedule.academicYear || '',
        semester: schedule.semester || 'First',
        examType: schedule.examType || 'First'
    });
    const [affectedExams, setAffectedExams] = useState(null);
    const [updateExams, setUpdateExams] = useState(false);
    const [step, setStep] = useState(1);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [touched, setTouched] = useState(false);

    const validateAcademicYear = (year) => {
        if (!year) return null; // Allow empty value while typing
        
        // Check format YYYY-YYYY
        const yearPattern = /^(\d{4})-(\d{4})$/;
        const match = year.match(yearPattern);
        
        if (!match) {
            return "Academic year must be in format YYYY-YYYY";
        }
        
        const firstYear = parseInt(match[1]);
        const secondYear = parseInt(match[2]);
        
        // Check if second year is first year + 1
        if (secondYear !== firstYear + 1) {
            return "Invalid academic year range. Second year must be the year after the first year";
        }
        
        return null; // no error
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error while typing
        if (name === 'academicYear') {
            setError(null);
        }
    };

    const handleBlur = (e) => {
        if (e.target.name === 'academicYear') {
            setTouched(true);
            const error = validateAcademicYear(e.target.value);
            if (error) {
                setError(error);
            }
        }
    };

    const handleCheck = async (e) => {
        e.preventDefault();
        
        const error = validateAcademicYear(formData.academicYear);
        if (error) {
            setError(error);
            setTouched(true);
            return;
        }
        
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Not authorized');
            }

            const response = await axios.post(
                `http://localhost:3000/api/exams/schedules/${schedule.uploadId}/check`,
                { academicYear: formData.academicYear },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (response.data.yearChanged && response.data.requiresConfirmation) {
                setAffectedExams(response.data.affectedExams);
                setStep(2);
            } else {
                // If year hasn't changed, proceed with update directly
                handleSubmit();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error checking schedule update');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        const token = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');
        
        if (!token || userRole !== 'admin') {
            setError('Only administrators can edit schedules');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await axios.put(
                `http://localhost:3000/api/exams/schedules/${schedule.uploadId}`,
                { ...formData, updateExams },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            onUpdate(response.data.schedule);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error updating schedule');
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Edit Schedule</h2>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleCheck}>
                        <div className="form-group">
                            <label>Academic Year (YYYY-YYYY)</label>
                            <input
                                type="text"
                                name="academicYear"
                                value={formData.academicYear}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                placeholder="e.g., 2023-2024"
                                required
                            />
                            <small className="helper-text">
                                Format: YYYY-YYYY (e.g., 2023-2024). Second year must be the year after the first year.
                            </small>
                            {touched && error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Semester</label>
                            <select 
                                name="semester"
                                value={formData.semester}
                                onChange={handleChange}
                                required
                            >
                                <option value="First">First</option>
                                <option value="Second">Second</option>
                                <option value="Summer">Summer</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Exam Type</label>
                            <select 
                                name="examType"
                                value={formData.examType}
                                onChange={handleChange}
                                required
                            >
                                <option value="First">First</option>
                                <option value="Second">Second</option>
                                <option value="Final">Final</option>
                            </select>
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
                                {loading ? 'Checking...' : 'Continue'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="confirmation-step">
                        <h3>Warning: This will affect existing exams</h3>
                        
                        {affectedExams.hasLeapYearDates && (
                            <div className="leap-year-warning">
                                <p>⚠️ Warning: Some exams fall on February 29th (leap year). 
                                When updated, these dates will automatically adjust to February 28th 
                                in non-leap years.</p>
                            </div>
                        )}

                        <p>The following exams will be affected:</p>
                        <div className="affected-exams">
                            <ul>
                                {affectedExams.map(exam => (
                                    <li key={exam.examid}>
                                        <strong>{exam.coursename}</strong> - {exam.examname}
                                        <br />
                                        <span className="exam-date">
                                            Date: {new Date(exam.examdate).toLocaleDateString('en-GB')}
                                            {exam.isleapyeardate && ' (Leap year date)'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="updateExams"
                                checked={updateExams}
                                onChange={(e) => setUpdateExams(e.target.checked)}
                            />
                            <label htmlFor="updateExams">
                                Update exam dates to match new academic year
                            </label>
                        </div>

                        <div className="button-group">
                            <button 
                                className="back-button"
                                onClick={() => setStep(1)}
                                disabled={loading}
                            >
                                Back
                            </button>
                            <button 
                                className="save-button"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? 'Updating...' : 'Proceed with Update'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditScheduleModal;