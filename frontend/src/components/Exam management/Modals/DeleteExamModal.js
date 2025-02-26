import React, { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import axios from 'axios';
import './DeleteExamModal.scss';

const DeleteExamModal = ({ exam, onClose, onDelete }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');
        
        if (!token || userRole !== 'admin') {
            setError('Only administrators can delete exams');
            return;
        }

        try {
            await axios.delete(`http://localhost:3000/api/exams/${exam.examId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            onDelete(exam.examId);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error deleting exam');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Delete Exam</h2>
                    <button className="close-button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className="modal-body">
                    <p>Are you sure you want to delete this exam?</p>
                    <div className="exam-details">
                        <p><strong>Course:</strong> {exam.course.name}</p>
                        <p><strong>Exam Name:</strong> {exam.examName}</p>
                        <p><strong>Date:</strong> {new Date(exam.examDate).toLocaleDateString()}</p>
                    </div>
                    {error && <div className="error-message">{error}</div>}
                </div>

                <div className="modal-actions">
                    <button 
                        className="cancel-button" 
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button 
                        className="delete-button"
                        onClick={handleDelete}
                        disabled={loading}
                    >
                        {loading ? 'Deleting...' : 'Delete Exam'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteExamModal; 