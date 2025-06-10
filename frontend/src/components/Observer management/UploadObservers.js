import React, { useState, useRef } from 'react';
import axios from 'axios';
import { FaUpload, FaFile, FaSpinner } from 'react-icons/fa';
import './UploadObservers.scss';

const UploadObservers = ({ onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
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

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        const data = new FormData();
        data.append('file', file);

        try {
            setUploading(true);
            setError(null);

            // Get the auth token
            const token = localStorage.getItem('authToken');
            const userRole = localStorage.getItem('userRole');

            console.log('Auth Token:', token);
            console.log('User Role:', userRole);

            if (!token || userRole !== 'admin') {
                throw new Error('You must be logged in as an admin to upload files');
            }

            const config = {
                url: 'http://localhost:3000/api/users/observers/upload',
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                data: data,
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            };

            console.log('Axios Request Config:', config);

            const response = await axios(config);

            onUploadSuccess(response.data);
            setFile(null);
            setUploadProgress(0);
        } catch (err) {
            console.error('Full Upload Error:', err);
            console.error('Error Response:', err.response);
            
            if (err.response) {
                // The request was made and the server responded with a status code
                console.error('Error Data:', err.response.data);
                console.error('Error Status:', err.response.status);
                console.error('Error Headers:', err.response.headers);
            } else if (err.request) {
                // The request was made but no response was received
                console.error('No response received:', err.request);
            } else {
                // Something happened in setting up the request
                console.error('Error setting up request:', err.message);
            }

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
        <div className="upload-observers">
            <div 
                className={`upload-area ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {!file ? (
                    <div className="upload-prompt">
                        <FaUpload className="upload-icon" />
                        <h3>Upload Observers</h3>
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
                        <div className="format-info">
                            <h4>Required Excel Format:</h4>
                            <ul>
                                <li>الاسم (Name)</li>
                                <li>اللقب (Title)</li>
                                <li>المرتبة العلمية (Scientific Rank)</li>
                                <li>اسم الأب (Father's Name)</li>
                                <li>التفرغ (Availability: جزئي or كامل)</li>
                                <li>Days (السبت, الاحد, etc.) with time slots (e.g., "8:30 - 11:30")</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="file-info">
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

export default UploadObservers; 