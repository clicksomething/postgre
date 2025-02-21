import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaSearch, FaEdit, FaTrash, FaSpinner, FaEye } from 'react-icons/fa';
import EditScheduleModal from './Modals/EditScheduleModal';
import './ViewSchedules.scss';

const ViewSchedules = ({ onScheduleSelect }) => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    
    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:3000/api/exams/schedules/all');
            setSchedules(response.data.schedules);
            setError(null);
        } catch (err) {
            console.error('Error fetching schedules:', err);
            setError('Failed to load exam schedules');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (scheduleId) => {
        if (window.confirm('Are you sure you want to delete this schedule?')) {
            try {
                const token = localStorage.getItem('authToken');
                await axios.delete(`http://localhost:3000/api/exams/schedules/${scheduleId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                await fetchSchedules();
            } catch (err) {
                setError(err.response?.data?.message || 'Error deleting schedule');
            }
        }
    };

    const handleView = async (scheduleId) => {
        try {
            const response = await axios.get(`http://localhost:3000/api/exams/schedules/${scheduleId}`);
            onScheduleSelect({ uploadId: scheduleId });
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching schedule details');
        }
    };

    const handleEdit = (schedule) => {
        setSelectedSchedule(schedule.scheduleInfo);
        setIsEditModalOpen(true);
    };

    const handleUpdateSuccess = async () => {
        await fetchSchedules();
        setIsEditModalOpen(false);
        setSelectedSchedule(null);
    };
    
    const filteredSchedules = schedules.filter(schedule => 
        schedule.scheduleInfo.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.scheduleInfo.academicYear?.toString().includes(searchTerm) ||
        schedule.scheduleInfo.semester?.toLowerCase().includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="loading-spinner">
                <FaSpinner className="spinner-icon" />
                <span>Loading schedules...</span>
            </div>
        );
    }

    return (
        <div className="view-schedules">
            <div className="search-bar">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Search schedules..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="schedule-table-container">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th>File Name</th>
                            <th>Academic Year</th>
                            <th>Semester</th>
                            <th>Exam Type</th>
                            <th>Status</th>
                            <th>Upload Date</th>
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
                                <td>
                                    <span className={`status-badge ${schedule.scheduleInfo.status}`}>
                                        {schedule.scheduleInfo.status}
                                    </span>
                                </td>
                                <td>{new Date(schedule.scheduleInfo.uploadedAt).toLocaleDateString()}</td>
                                <td className="actions">
                                    <button 
                                        className="view-button"
                                        onClick={() => handleView(schedule.scheduleInfo.uploadId)}
                                    >
                                        <FaEye /> View
                                    </button>
                                    <button 
                                        className="edit-button"
                                        onClick={() => handleEdit(schedule)}
                                    >
                                        <FaEdit /> Edit
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

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {isEditModalOpen && selectedSchedule && (
                <EditScheduleModal
                    schedule={selectedSchedule}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedSchedule(null);
                    }}
                    onUpdate={handleUpdateSuccess}
                />
            )}
        </div>
    );
};

export default ViewSchedules;