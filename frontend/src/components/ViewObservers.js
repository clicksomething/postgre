import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ViewObservers.css';
import Navbar from './Navbar'; // Import the Navbar component

const ViewObservers = () => {
  const [observers, setObservers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchObservers = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/observers');
        setObservers(response.data);
      } catch (err) {
        console.error("Error fetching observers:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchObservers();
  }, []);

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
      <table className="observers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scientific Rank</th>
            <th>Father Name</th>
            <th>Availability</th>
            <th>Course Name</th>
            <th>Time Slot</th>
          </tr>
        </thead>
        <tbody>
          {observers.map(observer => (
            <tr key={observer.ObserverID}>
              <td>{observer.name}</td>
              <td>{observer.scientificrank}</td>
              <td>{observer.fathername}</td>
              <td>{observer.availability}</td>
              <td>{observer.courseName}</td>
              <td>{observer.starttime} - {observer.endtime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ViewObservers;