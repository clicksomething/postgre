import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FaSearch, FaEdit, FaTrash, FaSpinner, FaEye } from 'react-icons/fa';
import EditScheduleModal from './Modals/EditScheduleModal';
import './ViewSchedules.scss';
import { useNavigate } from 'react-router-dom';

const ViewSchedules = ({ onScheduleSelect }) => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const navigate = useNavigate();
    
    useEffect(() => {
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Not authorized');
            }

            const response = await axios.get('http://localhost:3000/api/exams/schedules/all', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Frontend Response:', response.data);
            setSchedules(response.data.schedules);
            setError(null);
        } catch (error) {
            console.error('Error fetching schedules:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (scheduleId) => {
        if (window.confirm('Are you sure you want to delete this schedule?')) {
            try {
                const token = localStorage.getItem('authToken');
                if (!token) {
                    throw new Error('Not authorized');
                }

                await axios.delete(`http://localhost:3000/api/exams/schedules/${scheduleId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                await fetchSchedules();
            } catch (err) {
                setError(err.response?.data?.message || 'Error deleting schedule');
            }
        }
    };

    const handleViewDetails = (uploadId) => {
        navigate(`/schedules/${uploadId}`);
        onScheduleSelect({ uploadId });
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
    
    const getFilteredAndSortedExams = useMemo(() => {
        if (!schedules) return [];

        let filteredExams = schedules.filter(schedule => {
            const searchString = searchTerm.toLowerCase();
            return (
                schedule.scheduleInfo?.fileName?.toLowerCase().includes(searchString) ||
                schedule.scheduleInfo?.academicYear?.toString().includes(searchString) ||
                schedule.scheduleInfo?.semester?.toLowerCase().includes(searchString)
            );
        });

        return filteredExams;
    }, [schedules, searchTerm]);

    if (loading) {
        return (
            <div className="loading-spinner">
                <FaSpinner className="spinner-icon" />
                <span>Loading schedules...</span>
            </div>
        );
    }

    if (error) {
        return <div>Error: {error}</div>;
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
                        {getFilteredAndSortedExams.map(schedule => (
                            <tr key={schedule.scheduleInfo?.uploadId || schedule.uploadid}>
                                <td>{schedule.scheduleInfo?.fileName || schedule.filename}</td>
                                <td>{schedule.scheduleInfo?.academicYear || schedule.academicyear}</td>
                                <td>{schedule.scheduleInfo?.semester || schedule.semester}</td>
                                <td>{schedule.scheduleInfo?.examType || schedule.examtype}</td>
                                <td>
                                    <span className={`status-badge ${schedule.scheduleInfo?.status || schedule.status}`}>
                                        {schedule.scheduleInfo?.status || schedule.status}
                                    </span>
                                </td>
                                <td>{new Date(schedule.scheduleInfo?.uploadedAt || schedule.uploadedat).toLocaleDateString()}</td>
                                <td className="actions">
                                    <button 
                                        className="view-button"
                                        onClick={() => handleViewDetails(schedule.scheduleInfo?.uploadId || schedule.uploadid)}
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
                                        onClick={() => handleDelete(schedule.scheduleInfo?.uploadId || schedule.uploadid)}
                                    >
                                        <FaTrash /> Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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