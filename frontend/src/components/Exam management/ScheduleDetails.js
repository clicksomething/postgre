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
    FaSortDown,
    FaExclamationTriangle,
    FaUserMd,
    FaClock
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
    const [overlaps, setOverlaps] = useState([]);
    const [showOverlaps, setShowOverlaps] = useState(false);
    const [roleViolations, setRoleViolations] = useState([]);
    const [showRoleViolations, setShowRoleViolations] = useState(false);
    const [timeslotViolations, setTimeslotViolations] = useState([]);
    const [showTimeslotViolations, setShowTimeslotViolations] = useState(false);
    const [checkingTimeslots, setCheckingTimeslots] = useState(false);

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

    // Simple display functions - backend should provide formatted data
    const formatDate = (dateString) => {
        if (!dateString) return '';
        // Backend should provide properly formatted dates
        return dateString;
    };

    const formatTime = (timeString) => {
        if (!timeString) return '';
        // Backend should provide properly formatted times
        return timeString;
    };

    const sortData = (data, key, direction) => {
        return [...data].sort((a, b) => {
            let aValue = key.split('.').reduce((obj, k) => obj?.[k], a);
            let bValue = key.split('.').reduce((obj, k) => obj?.[k], b);

            if (key === 'examDate') {
                // Simple string comparison - backend should provide consistent date format
                return direction === 'ascending' 
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
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
                formatDate(exam.examDate).toLowerCase().includes(searchString) ||
                (exam.observers.head && exam.observers.head.toLowerCase().includes(searchString)) ||
                (exam.observers.secretary && exam.observers.secretary.toLowerCase().includes(searchString))
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

    const checkForOverlaps = () => {
        if (!exams || exams.length === 0) {
            setOverlaps([]);
            return;
        }

        const overlapsFound = [];
        const observerAssignments = new Map(); // observerId -> array of assignments

        // Group assignments by observer
        exams.forEach(exam => {
            if (exam.observers.head) {
                if (!observerAssignments.has(exam.observers.head)) {
                    observerAssignments.set(exam.observers.head, []);
                }
                observerAssignments.get(exam.observers.head).push({
                    examId: exam.examId,
                    courseName: exam.course.name,
                    date: exam.examDate,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    role: 'head'
                });
            }
            if (exam.observers.secretary) {
                if (!observerAssignments.has(exam.observers.secretary)) {
                    observerAssignments.set(exam.observers.secretary, []);
                }
                observerAssignments.get(exam.observers.secretary).push({
                    examId: exam.examId,
                    courseName: exam.course.name,
                    date: exam.examDate,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    role: 'secretary'
                });
            }
        });

        // Check for overlaps for each observer
        observerAssignments.forEach((assignments, observerName) => {
            for (let i = 0; i < assignments.length; i++) {
                for (let j = i + 1; j < assignments.length; j++) {
                    const assignment1 = assignments[i];
                    const assignment2 = assignments[j];

                    // Check if same date
                    if (assignment1.date === assignment2.date) {
                        // Simple string comparison for time overlap - backend should handle complex logic
                        // This is just for display purposes
                        if (assignment1.startTime < assignment2.endTime && assignment1.endTime > assignment2.startTime) {
                            overlapsFound.push({
                                observer: observerName,
                                assignment1,
                                assignment2,
                                overlapType: `${assignment1.role} and ${assignment2.role}`
                            });
                        }
                    }
                }
            }
        });

        setOverlaps(overlapsFound);
        setShowOverlaps(true);
    };

    const checkForRoleViolations = () => {
        if (!exams || exams.length === 0) {
            setRoleViolations([]);
            return;
        }

        const violationsFound = [];

        // Check each exam for role violations
        exams.forEach(exam => {
            if (exam.observers.head) {
                // Get the full observer data to check title and scientific rank
                const headObserver = exam.observers.headObserver; // This should contain full observer data
                
                if (headObserver) {
                    // Check title and scientific rank like the backend does
                    const title = (headObserver.title || '').toLowerCase();
                    const scientificRank = (headObserver.scientificRank || '').toLowerCase();
                    
                    const doctorPatterns = [
                        'dr', 'doctor', 'dr.', 'prof', 'professor', 'assoc prof', 'associate professor',
                        'assistant prof', 'assistant professor', 'lecturer', 'instructor'
                    ];
                    
                    const hasDoctorTitle = doctorPatterns.some(pattern => title.includes(pattern));
                    const hasDoctorRank = doctorPatterns.some(pattern => scientificRank.includes(pattern));
                    const isExplicitlyDoctor = title === 'doctor' || scientificRank === 'doctor';
                    const hasDrPrefix = title.startsWith('dr') || scientificRank.startsWith('dr');
                    
                    const isDoctor = hasDoctorTitle || hasDoctorRank || isExplicitlyDoctor || hasDrPrefix;
                    
                    if (!isDoctor) {
                        violationsFound.push({
                            examId: exam.examId,
                            courseName: exam.course.name,
                            date: exam.examDate,
                            headName: exam.observers.head,
                            headTitle: headObserver.title || 'N/A',
                            headRank: headObserver.scientificRank || 'N/A',
                            violationType: 'Non-doctor assigned as head'
                        });
                    }
                } else {
                    // Fallback: check name if full observer data not available
                const headName = exam.observers.head.toLowerCase();
                const isDoctor = headName.includes('dr') || headName.includes('doctor') || headName.includes('prof');
                
                if (!isDoctor) {
                    violationsFound.push({
                        examId: exam.examId,
                        courseName: exam.course.name,
                        date: exam.examDate,
                        headName: exam.observers.head,
                            violationType: 'Non-doctor assigned as head (insufficient data)'
                    });
                    }
                }
            }
        });

        setRoleViolations(violationsFound);
        setShowRoleViolations(true);
    };

    const checkForTimeslotViolations = async () => {
        try {
            setCheckingTimeslots(true);
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Not authorized');
            }

            const response = await axios.get(`http://localhost:3000/api/exams/schedules/${uploadId}/check-timeslots`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setTimeslotViolations(response.data.violations || []);
            setShowTimeslotViolations(true);
        } catch (error) {
            console.error('Error checking timeslot compliance:', error);
            setError('Failed to check timeslot compliance');
        } finally {
            setCheckingTimeslots(false);
        }
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
                <button 
                    className="check-overlaps-button" 
                    onClick={checkForOverlaps}
                    title="Check for overlapping assignments"
                >
                    <FaExclamationTriangle /> Check Overlaps
                </button>
                <button 
                    className="check-roles-button" 
                    onClick={checkForRoleViolations}
                    title="Check for role violations (heads must be doctors)"
                >
                    <FaUserMd /> Check Roles
                </button>
                <button 
                    className="check-timeslots-button" 
                    onClick={checkForTimeslotViolations}
                    disabled={checkingTimeslots}
                    title="Check if assignments respect observer timeslots"
                >
                    <FaClock /> {checkingTimeslots ? 'Checking...' : 'Check Timeslots'}
                </button>
            </div>

            <div className="search-bar">
                <div className="search-input-wrapper">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search exams, courses, rooms, dates, or observer names..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {showOverlaps && (
                <div className="overlaps-section">
                    <div className="overlaps-header">
                        <h3>Assignment Overlaps</h3>
                        <button 
                            className="close-overlaps" 
                            onClick={() => setShowOverlaps(false)}
                        >
                            ×
                        </button>
                    </div>
                    {overlaps.length === 0 ? (
                        <div className="no-overlaps">
                            ✅ No overlapping assignments found!
                        </div>
                    ) : (
                        <div className="overlaps-list">
                            <div className="overlaps-summary">
                                ⚠️ Found {overlaps.length} overlapping assignment(s)
                            </div>
                            {overlaps.map((overlap, index) => (
                                <div key={index} className="overlap-item">
                                    <div className="overlap-observer">
                                        <strong>{overlap.observer}</strong> ({overlap.overlapType})
                                    </div>
                                    <div className="overlap-details">
                                        <div className="overlap-exam">
                                            <span className="exam-name">{overlap.assignment1.courseName}</span>
                                            <span className="exam-time">
                                                {formatDate(overlap.assignment1.date)} - {formatTime(overlap.assignment1.startTime)} to {formatTime(overlap.assignment1.endTime)}
                                            </span>
                                        </div>
                                        <div className="overlap-exam">
                                            <span className="exam-name">{overlap.assignment2.courseName}</span>
                                            <span className="exam-time">
                                                {formatDate(overlap.assignment2.date)} - {formatTime(overlap.assignment2.startTime)} to {formatTime(overlap.assignment2.endTime)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showRoleViolations && (
                <div className="role-violations-section">
                    <div className="role-violations-header">
                        <h3>Role Violations</h3>
                        <button 
                            className="close-role-violations" 
                            onClick={() => setShowRoleViolations(false)}
                        >
                            ×
                        </button>
                    </div>
                    {roleViolations.length === 0 ? (
                        <div className="no-role-violations">
                            ✅ All heads are doctors!
                        </div>
                    ) : (
                        <div className="role-violations-list">
                            <div className="role-violations-summary">
                                ⚠️ Found {roleViolations.length} role violation(s)
                            </div>
                            {roleViolations.map((violation, index) => (
                                <div key={index} className="role-violation-item">
                                    <div className="violation-details">
                                        <div className="violation-exam">
                                            <span className="exam-name">{violation.courseName}</span>
                                            <span className="exam-time">
                                                {formatDate(violation.date)}
                                            </span>
                                        </div>
                                        <div className="violation-info">
                                            <strong>Head:</strong> {violation.headName}
                                            {violation.headTitle && <span> (Title: {violation.headTitle})</span>}
                                            {violation.headRank && <span> (Rank: {violation.headRank})</span>}
                                            <span className="violation-type"> - {violation.violationType}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showTimeslotViolations && (
                <div className="timeslot-violations-section">
                    <div className="timeslot-violations-header">
                        <h3>Timeslot Compliance Check</h3>
                        <button 
                            className="close-timeslot-violations" 
                            onClick={() => setShowTimeslotViolations(false)}
                        >
                            ×
                        </button>
                    </div>
                    {timeslotViolations.length === 0 ? (
                        <div className="no-timeslot-violations">
                            ✅ All assignments respect observer timeslots!
                        </div>
                    ) : (
                        <div className="timeslot-violations-list">
                            <div className="timeslot-violations-summary">
                                ⚠️ Found {timeslotViolations.length} timeslot violation(s)
                            </div>
                            {timeslotViolations.map((assignment, index) => (
                                                                <div key={index} className="timeslot-violation-item">
                                    <div className="violation-header">
                                        <strong>{assignment.observerName}</strong> ({assignment.role})
                                    </div>
                                    <div className="violation-details">
                                        <div className="exam-info">
                                            <span className="course-name">{assignment.courseName}</span>
                                        </div>
                                        <div className="time-info">
                                            <span className="exam-date">{formatDate(assignment.examDate)}</span>
                                            <span className="exam-time">{assignment.examTime}</span>
                                            <span className="exam-day">({assignment.examDay})</span>
                                        </div>
                                        {assignment.violationType && (
                                            <div className="violation-reason">
                                                <strong>Issue:</strong> {assignment.violationType}
                                            </div>
                                        )}
                                        {assignment.availableSlots && assignment.availableSlots.length > 0 && (
                                            <div className="available-slots">
                                                <strong>Available slots on {assignment.examDay}:</strong>
                                                <ul>
                                                    {assignment.availableSlots.map((slot, slotIndex) => (
                                                        <li key={slotIndex}>
                                                            {slot.startTime} - {slot.endTime}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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