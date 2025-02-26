import React, { useState, useEffect } from 'react';
import { FaUpload, FaList, FaCalendarAlt, FaUserCheck } from 'react-icons/fa';
import ViewSchedules from './ViewSchedules';
import UploadSchedule from './UploadSchedule';
import ScheduleDetails from './ScheduleDetails';
import AssignObserversModal from './Modals/AssignObserversModal';
import AssignmentsView from './AssignmentsView';
import axios from 'axios';
import './ManageExams.scss';

const ManageExams = () => {
    const [activeView, setActiveView] = useState('schedules');
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedExamForAssignment, setSelectedExamForAssignment] = useState(null);
    const [schedules, setSchedules] = useState([]);

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
            setSchedules(response.data);
        } catch (error) {
            console.error('Error fetching schedules:', error);
            if (error.response?.status === 401) {
                console.error('Unauthorized. Please log in again.');
                // Redirect to login or refresh the token
            } else if (error.response?.status === 404) {
                console.error('Endpoint not found. Please check the backend API.');
            }
        }
    };

    const handleScheduleSelect = (schedule) => {
        setSelectedSchedule(schedule);
        setActiveView('details');
    };

    const handleAssignClick = (exam) => {
        setSelectedExamForAssignment(exam);
        setShowAssignModal(true);
    };

    const handleViewDetails = (schedule) => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please log in to view details');
            return;
        }
        setSelectedSchedule(schedule);
        setActiveView('details');
    };

    return (
        <div className="manage-exams-container">
            <h1>Exam Management</h1>
            
            <div className="exam-actions">
                <button 
                    className={`action-button ${activeView === 'schedules' ? 'active' : ''}`}
                    onClick={() => setActiveView('schedules')}
                >
                    <FaList /> View Schedules
                </button>
                <button 
                    className={`action-button ${activeView === 'upload' ? 'active' : ''}`}
                    onClick={() => setActiveView('upload')}
                >
                    <FaUpload /> Upload Schedule
                </button>
                <button 
                    className={`action-button ${activeView === 'assignments' ? 'active' : ''}`}
                    onClick={() => setActiveView('assignments')}
                >
                    <FaUserCheck /> Manage Assignments
                </button>
            </div>

            <div className="exam-content">
                {activeView === 'schedules' && (
                    <ViewSchedules schedules={schedules} onScheduleSelect={handleScheduleSelect} />
                )}
                {activeView === 'upload' && (
                    <UploadSchedule onUploadSuccess={() => setActiveView('schedules')} />
                )}
                {activeView === 'assignments' && (
                    <AssignmentsView />
                )}
                {activeView === 'details' && selectedSchedule && (
                    <ScheduleDetails 
                        schedule={selectedSchedule}
                        onBack={() => setActiveView('schedules')}
                    />
                )}
            </div>

            {showAssignModal && selectedExamForAssignment && (
                <AssignObserversModal
                    exam={selectedExamForAssignment}
                    onClose={() => {
                        setShowAssignModal(false);
                        setSelectedExamForAssignment(null);
                    }}
                    onAssign={() => {
                        fetchSchedules();
                        setShowAssignModal(false);
                        setSelectedExamForAssignment(null);
                    }}
                />
            )}
        </div>
    );
};

export default ManageExams;
