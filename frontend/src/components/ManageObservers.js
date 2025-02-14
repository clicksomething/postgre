import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ManageObservers.scss';
import EditObserverModal from './EditObserverModal'; // Import the EditObserverModal component
import CreateObserverModal from './CreateObserverModal';
import Navbar from './Navbar'; // Import the Navbar component

const ManageObservers = () => {
    const [observers, setObservers] = useState([]);
    const [filteredObservers, setFilteredObservers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingObserver, setEditingObserver] = useState(null);
    const [isCreatingObserver, setIsCreatingObserver] = useState(false); // State to control create modal

    useEffect(() => {
        const fetchObservers = async () => {
            try {
                const response = await axios.get('http://localhost:3000/api/observers');
                setObservers(response.data);
                setFilteredObservers(response.data);
            } catch (err) {
                console.error("Error fetching observers:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchObservers();
    }, []);

    // Handle search input change
    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        const filtered = observers.filter(observer =>
            observer.name.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredObservers(filtered);
    };

    // Handle edit button click
    const handleEditClick = (observer) => {
        setEditingObserver(observer);
    };

    // Handle closing the edit modal
    const handleCloseEditModal = () => {
        setEditingObserver(null);
    };

    // Handle saving the edited observer data
    const handleSaveObserver = async (updatedObserver) => {
        try {
            // Send the updated data to the server
            await axios.put(`http://localhost:3000/api/observers/${updatedObserver.observerID}`, updatedObserver);

            // Update the observers list with the new data
            setObservers(prevObservers =>
                prevObservers.map(observer =>
                    observer.observerID === updatedObserver.observerID ? updatedObserver : observer
                )
            );
            setFilteredObservers(prevFilteredObservers =>
                prevFilteredObservers.map(observer =>
                    observer.observerID === updatedObserver.observerID ? updatedObserver : observer
                )
            );

            console.log('Observer updated successfully');
        } catch (err) {
            console.error("Error updating observer:", err);
            setError(err.message);
        } finally {
            // Close the edit modal
            handleCloseEditModal();
        }
    };

    // Handle add observer button click
    const handleAddObserverClick = () => {
        setIsCreatingObserver(true);
    };

    // Handle closing the create modal
    const handleCloseCreateModal = () => {
        setIsCreatingObserver(false);
    };

    // Handle creating a new observer
    const handleCreateObserver = async (newObserver) => {
        try {
            // Send the new data to the server
            const response = await axios.post('http://localhost:3000/api/observers', newObserver);

            // Add the new observer to the observers list
            setObservers(prevObservers => [...prevObservers, response.data]);
            setFilteredObservers(prevFilteredObservers => [...prevFilteredObservers, response.data]);

            console.log('Observer created successfully');
        } catch (err) {
            console.error("Error creating observer:", err);
            setError(err.message);
        } finally {
            // Close the create modal
            handleCloseCreateModal();
        }
    };

    // Helper function to format timeslots for a specific day
    const getTimeslotsForDay = (timeslots, day) => {
        const dayTimeslots = timeslots.filter(ts => ts.day === day);
        if (dayTimeslots.length === 0) return '-';

        return dayTimeslots
            .map(ts => {
                const startTime = ts.startTime.slice(0, 5);
                const endTime = ts.endTime.slice(0, 5);
                return `${startTime}-${endTime}`;
            })
            .join(', ');
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    const handleLogout = () => {
        localStorage.removeItem('authToken'); // Remove token on logout
        window.location.href = '/login'; // Redirect to login
    };

    return (
        <div className="view-observers-container">
            <Navbar onLogout={handleLogout} />
            <h1>Observers Information</h1>

            {/* Search Bar */}
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
            </div>

            {/* Add Observer Button */}
            <button className="add-observer-button" onClick={handleAddObserverClick}>
                <i className="fas fa-plus"></i> Add Observer
            </button>

            {/* Observers Table */}
            <table className="observers-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Scientific Rank</th>
                        <th>Father Name</th>
                        <th>Availability</th>
                        <th>Monday</th>
                        <th>Tuesday</th>
                        <th>Wednesday</th>
                        <th>Thursday</th>
                        <th>Friday</th>
                        <th>Saturday</th>
                        <th>Sunday</th>
                        <th>Actions</th> {/* Add actions column */}
                    </tr>
                </thead>
                <tbody>
                    {filteredObservers.map(observer => (
                        <tr key={observer.observerID}>
                            <td>{observer.name}</td>
                            <td>{observer.scientificRank}</td>
                            <td>{observer.fatherName}</td>
                            <td>{observer.availability}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Monday')}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Tuesday')}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Wednesday')}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Thursday')}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Friday')}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Saturday')}</td>
                            <td>{getTimeslotsForDay(observer.timeslots, 'Sunday')}</td>
                            <td>
                                <button onClick={() => handleEditClick(observer)}>Edit</button> {/* Add edit button */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Conditionally render the EditObserverModal */}
            {editingObserver && (
                <EditObserverModal
                    observer={editingObserver}
                    onClose={handleCloseEditModal}
                    onSave={handleSaveObserver}
                />
            )}

            {/* Conditionally render the CreateObserverModal */}
            {isCreatingObserver && (
                <CreateObserverModal
                    onClose={handleCloseCreateModal}
                    onCreate={handleCreateObserver}
                />
            )}
        </div>
    );
};

export default ManageObservers;
