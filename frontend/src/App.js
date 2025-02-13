import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './components/Observer/Login'; // Import your Login component
import UploadExamSchedule from './components/Observer/UploadExamSchedule'; // Import Upload Exam Schedule component
import ViewExamSchedule from './components/Observer/ViewExamSchedule'; // Import View Exam Schedule component


import ForgotPassword from './components/Observer/ForgotPassword'; // Import your Forgot Password component
import ViewObservers from './components/Observer/ViewObservers'; // Import View Observers component


const App = () => {
  return (
    <Router>
      <div>
      <Routes>
        <Route path="/view-observers" element={<ViewObservers />} /> {/* Route for View Observers */}

          <Route path="/upload-exam-schedule" element={<UploadExamSchedule />} /> {/* Route for Upload Exam Schedule */}
          <Route path="/view-exam-schedule" element={<ViewExamSchedule />} /> {/* Route for View Exam Schedule */}
          <Route path="/view-exam-schedule" element={<ViewExamSchedule />} /> {/* Route for View Exam Schedule */}
          <Route path="/" element={<Login />} /> {/* Route for the Login page */}



          <Route path="/forgot-password" element={<ForgotPassword />} /> {/* Route for the Forgot Password page */}
        </Routes>
      </div>
    </Router>
  );
};

export default App;
