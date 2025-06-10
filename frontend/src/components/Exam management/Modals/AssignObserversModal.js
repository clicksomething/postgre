import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaCheck } from 'react-icons/fa';
import axios from 'axios';
import './AssignObserversModal.scss';

const AssignObserversModal = ({ 
    isOpen, 
    onClose, 
    examId, 
    scheduleId 
}) => {
    const [availableObservers, setAvailableObservers] = useState([]);
    const [selectedObservers, setSelectedObservers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [assigning, setAssigning] = useState(false);

    const fetchAvailableObservers = useCallback(async () => {
        if (!examId || !scheduleId) return;
        
        try {
            setLoading(true);
            const response = await axios.get(`/api/observers/available?examId=${examId}&scheduleId=${scheduleId}`);
            setAvailableObservers(response.data);
        } catch (error) {
            console.error('Error fetching available observers:', error);
        } finally {
            setLoading(false);
        }
    }, [examId, scheduleId]);

    useEffect(() => {
        if (isOpen) {
            fetchAvailableObservers();
        }
    }, [isOpen, fetchAvailableObservers]);

    const handleAssign = async () => {
        try {
            setAssigning(true);
            const token = localStorage.getItem('authToken');
            await axios.post(
                `http://localhost:3000/api/assignments/exams/${examId}/assign`,
                {},
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            onClose();
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
                    <p><strong>Exam:</strong> {examId}</p>
                    <p><strong>Date:</strong> {new Date(scheduleId).toLocaleDateString()}</p>
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