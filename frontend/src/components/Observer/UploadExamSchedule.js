import React, { useState } from 'react';
import axios from 'axios';

const UploadExamSchedule = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('examSchedule', file);

    try {
      const response = await axios.post('http://localhost:3000/api/upload-exam-schedule', formData);
      setMessage(response.data.message);
    } catch (error) {
      setMessage('Error uploading file: ' + error.message);
    }
  };

  return (
    <div>
      <h1>Upload Exam Schedule</h1>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default UploadExamSchedule;
