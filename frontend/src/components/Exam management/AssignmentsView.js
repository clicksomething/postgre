import React, { useState, useEffect } from 'react';
import { FaSearch, FaTimes, FaCheck, FaExclamationTriangle, FaClipboardList } from 'react-icons/fa';
import axios from 'axios';
import DistributionOptionsModal from './Modals/DistributionOptionsModal';
import './AssignmentsView.scss';

const AssignmentsView = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [showDistributionModal, setShowDistributionModal] = useState(false);

    useEffect(() => {
        fetchScheduleAssignments();
    }, []);

    const fetchScheduleAssignments = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const userRole = localStorage.getItem('userRole');
            
            if (!token || userRole !== 'admin') {
                throw new Error('Not authorized');
            }

            const response = await axios.get('http://localhost:3000/api/exams/schedule-assignments', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Schedule Assignments:', response.data);
            
            if (Array.isArray(response.data)) {
                setSchedules(response.data);
            } else {
                setError('Invalid data format received from server');
            }
            setLoading(false);
        } catch (err) {
            console.error('Detailed error:', err);
            setError(err.response?.data?.message || 'Error fetching schedule assignments');
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleDistributeObservers = (schedule) => {
        setSelectedSchedule(schedule);
        setShowDistributionModal(true);
    };

    const handleAlgorithmSelection = async (algorithmId) => {
        try {
            const token = localStorage.getItem('authToken');
            let endpoint = '';
            let requestBody = {};
            
            // Set the appropriate endpoint based on algorithm selection
            if (algorithmId === 'random') {
                endpoint = `http://localhost:3000/api/exams/distribute/random/${selectedSchedule.scheduleId}`;
            } else if (algorithmId === 'genetic') {
                endpoint = `http://localhost:3000/api/assignments/schedules/${selectedSchedule.scheduleId}/assign-genetic`;
                // You can customize genetic algorithm parameters here if needed
                requestBody = {
                    populationSize: 50,
                    generations: 30,
                    mutationRate: 0.1,
                    crossoverRate: 0.7,
                    elitismRate: 0.1
                };
            } else if (algorithmId === 'compare') {
                endpoint = `http://localhost:3000/api/assignments/schedules/${selectedSchedule.scheduleId}/compare-algorithms`;
            }
            
            const response = await axios.post(
                endpoint, 
                requestBody, 
                {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Handle response based on algorithm type
            if (algorithmId === 'random') {
                const { assignments, totalExams, assignedExams } = response.data;
                
                alert(`Distribution Complete!\n` +
                      `Total Exams: ${totalExams}\n` +
                      `Assigned Exams: ${assignedExams}\n` +
                      `Assignments: ${assignments.map(a => 
                          `Exam ${a.examId}: Head - ${a.headObserver}, Secretary - ${a.secretary}`
                      ).join('\n')}`
                );
            } else if (algorithmId === 'genetic') {
                const { totalExams, assignedExams, failedExams, fitness, convergenceGeneration } = response.data;
                
                alert(`Genetic Algorithm Distribution Complete!\n` +
                      `Total Exams: ${totalExams}\n` +
                      `Successful Assignments: ${assignedExams}\n` +
                      `Failed Assignments: ${failedExams}\n` +
                      `Best Fitness Score: ${fitness ? fitness.toFixed(3) : 'N/A'}\n` +
                      `Converged at Generation: ${convergenceGeneration || 'N/A'}`
                );
            } else if (algorithmId === 'compare') {
                const { comparison, appliedAlgorithm, message } = response.data;
                
                // Store comparison data in localStorage for the comparison page
                localStorage.setItem('latestComparison', JSON.stringify(comparison));
                
                // Show summary and ask if user wants to see detailed comparison
                const viewDetails = window.confirm(
                    `${message}\n\n` +
                    `Winner: ${comparison.winner}\n` +
                    `Speed: ${comparison.performance.speedup}\n` +
                    `Random Score: ${comparison['Random Algorithm'].overallScore}\n` +
                    `Genetic Score: ${comparison['Genetic Algorithm'].overallScore}\n\n` +
                    `Applied: ${appliedAlgorithm} Algorithm\n\n` +
                    `Would you like to view the detailed comparison?`
                );
                
                if (viewDetails) {
                    // Navigate to comparison page
                    window.location.href = '/algorithm-comparison';
                }
            }

            // Refresh the schedules to reflect new assignments
            fetchScheduleAssignments();
        } catch (error) {
            console.error('Full Distribution Error:', error);
            
            // More detailed error message
            const errorMessage = error.response?.data?.errorMessage || 
                                 error.response?.data?.message || 
                                 'Unknown error occurred';
            
            alert(`Distribution Failed: ${errorMessage}`);
        }
        
        // Close the modal
        setShowDistributionModal(false);
    };

    const filteredSchedules = schedules.filter(schedule => 
        schedule.academicYear.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.semester.toLowerCase().includes(searchTerm.toLowerCase()) ||
        schedule.examType.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status) => {
        switch(status) {
            case 'Fully Assigned':
                return <span className="status-badge assigned"><FaCheck /> Fully Assigned</span>;
            case 'Partially Assigned':
                return <span className="status-badge partially-assigned"><FaExclamationTriangle /> Partially Assigned</span>;
            case 'Not Assigned':
                return <span className="status-badge unassigned"><FaTimes /> Not Assigned</span>;
            default:
                return <span className="status-badge">{status}</span>;
        }
    };

    if (loading) return <div className="loading">Loading schedule assignments...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="assignments-view">
            <div className="search-section">
                <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search schedules..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                    {searchTerm && (
                        <button className="clear-search" onClick={() => setSearchTerm('')}>
                            <FaTimes />
                        </button>
                    )}
                </div>
            </div>

            <div className="schedules-table-container">
                <table className="schedules-table">
                    <thead>
                        <tr>
                            <th>Academic Year</th>
                            <th>Semester</th>
                            <th>Exam Type</th>
                            <th>Upload Date</th>
                            <th>Total Exams</th>
                            <th>Assigned Exams</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSchedules.map((schedule) => (
                            <tr key={schedule.scheduleId}>
                                <td>{schedule.academicYear}</td>
                                <td>{schedule.semester}</td>
                                <td>{schedule.examType}</td>
                                <td>{new Date(schedule.uploadDate).toLocaleDateString()}</td>
                                <td>{schedule.totalExams}</td>
                                <td>{schedule.assignedExams} / {schedule.totalExams}</td>
                                <td>{getStatusBadge(schedule.assignmentStatus)}</td>
                                <td>
                                    <button 
                                        className="distribute-btn"
                                        onClick={() => handleDistributeObservers(schedule)}
                                    >
                                        <FaClipboardList /> Distribute
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showDistributionModal && selectedSchedule && (
                <DistributionOptionsModal
                    schedule={selectedSchedule}
                    onClose={() => setShowDistributionModal(false)}
                    onSelectAlgorithm={handleAlgorithmSelection}
                />
            )}
        </div>
    );
};

export default AssignmentsView; 