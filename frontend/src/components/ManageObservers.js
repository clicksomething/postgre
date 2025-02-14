import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ManageObservers.scss';
import EditObserverModal from './EditObserverModal';
import CreateObserverModal from './CreateObserverModal';
import Navbar from './Navbar';

const ManageObservers = () => {
    const [observers, setObservers] = useState([]);
    const [filteredObservers, setFilteredObservers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingObserver, setEditingObserver] = useState(null);
    const [isCreatingObserver, setIsCreatingObserver] = useState(false);

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

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);

        const filtered = observers.filter(observer =>
            observer.name.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredObservers(filtered);
    };

    const handleEditClick = (observer) => {
        setEditingObserver(observer);
    };

    const handleCloseEditModal = () => {
        setEditingObserver(null);
    };

    const handleSaveObserver = async (updatedObserver) => {
        try {
            await axios.put(`http://localhost:3000/api/observers/${updatedObserver.observerID}`, updatedObserver);
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
            setObservers(prevObservers => [...prevObservers, response.data]);
            setFilteredObservers(prevFilteredObservers => [...prevFilteredObservers, response.data]);

            console.log('Observer created successfully');
        } catch (err) {
            console.error("Error creating observer:", err);
            setError(err.message);
        } finally {
            handleCloseCreateModal();
        }
    };

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
        localStorage.removeItem('authToken');
        window.location.href = '/login';
    };

    return (
        <div className="view-observers-container">
            <Navbar onLogout={handleLogout} />
            <h1>Observers Information</h1>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
            </div>

            <button className="add-observer-button" onClick={handleAddObserverClick}>
                <i className="fas fa-plus"></i> Add Observer
            </button>

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
                        <th>Actions</th>
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
                                <button className="edit-button" onClick={() => handleEditClick(observer)}>
                                    <i className="fas fa-edit"></i> Edit
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

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
        </div>
    );
};

export default ManageObservers;
