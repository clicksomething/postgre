import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import './ManageObservers.scss';
import EditObserverModal from './EditObserverModal';
import CreateObserverModal from './CreateObserverModal';
import EditTimeSlotModal from './EditTimeSlotModal'; // Import the new component
import { FaSearch, FaPlus, FaEdit, FaSpinner, FaUser } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

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

    useEffect(() => {
        const fetchObservers = async () => {
            try {
                const response = await axios.get('http://localhost:3000/api/observers');
                setObservers(response.data);
                setFilteredObservers(response.data);
            } catch (err) {
                console.error('Error fetching observers:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

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
            setObservers((prevObservers) =>
                prevObservers.map((observer) =>
                    observer.observerID === updatedObserver.observerID ? updatedObserver : observer
                )
            );
            setFilteredObservers((prevFilteredObservers) =>
                prevFilteredObservers.map((observer) =>
                    observer.observerID === updatedObserver.observerID ? updatedObserver : observer
                )
            );

            console.log('Observer updated successfully');
        } catch (err) {
            console.error('Error updating observer:', err);
            setError(err.message);
        } finally {
            handleCloseEditModal();
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
            setObservers((prevObservers) => [...prevObservers, response.data]);
            setFilteredObservers((prevFilteredObservers) => [...prevFilteredObservers, response.data]);

            console.log('Observer created successfully');
        } catch (err) {
            console.error('Error creating observer:', err);
            setError(err.message);
        } finally {
            handleCloseCreateModal();
        }
    };

    const handleEditTimeSlot = (timeSlot) => {
        console.log("Editing timeSlot:", timeSlot);  // Log the timeSlot
        setEditingTimeSlot(timeSlot);
    };

    const handleSaveTimeSlot = async (updatedTimeSlot) => {
        try {
            console.log("Saving timeSlot:", updatedTimeSlot);  // Log the updatedTimeSlot
            await axios.put(`http://localhost:3000/api/timeslots/${updatedTimeSlot.TimeSlotID}`, updatedTimeSlot);
            setObservers((prevObservers) =>
                prevObservers.map((observer) => ({
                    ...observer,
                    timeslots: observer.timeslots.map((ts) =>
                        ts.TimeSlotID === updatedTimeSlot.TimeSlotID ? updatedTimeSlot : ts
                    ),
                }))
            );
            setFilteredObservers((prevFilteredObservers) =>
                prevFilteredObservers.map((observer) => ({
                    ...observer,
                    timeslots: observer.timeslots.map((ts) =>
                        ts.TimeSlotID === updatedTimeSlot.TimeSlotID ? updatedTimeSlot : ts
                    ),
                }))
            );
            console.log('Time slot updated successfully');
        } catch (err) {
            console.error('Error updating time slot:', err);
            setError(err.message);
        } finally {
            handleCloseEditTimeSlotModal();
        }
    };

    const handleDeleteTimeSlot = async (timeSlotID) => {
        try {
            console.log("Deleting timeSlot with ID:", timeSlotID);  // Log the timeSlotID
            await axios.delete(`http://localhost:3000/api/timeslots/${timeSlotID}`);
            setObservers((prevObservers) =>
                prevObservers.map((observer) => ({
                    ...observer,
                    timeslots: observer.timeslots.filter((ts) => ts.TimeSlotID !== timeSlotID),
                }))
            );
            setFilteredObservers((prevFilteredObservers) =>
                prevFilteredObservers.map((observer) => ({
                    ...observer,
                    timeslots: observer.timeslots.filter((ts) => ts.TimeSlotID !== timeSlotID),
                }))
            );
            console.log('Time slot deleted successfully');
        } catch (err) {
            console.error('Error deleting time slot:', err);
            setError(err.message);
        } finally {
            handleCloseEditTimeSlotModal();
        }
    };
    const handleAddTimeSlot = async (newTimeSlot) => {
        try {
            const response = await axios.post('http://localhost:3000/api/timeslots', newTimeSlot);
            setObservers((prevObservers) =>
                prevObservers.map((observer) =>
                    observer.ObserverID === newTimeSlot.ObserverID
                        ? { ...observer, timeslots: [...(observer.timeslots || []), response.data] }
                        : observer
                )
            );
            setFilteredObservers((prevFilteredObservers) =>
                prevFilteredObservers.map((observer) =>
                    observer.ObserverID === newTimeSlot.ObserverID
                        ? { ...observer, timeslots: [...(observer.timeslots || []), response.data] }
                        : observer
                )
            );
            console.log('Time slot created successfully');
        } catch (err) {
            console.error('Error creating time slot:', err);
            setError(err.message);
        }
    };

    const handleCloseEditTimeSlotModal = () => {
        setEditingTimeSlot(null);
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
                    <button className="clear-search" onClick={() => setSearchTerm('')}>
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
                                <th onClick={() => requestSort('title')}>
                                    Title{' '}
                                    {sortConfig.key === 'title' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('name')}>
                                    Name{' '}
                                    {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('scientificRank')}>
                                    Scientific Rank{' '}
                                    {sortConfig.key === 'scientificRank' && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
                                </th>
                                <th onClick={() => requestSort('fatherName')}>Father's Name</th>
                                <th onClick={() => requestSort('availability')}>Availability</th>
                                <th>Monday</th>
                                <th>Tuesday</th>
                                <th>Wednesday</th>
                                <th>Thursday</th>
                                <th>Friday</th>
                                <th>Saturday</th>
                                <th>Sunday</th>
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
                                    <td>{observer.availability === "part-time" ? "Part time" : "Full time"}</td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Monday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                    <button
                                                        className="edit-time-slot-button"
                                                        onClick={() => handleEditTimeSlot(timeSlot)}
                                                        data-tooltip-id="main-tooltip"
                                                        data-tooltip-content="Edit time slot"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Tuesday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                    <button
                                                        className="edit-time-slot-button"
                                                        onClick={() => handleEditTimeSlot(timeSlot)}
                                                        data-tooltip-id="main-tooltip"
                                                        data-tooltip-content="Edit time slot"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Wednesday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                        <button
                                                            className="edit-time-slot-button"
                                                            onClick={() => handleEditTimeSlot(timeSlot)}
                                                            data-tooltip-id="main-tooltip"
                                                            data-tooltip-content="Edit time slot"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Thursday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                        <button
                                                            className="edit-time-slot-button"
                                                            onClick={() => handleEditTimeSlot(timeSlot)}
                                                            data-tooltip-id="main-tooltip"
                                                            data-tooltip-content="Edit time slot"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Friday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                        <button
                                                            className="edit-time-slot-button"
                                                            onClick={() => handleEditTimeSlot(timeSlot)}
                                                            data-tooltip-id="main-tooltip"
                                                            data-tooltip-content="Edit time slot"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Saturday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                        <button
                                                            className="edit-time-slot-button"
                                                            onClick={() => handleEditTimeSlot(timeSlot)}
                                                            data-tooltip-id="main-tooltip"
                                                            data-tooltip-content="Edit time slot"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td className="time-slot-cell">
                                        {observer.timeslots && observer.timeslots
                                            .filter(ts => ts.day === 'Sunday')
                                            .map(timeSlot => (
                                                <div key={timeSlot.TimeSlotID} className="time-slot">
                                                    <span>{timeSlot.startTime ? timeSlot.startTime.slice(0, 5) : '--:--'}-{timeSlot.endTime ? timeSlot.endTime.slice(0, 5) : '--:--'}</span>
                                                    <button
                                                        className="edit-time-slot-button"
                                                        onClick={() => handleEditTimeSlot(timeSlot)}
                                                        data-tooltip-id="main-tooltip"
                                                        data-tooltip-content="Edit time slot"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                </div>
                                            ))}
                                    </td>
                                    <td>
                                        <button
                                            className="edit-button"
                                            onClick={() => handleEditClick(observer)}
                                            data-tooltip-id="main-tooltip"
                                            data-tooltip-content="Edit observer"
                                        >
                                            <FaEdit /> Edit
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

            <button
                className="create-button"
                onClick={handleAddObserverClick}
                data-tooltip-id="main-tooltip"
                data-tooltip-content="Add new observer"
            >
                <FaPlus />
            </button>

            {editingObserver && (
                <EditObserverModal
                    observer={editingObserver}
                    onClose={handleCloseEditModal}
                    onSave={handleSaveObserver}
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
