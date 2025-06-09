import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import './ManageObservers.scss';
import EditObserverModal from './EditObserverModal';
import CreateObserverModal from './CreateObserverModal';
import EditTimeSlotModal from './EditTimeSlotModal';
import AddTimeSlotModal from './AddTimeSlotModal';
import UploadObservers from './UploadObservers';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaSpinner, FaUser, FaUpload } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import SuccessMessage from '../SuccessMessage';
import DeleteObserverModal from './DeleteObserverModal';
const ClientOnlyTooltip = () => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <Tooltip
            id="main-tooltip"
            style={{
                zIndex: 9999,
                backgroundColor: '#2d3748',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '14px',
            }}
        />
    );
};

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
    const handleDeleteClick = (observer) => {
        setDeletingObserver(observer);
    };

    const handleCloseDeleteModal = () => {
        setDeletingObserver(null);
    };
    const handleConfirmDelete = async (observerId) => {
        try {
            await axios.delete(`http://localhost:3000/api/observers/${observerId}`);
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
            const response = await axios.get('http://localhost:3000/api/observers');
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
            await axios.put(
                `http://localhost:3000/api/observers/${updatedObserver.observerID}`,
                updatedObserver
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
            const response = await axios.post('http://localhost:3000/api/observers', newObserver);
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
            await axios.put(
                `http://localhost:3000/api/timeslots/${updatedTimeSlot.timeSlotID}`,
                updatedTimeSlot
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
            await axios.delete(`http://localhost:3000/api/timeslots/${timeSlotID}`);
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
            await axios.post('http://localhost:3000/api/timeslots', {
                ...newTimeSlot,
                observerID: selectedObserverID,
                day: selectedDay,
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
        setSuccessMessages(['Observers uploaded successfully']);
        setIsUploading(false);
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

    // Pagination
    const indexOfLastObserver = currentPage * observersPerPage;
    const indexOfFirstObserver = indexOfLastObserver - observersPerPage;
    const currentObservers = sortedObservers.slice(indexOfFirstObserver, indexOfLastObserver);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    if (loading) {
        return (
            <div className="loading-spinner">
                <FaSpinner className="spinner-icon" />
                <span>Loading observers...</span>
            </div>
        );
    }

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
        <div className="manage-observers-container">
            <ClientOnlyTooltip />
            <h1>Manage Observers</h1>
            <div className="search-bar">
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
                {searchTerm && (
                    <button className="clear-search" onClick={() => setSearchTerm("")}>
                        &times;
                    </button>
                )}
            </div>
            {currentObservers.length === 0 ? (
                <div className="empty-state">
                    <FaUser className="empty-icon" />
                    <p>No observers found.</p>
                </div>
            ) : (
                <div className="observer-table-container">
                    <table className="observer-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort("title")}>
                                    Title{" "}
                                    {sortConfig.key === "title" &&
                                        (sortConfig.direction === "ascending" ? "▲" : "▼")}
                                </th>
                                <th onClick={() => requestSort("name")}>
                                    Name{" "}
                                    {sortConfig.key === "name" &&
                                        (sortConfig.direction === "ascending" ? "▲" : "▼")}
                                </th>
                                <th onClick={() => requestSort("scientificRank")}>
                                    Scientific Rank{" "}
                                    {sortConfig.key === "scientificRank" &&
                                        (sortConfig.direction === "ascending" ? "▲" : "▼")}
                                </th>
                                <th onClick={() => requestSort("fatherName")}>
                                    Father's Name
                                </th>
                                <th onClick={() => requestSort("availability")}>
                                    Availability
                                </th>
                                {daysOfWeek.map((day) => (
                                    <th key={day}>{day}</th>
                                ))}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentObservers.map((observer) => (
                                <tr key={observer.observerID}>
                                    <td>{observer.title}</td>
                                    <td>{observer.name}</td>
                                    <td>{observer.scientificRank}</td>
                                    <td>{observer.fatherName}</td>
                                    <td>
                                        {observer.availability === "part-time"
                                            ? "Part time"
                                            : "Full time"}
                                    </td>
                                    {daysOfWeek.map((day) => (
                                        <td
                                            key={day}
                                            className={`time-slot-cell ${
                                                observer.availability === "full-time"
                                                    ? "full-time"
                                                    : ""
                                            }`}
                                        >
                                            {observer.availability === "full-time" ? (
                                                <span>—</span> // Simple dash to indicate unavailable
                                            ) : (
                                                <>
                                                    {observer.timeslots &&
                                                        observer.timeslots
                                                            .filter((ts) => ts.day === day)
                                                            .map((timeSlot) => (
                                                                <div
                                                                    key={timeSlot.timeSlotID}
                                                                    className="time-slot"
                                                                >
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
                                                                                handleEditTimeSlot(
                                                                                    timeSlot,
                                                                                    observer.observerID
                                                                                )
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
                                        </td>
                                    ))}
                                    <td>
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination
                observersPerPage={observersPerPage}
                totalObservers={sortedObservers.length}
                paginate={paginate}
                currentPage={currentPage}
            />

            <div className="action-buttons">
                <button
                    className="create-button"
                    onClick={handleAddObserverClick}
                    data-tooltip-id="main-tooltip"
                    data-tooltip-content="Add new observer"
                >
                    <FaPlus />
                </button>
                <button
                    className="upload-button"
                    onClick={handleUploadClick}
                    data-tooltip-id="main-tooltip"
                    data-tooltip-content="Upload observers"
                >
                    <FaUpload />
                </button>
            </div>

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
        </div>
    );
};

const Pagination = ({ observersPerPage, totalObservers, paginate, currentPage }) => {
    const pageNumbers = [];

    for (let i = 1; i <= Math.ceil(totalObservers / observersPerPage); i++) {
        pageNumbers.push(i);
    }

    return (
        <nav>
            <ul className="pagination">
                {pageNumbers.map((number) => (
                    <li
                        key={number}
                        className={`page-item ${currentPage === number ? 'active' : ''}`}
                    >
                        <button onClick={() => paginate(number)} className="page-link">
                            {number}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default ManageObservers;