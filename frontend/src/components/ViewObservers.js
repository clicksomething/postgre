import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import axios from 'axios';
import './ViewObservers.css';
import Navbar from './Navbar'; // Import the Navbar component

const ViewObservers = () => {
  const [observers, setObservers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log("Fetching observers..."); // Log to console for debugging

  useEffect(() => {
    const fetchObservers = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/observers'); // Fetching observers data
        console.log("Response data:", response.data); // Log the response data for debugging
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
    <div>
      <h1>Observers Information</h1>
      <Link to="/view-exam-schedule">View Exam Schedule</Link> {/* Navigation link to View Exam Schedule */}
      <table>
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