import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FaEdit, FaTrash, FaEye } from 'react-icons/fa';
import EditScheduleModal from './Modals/EditScheduleModal';
import './ViewSchedules.scss';
import { useNavigate } from 'react-router-dom';
import DataTable from '../common/DataTable';
import DeleteScheduleModal from './Modals/DeleteScheduleModal';

const ViewSchedules = ({ onScheduleSelect }) => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [schedulesPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const navigate = useNavigate();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState(null);
    
    
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

    const handleDelete = (scheduleId) => {
        setScheduleToDelete(scheduleId);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Not authorized');
            }
            await axios.delete(`http://localhost:3000/api/exams/schedules/${scheduleToDelete}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            await fetchSchedules();
            setShowDeleteModal(false);
            setScheduleToDelete(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Error deleting schedule');
            setShowDeleteModal(false);
            setScheduleToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setScheduleToDelete(null);
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

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page when sorting
    };

    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    
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

        // Apply sorting
        if (sortConfig.key !== null) {
            filteredExams.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortConfig.key) {
                    case 'fileName':
                        aValue = a.scheduleInfo?.fileName || a.filename || '';
                        bValue = b.scheduleInfo?.fileName || b.filename || '';
                        break;
                    case 'academicYear':
                        aValue = a.scheduleInfo?.academicYear || a.academicyear || 0;
                        bValue = b.scheduleInfo?.academicYear || b.academicyear || 0;
                        break;
                    case 'semester':
                        aValue = a.scheduleInfo?.semester || a.semester || '';
                        bValue = b.scheduleInfo?.semester || b.semester || '';
                        break;
                    case 'examType':
                        aValue = a.scheduleInfo?.examType || a.examtype || '';
                        bValue = b.scheduleInfo?.examType || b.examtype || '';
                        break;
                    case 'status':
                        aValue = a.scheduleInfo?.status || a.status || '';
                        bValue = b.scheduleInfo?.status || b.status || '';
                        break;
                    case 'uploadDate':
                        // Simple string comparison - backend should provide consistent date format
                        aValue = a.scheduleInfo?.uploadedAt || a.uploadedat || '';
                        bValue = b.scheduleInfo?.uploadedAt || b.uploadedat || '';
                        break;
                    default:
                        aValue = a[sortConfig.key] || '';
                        bValue = b[sortConfig.key] || '';
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

        return filteredExams;
    }, [schedules, searchTerm, sortConfig]);

    const columns = [
        {
            key: 'fileName',
            label: 'File Name',
            sortable: true,
            render: (schedule) => schedule.scheduleInfo?.fileName || schedule.filename
        },
        {
            key: 'academicYear',
            label: 'Academic Year',
            sortable: true,
            render: (schedule) => schedule.scheduleInfo?.academicYear || schedule.academicyear
        },
        {
            key: 'semester',
            label: 'Semester',
            sortable: true,
            render: (schedule) => schedule.scheduleInfo?.semester || schedule.semester
        },
        {
            key: 'examType',
            label: 'Exam Type',
            sortable: true,
            render: (schedule) => schedule.scheduleInfo?.examType || schedule.examtype
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (schedule) => (
                <span className={`status-badge ${schedule.scheduleInfo?.status || schedule.status}`}>
                    {schedule.scheduleInfo?.status || schedule.status}
                </span>
            )
        },
        {
            key: 'uploadDate',
            label: 'Upload Date',
            sortable: true,
            render: (schedule) => schedule.scheduleInfo?.uploadedAt || schedule.uploadedat || 'N/A'
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (schedule) => (
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                    <button 
                        className="view-button"
                        style={{ display: 'inline-block', marginRight: '8px' }}
                        onClick={() => handleViewDetails(schedule.scheduleInfo?.uploadId || schedule.uploadid)}
                    >
                        <FaEye /> View
                    </button>
                    <button 
                        className="edit-button"
                        style={{ display: 'inline-block', marginRight: '8px' }}
                        onClick={() => handleEdit(schedule)}
                    >
                        <FaEdit /> Edit
                    </button>

                    <button 
                        className="delete-button"
                        style={{ display: 'inline-block' }}
                        onClick={() => handleDelete(schedule.scheduleInfo?.uploadId || schedule.uploadid)}
                    >
                        <FaTrash /> Delete
                    </button>
                </span>
            )
        }
    ];

    return (
        <div className="view-schedules">
            <DataTable
                title="View Schedules"
                data={getFilteredAndSortedExams}
                columns={columns}
                loading={loading}
                error={error}
                searchTerm={searchTerm}
                onSearchChange={(e) => setSearchTerm(e.target.value)}
                onClearSearch={() => setSearchTerm("")}
                searchPlaceholder="Search schedules..."
                emptyStateMessage="No schedules found."
                itemsPerPage={schedulesPerPage}
                currentPage={currentPage}
                onPageChange={paginate}
                sortConfig={sortConfig}
                onSort={requestSort}
                containerClassName="view-schedules"
                className="schedule-table-container"
                tableClassName="schedule-table"
            />

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
            {showDeleteModal && (
                <DeleteScheduleModal
                    onConfirm={confirmDelete}
                    onCancel={cancelDelete}
                />
            )}


        </div>
    );
};

export default ViewSchedules;