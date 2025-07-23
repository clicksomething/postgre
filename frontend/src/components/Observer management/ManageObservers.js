import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import './ManageObservers.scss';
import EditObserverModal from './EditObserverModal';
import CreateObserverModal from './CreateObserverModal';
import EditTimeSlotModal from './EditTimeSlotModal';
import AddTimeSlotModal from './AddTimeSlotModal';
import UploadObservers from './UploadObservers';
import { FaPlus, FaEdit, FaTrash, FaUser, FaUpload, FaCheckSquare, FaRegSquare, FaTimes } from 'react-icons/fa';
import SuccessMessage from '../SuccessMessage';
import DeleteObserverModal from './DeleteObserverModal';
import ReactModal from 'react-modal';
import DataTable from '../common/DataTable';


const ManageObservers = () => {
    const [observers, setObservers] = useState([]);
    const [filteredObservers, setFilteredObservers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingObserver, setEditingObserver] = useState(null);
    const [isCreatingObserver, setIsCreatingObserver] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [observersPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [editingTimeSlot, setEditingTimeSlot] = useState(null);
    const [isAddingTimeSlot, setIsAddingTimeSlot] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedObserverID, setSelectedObserverID] = useState(null);
    const [successMessages, setSuccessMessages] = useState([]);
    const [deletingObserver, setDeletingObserver] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedObserverIds, setSelectedObserverIds] = useState([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const handleDeleteClick = (observer) => {
        setDeletingObserver(observer);
    };

    const handleCloseDeleteModal = () => {
        setDeletingObserver(null);
    };
    const handleConfirmDelete = async (observerId) => {
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            await axios.delete(`http://localhost:3000/api/users/observers/${observerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`, // Add the Authorization header
                },
            });
            await fetchObservers();
            setSuccessMessages(['Observer deleted successfully']);
            setDeletingObserver(null);
        } catch (err) {
            console.error('Error deleting observer:', err);
            setError(err.response?.data?.message || 'Error deleting observer');
        }
    };
    // Fetch observers from the API
    const fetchObservers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            const response = await axios.get('http://localhost:3000/api/users/observers', {
                headers: {
                    Authorization: `Bearer ${token}`, // Add the Authorization header
                },
            });
            setObservers(response.data);
            setFilteredObservers(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching observers:', err);
            setError('Failed to load observers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchObservers();
    }, []);

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        const filtered = observers.filter((observer) =>
            observer.name.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredObservers(filtered);
        setCurrentPage(1);
    };

    const handleEditClick = (observer) => {
        setEditingObserver(observer);
    };

    const handleCloseEditModal = () => {
        setEditingObserver(null);
    };

    const handleSaveObserver = async (updatedObserver) => {
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            await axios.put(
                `http://localhost:3000/api/users/observers/${updatedObserver.observerID}`,
                updatedObserver,
                {
                    headers: {
                        Authorization: `Bearer ${token}`, // Add the Authorization header
                    },
                }
            );
            await fetchObservers(); // Refresh the list after updating
            setSuccessMessages(['Observer updated successfully']);
            setEditingObserver(null);
        } catch (err) {
            console.error('Error updating observer:', err);
            setError(err.response?.data?.message || 'Error updating observer');
        }
    };

    const handleAddObserverClick = () => {
        setIsCreatingObserver(true);
    };

    const handleCloseCreateModal = () => {
        setIsCreatingObserver(false);
    };

    const handleCreateObserver = async (newObserver) => {
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            const response = await axios.post('http://localhost:3000/api/users/observers', newObserver, {
                headers: {
                    Authorization: `Bearer ${token}`, // Add the Authorization header
                },
            });
            await fetchObservers(); // Refresh the list after creating
            setSuccessMessages(['Observer created successfully']);
            setIsCreatingObserver(false);
        } catch (err) {
            console.error('Error creating observer:', err);
            setError(err.response?.data?.message || 'Error creating observer');
        }
    };
     const handleCloseMessage = (index) => {
        setSuccessMessages(prevMessages => prevMessages.filter((_, i) => i !== index));
    };

    const handleEditTimeSlot = (timeSlot, observerID) => { // Add observerID parameter
        const updatedTimeSlot = {
            ...timeSlot,
            observerID: observerID // Use lowercase
        };
        console.log("Editing timeSlot:", updatedTimeSlot);
        setEditingTimeSlot(updatedTimeSlot);
    };

    const handleSaveTimeSlot = async (updatedTimeSlot) => {
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            await axios.put(
                `http://localhost:3000/api/timeslots/${updatedTimeSlot.timeSlotID}`,
                updatedTimeSlot,
                {
                    headers: {
                        Authorization: `Bearer ${token}`, // Add the Authorization header
                    },
                }
            );
            await fetchObservers(); // Refresh the list after updating timeslot
            setSuccessMessages(['Time slot updated successfully']);
            setEditingTimeSlot(null);
        } catch (err) {
            console.error('Error updating time slot:', err);
            setError(err.response?.data?.message || 'Error updating time slot');
        }
    };

    const handleDeleteTimeSlot = async (timeSlotID) => {
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            await axios.delete(`http://localhost:3000/api/timeslots/${timeSlotID}`, {
                headers: {
                    Authorization: `Bearer ${token}`, // Add the Authorization header
                },
            });
            await fetchObservers(); // Refresh the list after deletion
            setSuccessMessages(['Time slot deleted successfully']);
            setEditingTimeSlot(null);
        } catch (err) {
            console.error('Error deleting time slot:', err);
            setError(err.response?.data?.message || 'Error deleting time slot');
        }
    };

    const handleAddTimeSlotClick = (observerID, day) => {
        // Get the observer from the current observers state
        const observer = observers.find(obs => obs.observerID === observerID);
        
        if (observer.availability === 'full-time') {
            // Show error message (you might want to use a toast or alert system)
            setError('Cannot add time slots for full-time observers');
            return;
        }

        setSelectedObserverID(observerID);
        setSelectedDay(day);
        setIsAddingTimeSlot(true);
    };

    const handleCloseAddTimeSlotModal = () => {
        setIsAddingTimeSlot(false);
    };

    const handleSaveNewTimeSlot = async (newTimeSlot) => {
        try {
            const token = localStorage.getItem('authToken'); // Get the token from localStorage
            await axios.post('http://localhost:3000/api/timeslots', {
                ...newTimeSlot,
                observerID: selectedObserverID,
                day: selectedDay,
            }, {
                headers: {
                    Authorization: `Bearer ${token}`, // Add the Authorization header
                },
            });
            await fetchObservers(); // Refresh the list after creating timeslot
            setSuccessMessages(['Time slot created successfully']);
            setIsAddingTimeSlot(false);
        } catch (err) {
            console.error('Error creating time slot:', err);
            setError(err.response?.data?.message || 'Error creating time slot');
        }
    };
    const handleCloseEditTimeSlotModal = () => {
        setEditingTimeSlot(null);
    };

    const handleUploadClick = () => {
        setIsUploading(true);
    };

    const handleCloseUploadModal = () => {
        setIsUploading(false);
    };

    const handleUploadSuccess = async (data) => {
        await fetchObservers();
        
        // Handle multi-file upload response
        const messages = [];
        if (data.summary) {
            const { totalFiles, filesSuccessful, filesFailed, totalObserversCreated, totalObserversSkipped } = data.summary;
            
            if (totalObserversCreated > 0) {
                messages.push(`${totalObserversCreated} observers created successfully`);
            }
            if (totalObserversSkipped > 0) {
                messages.push(`${totalObserversSkipped} observers skipped (already exist)`);
            }
            if (filesSuccessful > 0) {
                messages.push(`${filesSuccessful} of ${totalFiles} files processed successfully`);
            }
            if (filesFailed > 0) {
                messages.push(`${filesFailed} files failed to process`);
            }
        } else {
            messages.push('Observers uploaded successfully');
        }
        
        setSuccessMessages(messages);
        setIsUploading(false);
    };

    const handleSelectObserver = (observerId) => {
        setSelectedObserverIds((prev) =>
            prev.includes(observerId)
                ? prev.filter((id) => id !== observerId)
                : [...prev, observerId]
        );
    };

    const handleSelectAll = () => {
        if (selectedObserverIds.length === sortedObservers.length) {
            setSelectedObserverIds([]);
        } else {
            setSelectedObserverIds(sortedObservers.map((o) => o.observerID));
        }
    };

    const handleBulkDeleteClick = () => {
        setShowBulkDeleteModal(true);
    };

    const handleCloseBulkDeleteModal = () => {
        setShowBulkDeleteModal(false);
    };

    const handleConfirmBulkDelete = async () => {
        try {
            const token = localStorage.getItem('authToken');
            await axios.post('http://localhost:3000/api/users/observers/bulk-delete', {
                observerIds: selectedObserverIds
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            await fetchObservers();
            setSuccessMessages(['Selected observers deleted successfully']);
            setSelectedObserverIds([]);
            setShowBulkDeleteModal(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Error deleting selected observers');
            setShowBulkDeleteModal(false);
        }
    };

    const sortedObservers = useMemo(() => {
        let sortableObservers = [...filteredObservers];
        if (sortConfig.key !== null) {
            sortableObservers.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableObservers;
    }, [filteredObservers, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };



    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const renderTimeSlotCell = (observer, day) => (
        <div
            className={`time-slot-cell ${
                observer.availability === "full-time" ? "full-time" : ""
            }`}
        >
            {observer.availability === "full-time" ? (
                <span>—</span>
            ) : (
                <>
                    {observer.timeslots &&
                        observer.timeslots
                            .filter((ts) => ts.day === day)
                            .map((timeSlot) => (
                                <div key={timeSlot.timeSlotID} className="time-slot">
                                    <span>
                                        {timeSlot.startTime
                                            ? timeSlot.startTime.slice(0, 5)
                                            : "--:--"}
                                        -
                                        {timeSlot.endTime
                                            ? timeSlot.endTime.slice(0, 5)
                                            : "--:--"}
                                    </span>
                                    <div className="time-slot-actions">
                                        <button
                                            className="edit-time-slot-button"
                                            onClick={() =>
                                                handleEditTimeSlot(timeSlot, observer.observerID)
                                            }
                                            data-tooltip-id="main-tooltip"
                                            data-tooltip-content="Edit time slot"
                                        >
                                            <FaEdit />
                                        </button>
                                    </div>
                                </div>
                            ))}
                    <button
                        className="add-time-slot-button"
                        onClick={() =>
                            handleAddTimeSlotClick(observer.observerID, day)
                        }
                        data-tooltip-id="main-tooltip"
                        data-tooltip-content="Add time slot"
                    >
                        <FaPlus />
                    </button>
                </>
            )}
        </div>
    );

    const columns = [
        {
            key: 'select',
            label: (
                <input
                    type="checkbox"
                    checked={selectedObserverIds.length === sortedObservers.length && sortedObservers.length > 0}
                    onChange={handleSelectAll}
                    aria-label="Select all observers"
                />
            ),
            sortable: false,
            render: (observer) => (
                <input
                    type="checkbox"
                    checked={selectedObserverIds.includes(observer.observerID)}
                    onChange={() => handleSelectObserver(observer.observerID)}
                    aria-label={`Select observer ${observer.name}`}
                />
            ),
        },
        {
            key: 'title',
            label: 'Title',
            sortable: true
        },
        {
            key: 'name',
            label: 'Name',
            sortable: true
        },
        {
            key: 'scientificRank',
            label: 'Scientific Rank',
            sortable: true
        },
        {
            key: 'fatherName',
            label: "Father's Name",
            sortable: true
        },
        {
            key: 'availability',
            label: 'Availability',
            sortable: true,
            render: (observer) => (
                observer.availability === "part-time" ? "Part time" : "Full time"
            )
        },
        ...daysOfWeek.map(day => ({
            key: day.toLowerCase(),
            label: day,
            sortable: false,
            render: (observer) => renderTimeSlotCell(observer, day)
        })),
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (observer) => (
                <>
                    <button
                        className="edit-button"
                        onClick={() => handleEditClick(observer)}
                        data-tooltip-id="main-tooltip"
                        data-tooltip-content="Edit observer"
                    >
                        <FaEdit /> Edit
                    </button>
                    <button
                        className="delete-button"
                        onClick={() => handleDeleteClick(observer)}
                        data-tooltip-id="main-tooltip"
                        data-tooltip-content="Delete observer"
                    >
                        <FaTrash /> Delete
                    </button>
                </>
            )
        }
    ];

    const actionButtons = [
        {
            icon: <FaTrash />,
            text: '',
            className: 'bulk-delete-button',
            tooltip: 'Delete selected observers',
            onClick: handleBulkDeleteClick,
            disabled: selectedObserverIds.length === 0,
        },
        {
            icon: <FaPlus />,
            text: '',
            className: 'create-button',
            tooltip: 'Add new observer',
            onClick: handleAddObserverClick
        },
        {
            icon: <FaUpload />,
            text: '',
            className: 'upload-button',
            tooltip: 'Upload observers',
            onClick: handleUploadClick
        }
    ];

    return (
        <div className="manage-observers-page-wrapper">
            <h1>Manage Observers</h1>
            {selectedObserverIds.length > 0 && (
                <button
                    className="bulk-delete-button"
                    onClick={handleBulkDeleteClick}
                    disabled={selectedObserverIds.length === 0}
                >
                    <FaTrash /> Delete Selected ({selectedObserverIds.length})
                </button>
            )}
            <DataTable
                data={sortedObservers}
                columns={columns}
                loading={loading}
                error={error}
                searchTerm={searchTerm}
                onSearchChange={handleSearch}
                onClearSearch={() => setSearchTerm("")}
                searchPlaceholder="Search by name..."
                emptyStateMessage="No observers found."
                emptyStateIcon={FaUser}
                itemsPerPage={observersPerPage}
                currentPage={currentPage}
                onPageChange={paginate}
                sortConfig={sortConfig}
                onSort={requestSort}
                actionButtons={actionButtons}
                containerClassName="manage-observers-page-wrapper"
                className="observer-table-container"
                tableClassName="observer-table"
            />

            {editingObserver && (
                <EditObserverModal
                    observer={editingObserver}
                    onClose={handleCloseEditModal}
                    onSave={handleSaveObserver}
                />
            )}
            {deletingObserver && (
                <DeleteObserverModal
                    observer={deletingObserver}
                    onClose={handleCloseDeleteModal}
                    onConfirm={handleConfirmDelete}
                />
            )}
            {isCreatingObserver && (
                <CreateObserverModal
                    onClose={handleCloseCreateModal}
                    onCreate={handleCreateObserver}
                />
            )}
            {editingTimeSlot && (
                <EditTimeSlotModal
                    timeSlot={editingTimeSlot}
                    onClose={handleCloseEditTimeSlotModal}
                    onSave={handleSaveTimeSlot}
                    onDelete={handleDeleteTimeSlot}
                />
            )}
            {isAddingTimeSlot && (
                <AddTimeSlotModal
                    observerID={selectedObserverID}
                    day={selectedDay}
                    onClose={handleCloseAddTimeSlotModal}
                    onSave={handleSaveNewTimeSlot}
                />
            )}
            {isUploading && (
                <UploadObservers
                    onClose={handleCloseUploadModal}
                    onUploadSuccess={handleUploadSuccess}
                />
            )}
            <SuccessMessage
                messages={successMessages}
                onClose={handleCloseMessage}
            />

            {/* Bulk Delete Modal */}
            <ReactModal
                isOpen={showBulkDeleteModal}
                onRequestClose={handleCloseBulkDeleteModal}
                contentLabel="Confirm Bulk Delete"
                className="delete-observer-modal"
                overlayClassName="modal-overlay"
                ariaHideApp={false}
            >
                <div className="modal-content">
                    <h2>Delete Selected Observers</h2>
                    <div className="confirmation-text">
                        <p>Are you sure you want to delete the selected {selectedObserverIds.length} observers?</p>
                        <p className="warning">This action cannot be undone.</p>
                    </div>
                    <div className="buttons">
                        <button type="button" className="button secondary" onClick={handleCloseBulkDeleteModal}>
                            <FaTimes /> Cancel
                        </button>
                        <button type="button" className="button danger" onClick={handleConfirmBulkDelete}>
                            <FaTrash /> Delete
                        </button>
                    </div>
                </div>
            </ReactModal>
        </div>
    );
};



export default ManageObservers;