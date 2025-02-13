import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import axios from 'axios';

const ViewExamSchedule = () => {
  const [examSchedule, setExamSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExamSchedule = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/exam'); // Fetching exam schedule data

        setExamSchedule(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExamSchedule();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Exam Schedule</h1>
      <Link to="/upload-exam-schedule">Upload Exam Schedule</Link> {/* Navigation link to Upload Exam Schedule */}

      <table>
        <thead>
          <tr>
            <th>Course Name</th>
            <th>Date</th>
            <th>Time</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {examSchedule.map((exam) => (
            <tr key={exam.id}>
              <td>{exam.examname}</td>
              <td>{new Date(exam.examdate).toLocaleDateString()}</td>
              <td>{exam.startTime} - {exam.endTime}</td>

              <td>{exam.roomid}</td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ViewExamSchedule;
