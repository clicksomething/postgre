import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUserTie } from 'react-icons/fa';
import axios from 'axios';
import './ScheduleDetails.scss';

const ScheduleDetails = ({ schedule, onBack }) => {
    const [examDetails, setExamDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

            <div className="details-content">
                {examDetails.exams.length === 0 ? (
                    <div className="no-data">No exams found for this schedule.</div>
                ) : (
                    <div className="table-responsive">
                        <table className="exams-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Course</th>
                                    <th>Exam Name</th>
                                    <th>Room</th>
                                    <th>Students</th>
                                    <th>Head Observer</th>
                                    <th>Secretary</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {examDetails.exams.map((exam) => (
                                    <tr key={exam.examId}>
                                        <td>{formatDate(exam.examDate)}</td>
                                        <td>
                                            {formatTime(exam.startTime)} - {formatTime(exam.endTime)}
                                        </td>
                                        <td>
                                            <div className="course-name">{exam.course.name}</div>
                                            {exam.course.department && (
                                                <div className="department-name">
                                                    {exam.course.department}
                                                </div>
                                            )}
                                        </td>
                                        <td>{exam.examName}</td>
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
        </div>
    );
};

export default ScheduleDetails;
