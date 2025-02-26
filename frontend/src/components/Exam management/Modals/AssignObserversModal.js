import React, { useState, useEffect } from 'react';
import { FaTimes, FaCheck } from 'react-icons/fa';
import axios from 'axios';
import './AssignObserversModal.scss';

const AssignObserversModal = ({ exam, onClose, onAssign }) => {
    const [availableObservers, setAvailableObservers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        fetchAvailableObservers();
    }, []);

    const fetchAvailableObservers = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.get(
                `http://localhost:3000/api/assignments/exams/${exam.id}/available-observers`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            setAvailableObservers(response.data.data);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching observers');
            setLoading(false);
        }
    };

    const handleAssign = async () => {
        try {
            setAssigning(true);
            const token = localStorage.getItem('authToken');
            await axios.post(
                `http://localhost:3000/api/assignments/exams/${exam.id}/assign`,
                {},
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            onAssign();
        } catch (err) {
            setError(err.response?.data?.message || 'Error assigning observers');
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="assign-observers-modal">
            <div className="modal-content">
                <button className="close-button" onClick={onClose}>
                    <FaTimes />
                </button>
                <h2>Assign Observers</h2>
                <div className="exam-details">
                    <p><strong>Exam:</strong> {exam.examName}</p>
                    <p><strong>Date:</strong> {new Date(exam.examDate).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> {exam.startTime} - {exam.endTime}</p>
                </div>

                {loading ? (
                    <div className="loading">Loading available observers...</div>
                ) : error ? (
                    <div className="error">{error}</div>
                ) : (
                    <div className="observers-list">
                        <h3>Available Observers:</h3>
                        {availableObservers.map(observer => (
                            <div key={observer.ObserverID} className="observer-item">
                                <div className="observer-info">
                                    <p className="name">{observer.Title} {observer.Name}</p>
                                    <p className="rank">{observer.ScientificRank}</p>
                                    <p className="workload">Current Assignments: {observer.workload}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="buttons">
                    <button 
                        type="button" 
                        className="secondary" 
                        onClick={onClose}
                    >
                        <FaTimes /> Cancel
                    </button>
                    <button
                        type="button"
                        className="primary"
                        onClick={handleAssign}
                        disabled={loading || assigning || availableObservers.length < 2}
                    >
                        <FaCheck /> {assigning ? 'Assigning...' : 'Assign Observers'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignObserversModal; 