import React, { useState, useRef } from 'react';
import axios from 'axios';
import { FaUpload, FaFile, FaSpinner } from 'react-icons/fa';
import './UploadSchedule.scss';

const UploadSchedule = ({ onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [formData, setFormData] = useState({
        academicYear: '',
        semester: 'First',
        examType: 'First'
    });
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        validateAndSetFile(droppedFile);
    };

    const handleFileInput = (e) => {
        const selectedFile = e.target.files[0];
        validateAndSetFile(selectedFile);
    };

    const validateAndSetFile = (file) => {
        setError(null);
        if (!file) return;

        // Check file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!validTypes.includes(file.type)) {
            setError('Please upload only Excel files (.xlsx or .xls)');
            return;
        }

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            setError('File size should not exceed 5MB');
            return;
        }

        setFile(file);
    };

    const handleFormChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        if (!formData.academicYear || !formData.semester || !formData.examType) {
            setError('Please fill in all fields');
            return;
        }

        const yearPattern = /^\d{4}-\d{4}$/;
        if (!yearPattern.test(formData.academicYear)) {
            setError('Academic year must be in format YYYY-YYYY');
            return;
        }

        const data = new FormData();
        data.append('file', file);
        data.append('academicYear', formData.academicYear);
        data.append('semester', formData.semester);
        data.append('examType', formData.examType);

        try {
            setUploading(true);
            setError(null);

            // Get the auth token using the correct key
            const token = localStorage.getItem('authToken');
            const userRole = localStorage.getItem('userRole');

            if (!token || userRole !== 'admin') {
                throw new Error('You must be logged in as an admin to upload files');
            }

            const response = await axios.post('http://localhost:3000/api/exams/upload', data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}` // Use the correct token
                },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            });

            onUploadSuccess(response.data);
            setFile(null);
            setFormData({
                academicYear: '',
                semester: 'First',
                examType: 'First'
            });
            setUploadProgress(0);
        } catch (err) {
            console.error('Upload error:', err);
            if (!localStorage.getItem('authToken')) {
                setError('Please log in to upload files');
            } else if (localStorage.getItem('userRole') !== 'admin') {
                setError('Only administrators can upload files');
            } else {
                setError(err.response?.data?.message || 'Error uploading file');
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-schedule">
            <div 
                className={`upload-area ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {!file ? (
                    <div className="upload-prompt">
                        <FaUpload className="upload-icon" />
                        <h3>Upload Exam Schedule</h3>
                        <p>Drag and drop your Excel file here, or</p>
                        <button 
                            className="browse-button"
                            onClick={() => fileInputRef.current.click()}
                        >
                            Browse Files
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileInput}
                            accept=".xlsx,.xls"
                            style={{ display: 'none' }}
                        />
                        <p className="file-hint">Only Excel files (.xlsx or .xls) up to 5MB</p>
                    </div>
                ) : (
                    <div className="file-info">
                        <div className="form-group">
                            <label>Academic Year (YYYY-YYYY)</label>
                            <input
                                type="text"
                                name="academicYear"
                                value={formData.academicYear}
                                onChange={handleFormChange}
                                placeholder="e.g., 2023-2024"
                            />
                        </div>
                        <div className="form-group">
                            <label>Semester</label>
                            <select 
                                name="semester"
                                value={formData.semester}
                                onChange={handleFormChange}
                            >
                                <option value="First">First</option>
                                <option value="Second">Second</option>
                                <option value="Summer">Summer</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Exam Type</label>
                            <select 
                                name="examType"
                                value={formData.examType}
                                onChange={handleFormChange}
                            >
                                <option value="First">First</option>
                                <option value="Second">Second</option>
                                <option value="Final">Final</option>
                            </select>
                        </div>
                        <FaFile className="file-icon" />
                        <p className="file-name">{file.name}</p>
                        <div className="file-actions">
                            <button 
                                className="upload-button"
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <>
                                        <FaSpinner className="spinner" />
                                        Uploading... {uploadProgress}%
                                    </>
                                ) : (
                                    <>
                                        <FaUpload /> Upload File
                                    </>
                                )}
                            </button>
                            <button 
                                className="change-file-button"
                                onClick={() => setFile(null)}
                                disabled={uploading}
                            >
                                Change File
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}
        </div>
    );
};

export default UploadSchedule;
