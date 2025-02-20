import React, { useState } from 'react';
import { FaUpload, FaList, FaCalendarAlt } from 'react-icons/fa';
import ViewSchedules from './ViewSchedules';
import UploadSchedule from './UploadSchedule';
import ScheduleDetails from './ScheduleDetails';
import './ManageExams.scss';

const ManageExams = () => {
    const [activeView, setActiveView] = useState('schedules');
    const [selectedSchedule, setSelectedSchedule] = useState(null);

    const handleScheduleSelect = (schedule) => {
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
            </div>

            <div className="exam-content">
                {activeView === 'schedules' && (
                    <ViewSchedules onScheduleSelect={handleScheduleSelect} />
                )}
                {activeView === 'upload' && (
                    <UploadSchedule onUploadSuccess={() => setActiveView('schedules')} />
                )}
                {activeView === 'details' && selectedSchedule && (
                    <ScheduleDetails 
                        schedule={selectedSchedule}
                        onBack={() => setActiveView('schedules')}
                    />
                )}
            </div>
        </div>
    );
};

export default ManageExams;
