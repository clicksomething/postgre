import React, { useState, useRef } from 'react';
import axios from 'axios';
import { FaUpload, FaFile, FaSpinner, FaTimes } from 'react-icons/fa';
import './UploadObservers.scss';

const UploadObservers = ({ onUploadSuccess }) => {
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({});
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
        const droppedFiles = Array.from(e.dataTransfer.files);
        validateAndAddFiles(droppedFiles);
    };

    const handleFileInput = (e) => {
        const selectedFiles = Array.from(e.target.files);
        validateAndAddFiles(selectedFiles);
    };

    const validateAndAddFiles = (newFiles) => {
        setError(null);
        if (!newFiles || newFiles.length === 0) return;

        const validFiles = [];
        const errors = [];

        newFiles.forEach(file => {
        // Check file type
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!validTypes.includes(file.type)) {
                errors.push(`${file.name}: Please upload only Excel files (.xlsx or .xls)`);
            return;
        }

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
                errors.push(`${file.name}: File size should not exceed 5MB`);
                return;
            }

            // Check if file already exists
            const fileExists = files.some(existingFile => 
                existingFile.name === file.name && existingFile.size === file.size
            );
            if (fileExists) {
                errors.push(`${file.name}: File already selected`);
            return;
        }

            validFiles.push(file);
        });

        if (errors.length > 0) {
            setError(errors.join('\n'));
        }

        if (validFiles.length > 0) {
            setFiles(prevFiles => [...prevFiles, ...validFiles]);
        }
    };

    const removeFile = (index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[index];
            return newProgress;
        });
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            setError('Please select at least one file first');
            return;
        }

        const data = new FormData();
        files.forEach(file => {
            data.append('files', file);
        });

        try {
            setUploading(true);
            setError(null);
            setUploadProgress({});

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
                    // Show upload progress (file transfer)
                    const uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(prev => ({
                        ...prev,
                        upload: uploadProgress,
                        overall: Math.min(uploadProgress, 90) // Reserve 10% for processing
                    }));
                }
            };

            console.log('Axios Request Config:', config);

            // Show processing phase
            setUploadProgress(prev => ({
                ...prev,
                processing: true,
                overall: 95
            }));

            const response = await axios(config);

            // Complete
            setUploadProgress(prev => ({
                ...prev,
                processing: false,
                overall: 100
            }));

            onUploadSuccess(response.data);
            setFiles([]);
            setUploadProgress({});
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
                setError(err.response?.data?.message || 'Error uploading files');
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
                {files.length === 0 ? (
                    <div className="upload-prompt">
                        <FaUpload className="upload-icon" />
                        <h3>Upload Observers</h3>
                        <p>Drag and drop your Excel files here, or</p>
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
                            multiple
                            style={{ display: 'none' }}
                        />
                        <p className="file-hint">Only Excel files (.xlsx or .xls) up to 5MB each</p>
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
                    <div className="files-info">
                        <h3>Selected Files ({files.length})</h3>
                        <div className="files-list">
                            {files.map((file, index) => (
                                <div key={index} className="file-item">
                        <FaFile className="file-icon" />
                                    <div className="file-details">
                        <p className="file-name">{file.name}</p>
                                        <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <button 
                                        className="remove-file-button"
                                        onClick={() => removeFile(index)}
                                        disabled={uploading}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="file-actions">
                            {uploading && (
                                <div className="upload-progress-details">
                                    {uploadProgress.upload !== undefined && (
                                        <div className="progress-item">
                                            <span>Upload:</span>
                                            <div className="progress-bar">
                                                <div 
                                                    className="progress-fill" 
                                                    style={{ width: `${uploadProgress.upload}%` }}
                                                />
                                            </div>
                                            <span>{uploadProgress.upload}%</span>
                                        </div>
                                    )}
                                    {uploadProgress.processing && (
                                        <div className="progress-item">
                                            <span>Processing:</span>
                                            <div className="progress-bar">
                                                <div className="progress-fill processing" />
                                            </div>
                                            <span>Processing...</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button 
                                className="upload-button"
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <>
                                        <FaSpinner className="spinner" />
                                        {uploadProgress.processing ? (
                                            <>Processing files... {uploadProgress.overall || 0}%</>
                                        ) : (
                                            <>Uploading... {uploadProgress.overall || 0}%</>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <FaUpload /> Upload {files.length} File{files.length > 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                            <button 
                                className="change-files-button"
                                onClick={() => {
                                    setFiles([]);
                                    setUploadProgress({});
                                }}
                                disabled={uploading}
                            >
                                Change Files
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="error-message">
                    {error.split('\n').map((line, index) => (
                        <div key={index}>{line}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UploadObservers; 