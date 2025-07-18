import React, { useState, useEffect } from 'react';
import { FaTimes, FaCheck, FaExclamationTriangle, FaClipboardList } from 'react-icons/fa';
import axios from 'axios';
import DistributionOptionsModal from './Modals/DistributionOptionsModal';
import './AssignmentsView.scss';
import DataTable from '../common/DataTable';

const AssignmentsView = () => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [showDistributionModal, setShowDistributionModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [schedulesPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    


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

    const handleAlgorithmSelection = async (algorithmId, customParams = null) => {
        try {
            const token = localStorage.getItem('authToken');
            let endpoint = '';
            let requestBody = {};
            
            // Set the appropriate endpoint based on algorithm selection
            if (algorithmId === 'random') {
                endpoint = `http://localhost:3000/api/exams/distribute/random/${selectedSchedule.scheduleId}`;
            } else if (algorithmId === 'genetic') {
                endpoint = `http://localhost:3000/api/assignments/schedules/${selectedSchedule.scheduleId}/assign-genetic`;
                // Use custom parameters if provided, otherwise use defaults
                requestBody = customParams || {
                    populationSize: 200,
                    generations: 100,
                    mutationRate: 0.2,
                    crossoverRate: 0.8,
                    elitismRate: 0.15,
                    useDeterministicInit: true
                };
                
                console.log('[Frontend] Sending genetic algorithm parameters:', requestBody);
                

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
                // Show initial message that algorithm has started
                alert('Genetic algorithm has started running in the background. This may take a few minutes. You will be notified when it completes.');
                
                // Poll for completion status
                const pollForCompletion = async () => {
                    try {
                        // Wait a bit before first check
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Check if assignments have been updated
                        const updatedSchedules = await axios.get('http://localhost:3000/api/exams/schedule-assignments', {
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        // Find the current schedule
                        const currentSchedule = updatedSchedules.data.find(s => s.scheduleId === selectedSchedule.scheduleId);
                        
                        if (currentSchedule && currentSchedule.assignedExams > 0) {
                            // Algorithm has completed and applied results
                            alert(`Genetic Algorithm Distribution Complete!\n` +
                                  `Total Exams: ${currentSchedule.totalExams}\n` +
                                  `Successful Assignments: ${currentSchedule.assignedExams}\n` +
                                  `Failed Assignments: ${currentSchedule.totalExams - currentSchedule.assignedExams}\n` +
                                  `Status: ${currentSchedule.assignmentStatus}`
                            );
                            
                            // Refresh the data
                            fetchScheduleAssignments();
                            return;
                        }
                        
                        // If not complete, poll again in 3 seconds
                        setTimeout(pollForCompletion, 3000);
                    } catch (error) {
                        console.error('Error polling for completion:', error);
                        alert('Error checking algorithm completion status. Please refresh the page to see results.');
                    }
                };
                
                // Start polling
                pollForCompletion();
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

    const getFilteredAndSortedSchedules = () => {
        let filteredSchedules = schedules.filter(schedule => 
            schedule.academicYear.toLowerCase().includes(searchTerm.toLowerCase()) ||
            schedule.semester.toLowerCase().includes(searchTerm.toLowerCase()) ||
            schedule.examType.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Apply sorting
        if (sortConfig.key !== null) {
            filteredSchedules.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'uploadDate') {
                    aValue = new Date(a.uploadDate);
                    bValue = new Date(b.uploadDate);
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }

        return filteredSchedules;
    };

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

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page when sorting
    };

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const columns = [
        {
            key: 'academicYear',
            label: 'Academic Year',
            sortable: true
        },
        {
            key: 'semester',
            label: 'Semester',
            sortable: true
        },
        {
            key: 'examType',
            label: 'Exam Type',
            sortable: true
        },
        {
            key: 'uploadDate',
            label: 'Upload Date',
            sortable: true,
            render: (schedule) => new Date(schedule.uploadDate).toLocaleDateString()
        },
        {
            key: 'totalExams',
            label: 'Total Exams',
            sortable: true
        },
        {
            key: 'assignedExams',
            label: 'Assigned Exams',
            sortable: true,
            render: (schedule) => `${schedule.assignedExams} / ${schedule.totalExams}`
        },
        {
            key: 'assignmentStatus',
            label: 'Status',
            sortable: true,
            render: (schedule) => getStatusBadge(schedule.assignmentStatus)
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (schedule) => (
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                    <button 
                        className="distribute-btn"
                        style={{ display: 'inline-block' }}
                        onClick={() => handleDistributeObservers(schedule)}
                    >
                        <FaClipboardList /> Distribute
                    </button>
                </span>
            )
        }
    ];

    if (loading) return <div className="loading">Loading schedule assignments...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="assignments-view">
            <DataTable
                title="Manage Assignments"
                data={getFilteredAndSortedSchedules()}
                columns={columns}
                loading={loading}
                error={error}
                searchTerm={searchTerm}
                onSearchChange={handleSearch}
                onClearSearch={() => setSearchTerm('')}
                searchPlaceholder="Search schedules..."
                emptyStateMessage="No schedules found."
                itemsPerPage={schedulesPerPage}
                currentPage={currentPage}
                onPageChange={paginate}
                sortConfig={sortConfig}
                onSort={requestSort}
                containerClassName="assignments-view"
                className="schedules-table-container"
                tableClassName="schedules-table"
            />



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