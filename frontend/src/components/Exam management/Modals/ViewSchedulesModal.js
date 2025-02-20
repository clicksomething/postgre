import React, { useState, useEffect } from 'react';
import { Modal } from '../../UI/Modal';
import { FaSearch, FaTimes, FaEdit, FaTrash } from 'react-icons/fa';
import './ViewSchedulesModal.scss';

const ViewSchedulesModal = ({ isOpen, onClose, onViewDetails }) => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSchedules();
        }
    }, [isOpen]);

    const fetchSchedules = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/exams/schedules/all');
            if (!response.ok) throw new Error('Failed to fetch schedules');
            const data = await response.json();
            setSchedules(data.schedules);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (scheduleId) => {
        if (window.confirm('Are you sure you want to delete this schedule?')) {
            try {
                const response = await fetch(`http://localhost:3000/api/exams/schedules/${scheduleId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error('Failed to delete schedule');
                fetchSchedules();
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const filteredSchedules = schedules.filter(schedule => 
        schedule.scheduleInfo.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.scheduleInfo.academicYear.toString().includes(searchTerm) ||
        schedule.scheduleInfo.semester.toLowerCase().includes(searchTerm)
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="View Exam Schedules"
            size="large"
        >
            <div className="view-schedules-container">
                <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search schedules..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            className="clear-search"
                            onClick={() => setSearchTerm('')}
                        >
                            <FaTimes />
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="loading-spinner">
                        <div className="spinner-icon">⌛</div>
                        Loading schedules...
                    </div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : filteredSchedules.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>No schedules found</p>
                    </div>
                ) : (
                    <div className="schedule-table-container">
                        <table className="schedule-table">
                            <thead>
                                <tr>
                                    <th>File Name</th>
                                    <th>Academic Year</th>
                                    <th>Semester</th>
                                    <th>Exam Type</th>
                                    <th>Status</th>
                                    <th>Exam Count</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSchedules.map(schedule => (
                                    <tr key={schedule.scheduleInfo.uploadId}>
                                        <td>{schedule.scheduleInfo.fileName}</td>
                                        <td>{schedule.scheduleInfo.academicYear}</td>
                                        <td>{schedule.scheduleInfo.semester}</td>
                                        <td>{schedule.scheduleInfo.examType}</td>
                                        <td>{schedule.scheduleInfo.status}</td>
                                        <td>{schedule.scheduleInfo.examCount}</td>
                                        <td>
                                            <button 
                                                className="edit-button"
                                                onClick={() => onViewDetails(schedule)}
                                            >
                                                <FaEdit /> View
                                            </button>
                                            <button 
                                                className="delete-button"
                                                onClick={() => handleDelete(schedule.scheduleInfo.uploadId)}
                                            >
                                                <FaTrash /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ViewSchedulesModal;