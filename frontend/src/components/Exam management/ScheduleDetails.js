import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EditExamModal from './Modals/EditExamModal';
import DeleteExamModal from './Modals/DeleteExamModal';
import './ScheduleDetails.scss';
import { useParams } from 'react-router-dom';
import { 
    FaArrowLeft, 
    FaEdit, 
    FaTrash, 
    FaSearch, 
    FaSort, 
    FaSortUp, 
    FaSortDown 
} from 'react-icons/fa';

const ScheduleDetails = () => {
    const { id: uploadId } = useParams(); // Get the uploadId from the URL params
    console.log('Upload ID from URL:', uploadId); // Log the ID
    const [examDetails, setExamDetails] = useState(null);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedExam, setSelectedExam] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

    useEffect(() => {
        if (uploadId) {
            console.log('Fetching exam details for uploadId:', uploadId);
            fetchExamDetails(uploadId);
        }
    }, [uploadId]);

    const fetchExamDetails = async (scheduleId) => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setError('Please log in to view details');
                return;
            }

            setLoading(true);
            const response = await axios.get(`http://localhost:3000/api/exams/schedules/${scheduleId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Backend Response:', response.data); // Log the response

            // Set the schedule details correctly
            if (response.data && response.data.schedule) {
                setExamDetails(response.data.schedule); // Set the entire schedule object
                setExams(response.data.schedule.exams); // Set the associated exams
                setError(null);
            } else {
                setError('No schedule data found');
            }
        } catch (err) {
            console.error('Error fetching exam details:', err);
            setError('Failed to fetch exam details');
        } finally {
            setLoading(false);
        }
    };

    const handleExamDeleted = (deletedExamId) => {
        setExams(prev => prev.filter(exam => exam.examId !== deletedExamId));
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

    const sortData = (data, key, direction) => {
        return [...data].sort((a, b) => {
            let aValue = key.split('.').reduce((obj, k) => obj?.[k], a);
            let bValue = key.split('.').reduce((obj, k) => obj?.[k], b);

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

    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <FaSort />;
        return sortConfig.direction === 'ascending' ? <FaSortUp /> : <FaSortDown />;
    };

    const getFilteredAndSortedExams = () => {
        if (!exams) return [];

        let filteredExams = exams.filter(exam => {
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

    const handleEditClick = (exam) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please log in to edit exams');
            return;
        }
        setSelectedExam(exam);
        setShowEditModal(true);
    };

    const handleDeleteClick = (exam) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please log in to delete exams');
            return;
        }
        setSelectedExam(exam);
        setShowDeleteModal(true);
    };

    if (!examDetails) {
        return <div className="no-data">No schedule information available</div>;
    }

    return (
        <div className="schedule-details">
            <div className="details-header">
                <button className="back-button" onClick={() => window.history.back()}>
                    <FaArrowLeft /> Back to Schedules
                </button>
                <div className="schedule-info">
                    <h2>{examDetails.scheduleInfo?.fileName || 'No Filename Available'}</h2>
                    <div className="info-cards">
                        <div className="info-card">
                            <span className="label">Academic Year</span>
                            <span className="value">{examDetails.scheduleInfo?.academicYear || 'N/A'}</span>
                        </div>
                        <div className="info-card">
                            <span className="label">Semester</span>
                            <span className="value">{examDetails.scheduleInfo?.semester || 'N/A'}</span>
                        </div>
                        <div className="info-card">
                            <span className="label">Type</span>
                            <span className="value">{examDetails.scheduleInfo?.examType || 'N/A'}</span>
                        </div>
                    </div>
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
                {exams.length === 0 ? (
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
                                            {                                            ['admin'].includes(localStorage.getItem('userRole')) && (
                                                <div className="row-actions">
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => handleEditClick(exam)}
                                                        data-tooltip="Edit Exam"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() => handleDeleteClick(exam)}
                                                        data-tooltip="Delete Exam"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
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
                        fetchExamDetails(uploadId);
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