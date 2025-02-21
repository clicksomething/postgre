import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUserTie, FaEdit, FaTrash, FaSearch, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import axios from 'axios';
import EditExamModal from './Modals/EditExamModal';
import DeleteExamModal from './Modals/DeleteExamModal';
import './ScheduleDetails.scss';

const ScheduleDetails = ({ schedule, onBack }) => {
    const [examDetails, setExamDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedExam, setSelectedExam] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    
    // New states for search and sort
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: 'ascending'
    });

    useEffect(() => {
        if (schedule?.uploadId) {
            fetchExamDetails(schedule.uploadId);
        }
    }, [schedule]);

    const fetchExamDetails = async (scheduleId) => {
        try {
            setLoading(true);
            const response = await axios.get(`http://localhost:3000/api/exams/schedules/${scheduleId}`);
            setExamDetails(response.data.schedule);
            setError(null);
        } catch (err) {
            console.error('Error fetching exam details:', err);
            setError('Failed to load exam details');
        } finally {
            setLoading(false);
        }
    };

    const handleExamDeleted = (deletedExamId) => {
        setExamDetails(prev => ({
            ...prev,
            exams: prev.exams.filter(exam => exam.examId !== deletedExamId)
        }));
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Sorting function
    const sortData = (data, key, direction) => {
        return [...data].sort((a, b) => {
            let aValue = key.split('.').reduce((obj, k) => obj?.[k], a);
            let bValue = key.split('.').reduce((obj, k) => obj?.[k], b);

            // Handle special cases
            if (key === 'examDate') {
                return direction === 'ascending' 
                    ? new Date(aValue) - new Date(bValue)
                    : new Date(bValue) - new Date(aValue);
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return direction === 'ascending' ? 1 : -1;
            return 0;
        });
    };

    // Handle sort click
    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Get sort icon
    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <FaSort />;
        return sortConfig.direction === 'ascending' ? <FaSortUp /> : <FaSortDown />;
    };

    // Filter and sort exams
    const getFilteredAndSortedExams = () => {
        if (!examDetails?.exams) return [];

        let filteredExams = examDetails.exams.filter(exam => {
            const searchString = searchTerm.toLowerCase();
            return (
                exam.examName.toLowerCase().includes(searchString) ||
                exam.course.name.toLowerCase().includes(searchString) ||
                exam.room.number.toLowerCase().includes(searchString) ||
                formatDate(exam.examDate).toLowerCase().includes(searchString)
            );
        });

        if (sortConfig.key) {
            filteredExams = sortData(filteredExams, sortConfig.key, sortConfig.direction);
        }

        return filteredExams;
    };

    if (!schedule) {
        return <div className="no-data">No schedule selected</div>;
    }

    if (loading) {
        return <div className="loading">Loading exam details...</div>;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    if (!examDetails) {
        return <div className="no-data">No exam details available</div>;
    }

    return (
        <div className="schedule-details">
            <div className="details-header">
                <button className="back-button" onClick={onBack}>
                    <FaArrowLeft /> Back to Schedules
                </button>
                <h2>{examDetails.scheduleInfo.fileName}</h2>
                <div className="schedule-meta">
                    <span>Academic Year: {examDetails.scheduleInfo.academicYear}</span>
                    <span>Semester: {examDetails.scheduleInfo.semester}</span>
                    <span>Type: {examDetails.scheduleInfo.examType}</span>
                </div>
            </div>

            <div className="search-bar">
                <div className="search-input-wrapper">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search exams..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="details-content">
                {examDetails.exams.length === 0 ? (
                    <div className="no-data">No exams found for this schedule.</div>
                ) : (
                    <div className="table-responsive">
                        <table className="exams-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('examDate')} className="sortable">
                                        Date {getSortIcon('examDate')}
                                    </th>
                                    <th onClick={() => handleSort('startTime')} className="sortable">
                                        Time {getSortIcon('startTime')}
                                    </th>
                                    <th onClick={() => handleSort('course.name')} className="sortable">
                                        Course {getSortIcon('course.name')}
                                    </th>
                                    <th onClick={() => handleSort('examName')} className="sortable">
                                        Exam Name {getSortIcon('examName')}
                                    </th>
                                    <th onClick={() => handleSort('room.number')} className="sortable">
                                        Room {getSortIcon('room.number')}
                                    </th>
                                    <th onClick={() => handleSort('numOfStudents')} className="sortable">
                                        Students {getSortIcon('numOfStudents')}
                                    </th>
                                    <th>Head</th>
                                    <th>Secretary</th>
                                    <th onClick={() => handleSort('status')} className="sortable">
                                        Status {getSortIcon('status')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {getFilteredAndSortedExams().map((exam) => (
                                    <tr key={exam.examId} className="exam-row">
                                        <td>{formatDate(exam.examDate)}</td>
                                        <td>
                                            {formatTime(exam.startTime)} - {formatTime(exam.endTime)}
                                        </td>
                                        <td className="course-cell">
                                            {exam.course.name}
                                            <div className="row-actions">
                                                <button
                                                    className="edit-button"
                                                    onClick={() => {
                                                        setSelectedExam(exam);
                                                        setShowEditModal(true);
                                                    }}
                                                    data-tooltip="Edit Exam"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    className="delete-button"
                                                    onClick={() => {
                                                        setSelectedExam(exam);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    data-tooltip="Delete Exam"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="exam-name-cell">{exam.examName}</td>
                                        <td>
                                            <div className="room-info">
                                                {exam.room.number}
                                                <span className="capacity">
                                                    ({exam.numOfStudents}/{exam.room.capacity})
                                                </span>
                                            </div>
                                        </td>
                                        <td>{exam.numOfStudents}</td>
                                        <td>{exam.observers.head || '-'}</td>
                                        <td>{exam.observers.secretary || '-'}</td>
                                        <td>
                                            <span className={`status-badge ${exam.status}`}>
                                                {exam.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showEditModal && (
                <EditExamModal
                    exam={selectedExam}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedExam(null);
                    }}
                    onUpdate={() => {
                        setShowEditModal(false);
                        setSelectedExam(null);
                        fetchExamDetails(schedule.uploadId);
                    }}
                />
            )}

            {showDeleteModal && (
                <DeleteExamModal
                    exam={selectedExam}
                    onClose={() => {
                        setShowDeleteModal(false);
                        setSelectedExam(null);
                    }}
                    onDelete={handleExamDeleted}
                />
            )}
        </div>
    );
};

export default ScheduleDetails;
