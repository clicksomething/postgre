import React, { useState, useEffect } from 'react';
import { FaSearch, FaTimes, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import axios from 'axios';
import './AssignmentsView.scss';

const AssignmentsView = () => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const userRole = localStorage.getItem('userRole');
            
            if (!token || userRole !== 'admin') {
                throw new Error('Not authorized');
            }

            const response = await axios.get('http://localhost:3000/api/exams', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Exams response:', response.data);
            
            if (response.data && Array.isArray(response.data)) {
                setExams(response.data);
            } else {
                setError('Invalid data format received from server');
            }
            setLoading(false);
        } catch (err) {
            console.error('Detailed error:', err);
            setError(err.response?.data?.message || 'Error fetching exams');
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredExams = exams.filter(exam => 
        exam.examName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exam.courseName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status) => {
        switch(status) {
            case 'assigned':
                return <span className="status-badge assigned"><FaCheck /> Assigned</span>;
            case 'unassigned':
                return <span className="status-badge unassigned"><FaExclamationTriangle /> Unassigned</span>;
            default:
                return <span className="status-badge">{status}</span>;
        }
    };

    if (loading) return <div className="loading">Loading assignments...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="assignments-view">
            <div className="search-section">
                <div className="search-bar">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search exams..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                    {searchTerm && (
                        <button className="clear-search" onClick={() => setSearchTerm('')}>
                            <FaTimes />
                        </button>
                    )}
                </div>
            </div>

            <div className="assignments-table-container">
                <table className="assignments-table">
                    <thead>
                        <tr>
                            <th>Exam Name</th>
                            <th>Course</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Room</th>
                            <th>Status</th>
                            <th>Head Observer</th>
                            <th>Secretary</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExams.map((exam) => (
                            <tr key={exam.examId}>
                                <td>{exam.examName}</td>
                                <td>{exam.courseName}</td>
                                <td>{new Date(exam.examDate).toLocaleDateString()}</td>
                                <td>{`${exam.startTime} - ${exam.endTime}`}</td>
                                <td>{exam.roomNum}</td>
                                <td>{getStatusBadge(exam.status)}</td>
                                <td>{exam.headObserver || '-'}</td>
                                <td>{exam.secretary || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssignmentsView; 