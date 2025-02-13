import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ViewObservers.css';
import Navbar from './Navbar'; // Import the Navbar component

const ViewObservers = () => {
  const [observers, setObservers] = useState([]); // All observers
  const [filteredObservers, setFilteredObservers] = useState([]); // Filtered observers
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // Search term

  useEffect(() => {
    const fetchObservers = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/observers');
        setObservers(response.data);
        setFilteredObservers(response.data); // Initialize filteredObservers with all observers
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

    // Filter observers based on the search term
    const filtered = observers.filter(observer =>
      observer.name.toLowerCase().includes(term.toLowerCase())
    );
    setFilteredObservers(filtered);
  };

  // Helper function to format timeslots for a specific day
  const getTimeslotsForDay = (timeslots, day) => {
    const dayTimeslots = timeslots.filter(ts => ts.day === day);
    if (dayTimeslots.length === 0) return '-';

    // Format each timeslot as "HH:MM-HH:MM"
    return dayTimeslots
      .map(ts => {
        const startTime = ts.startTime.slice(0, 5); // Extract HH:MM
        const endTime = ts.endTime.slice(0, 5); // Extract HH:MM
        return `${startTime}-${endTime}`;
      })
      .join(', '); // Join multiple timeslots with a comma
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const handleLogout = () => {
    localStorage.removeItem('authToken'); // Remove token on logout
    window.location.href = '/login'; // Redirect to login
  };

  return (
    <div className="view-observers-container">
      <Navbar onLogout={handleLogout} /> {/* Include the Navbar here */}
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

      {/* Observers Table */}
      <table className="observers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scientific Rank</th>
            <th>Father Name</th>
            <th>Availability</th>
            <th>Course Name</th>
            <th>Monday</th>
            <th>Tuesday</th>
            <th>Wednesday</th>
            <th>Thursday</th>
            <th>Friday</th>
            <th>Saturday</th>
            <th>Sunday</th>
          </tr>
        </thead>
        <tbody>
          {filteredObservers.map(observer => (
            <tr key={observer.observerID}>
              <td>{observer.name}</td>
              <td>{observer.scientificRank}</td>
              <td>{observer.fatherName}</td>
              <td>{observer.availability}</td>
              <td>{observer.courseName}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Monday')}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Tuesday')}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Wednesday')}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Thursday')}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Friday')}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Saturday')}</td>
              <td>{getTimeslotsForDay(observer.timeslots, 'Sunday')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ViewObservers;